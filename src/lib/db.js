import { createServerSupabase, createServiceSupabase } from './supabase';

// ============================================
// Teams
// ============================================

export async function createTeam(cookieStore, { name, slug }) {
  const supabase = createServerSupabase(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Use service role for atomic team+member creation
  const service = createServiceSupabase();

  // Create team
  const { data: team, error: teamError } = await service
    .from('teams')
    .insert({ name, slug })
    .select()
    .single();

  if (teamError) throw teamError;

  // Add creator as owner
  const { error: memberError } = await service
    .from('team_members')
    .insert({ team_id: team.id, user_id: user.id, role: 'owner' });

  if (memberError) {
    // Rollback: delete the orphaned team
    await service.from('teams').delete().eq('id', team.id);
    throw memberError;
  }

  return team;
}

// Get or auto-create a team for the current user
// Transparent to the user — no "team" concept in the UI for Phase 1
export async function ensureTeam(cookieStore) {
  const teams = await getUserTeams(cookieStore);
  if (teams.length > 0) return teams[0];

  // Auto-create a default team
  const supabase = createServerSupabase(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const name = user.email?.split('@')[0] || 'My Team';
  const slug = `team-${user.id.slice(0, 8)}`;

  return createTeam(cookieStore, { name, slug });
}

export async function getUserTeams(cookieStore) {
  const supabase = createServerSupabase(cookieStore);
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getTeamBySlug(cookieStore, slug) {
  const supabase = createServerSupabase(cookieStore);
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data; // null if not found
}

export async function getUserRole(cookieStore, teamId) {
  const supabase = createServerSupabase(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data.role;
}

// ============================================
// Sites
// ============================================

export async function getSites(cookieStore, teamId) {
  const supabase = createServerSupabase(cookieStore);
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getSiteById(cookieStore, siteId) {
  const supabase = createServerSupabase(cookieStore);
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('id', siteId)
    .maybeSingle();

  if (error) throw error;
  return data; // null if not found or RLS denies access
}

export async function createSite(cookieStore, { teamId, name, url, scanFrequency, tags, logoUrl }) {
  const supabase = createServerSupabase(cookieStore);
  const { data, error } = await supabase
    .from('sites')
    .insert({
      team_id: teamId,
      name,
      url,
      scan_frequency: scanFrequency || 'daily',
      tags: tags || [],
      logo_url: logoUrl || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSite(cookieStore, siteId, updates) {
  const supabase = createServerSupabase(cookieStore);

  const allowed = {};
  if (updates.name !== undefined) allowed.name = updates.name;
  if (updates.url !== undefined) allowed.url = updates.url;
  if (updates.enabled !== undefined) allowed.enabled = updates.enabled;
  if (updates.scanFrequency !== undefined) allowed.scan_frequency = updates.scanFrequency;
  if (updates.tags !== undefined) allowed.tags = updates.tags;
  if (updates.logoUrl !== undefined) allowed.logo_url = updates.logoUrl || null;

  if (Object.keys(allowed).length === 0) throw new Error('No valid fields to update');

  const { data, error } = await supabase
    .from('sites')
    .update(allowed)
    .eq('id', siteId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSite(cookieStore, siteId) {
  const supabase = createServerSupabase(cookieStore);
  const { error } = await supabase
    .from('sites')
    .delete()
    .eq('id', siteId);

  if (error) throw error;
}

// Get a map of siteId → mobile scan history for the given team (last `days` days).
// Used by the Overview page to render per-site trend charts in one round-trip.
export async function getSiteHistoryForOverview(cookieStore, teamId, { days = 14 } = {}) {
  const supabase = createServerSupabase(cookieStore);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data: sites } = await supabase
    .from('sites')
    .select('id')
    .eq('team_id', teamId);
  if (!sites?.length) return {};

  const { data: rows } = await supabase
    .from('scan_results')
    .select('site_id, performance, accessibility, best_practices, seo, scanned_at')
    .in('site_id', sites.map((s) => s.id))
    .eq('strategy', 'mobile')
    .gte('scanned_at', since)
    .order('scanned_at', { ascending: true });

  const grouped = {};
  for (const row of rows || []) {
    (grouped[row.site_id] ||= []).push(row);
  }
  return grouped;
}

// Get sites due for scanning (service role — no RLS)
// frequency: 'daily', 'weekly', or 'monthly' — filters sites by scan_frequency
export async function getEnabledSites(frequency = 'daily') {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from('sites')
    .select('id, url, name, team_id, scan_frequency')
    .eq('enabled', true)
    .eq('scan_frequency', frequency);

  if (error) throw error;
  return data;
}

// ============================================
// Scan Results (writes use service role)
// ============================================

export async function saveScanResult({ siteId, strategy, scores, vitals, audits }) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from('scan_results')
    .insert({
      site_id: siteId,
      strategy,
      performance: scores.performance,
      accessibility: scores.accessibility,
      best_practices: scores.bestPractices,
      seo: scores.seo,
      fcp: vitals.fcp,
      lcp: vitals.lcp,
      tbt: vitals.tbt,
      cls: vitals.cls,
      si: vitals.si,
      audits,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getLatestResults(cookieStore, teamId) {
  const supabase = createServerSupabase(cookieStore);

  // First get all site IDs for this team
  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select('id')
    .eq('team_id', teamId);

  if (sitesError) throw sitesError;
  if (!sites.length) return [];

  const siteIds = sites.map((s) => s.id);

  // Fetch latest 4 results per site in parallel (covers mobile + desktop even with partial failures)
  const queries = siteIds.map((siteId) =>
    supabase
      .from('scan_results')
      .select(`
        *,
        sites (id, name, url, team_id)
      `)
      .eq('site_id', siteId)
      .order('scanned_at', { ascending: false })
      .limit(4)
  );

  const responses = await Promise.all(queries);
  const results = [];
  for (const { data, error } of responses) {
    if (error) throw error;
    results.push(...data);
  }

  // Deduplicate: keep only the latest per site+strategy
  const latest = new Map();
  for (const row of results) {
    const key = `${row.site_id}-${row.strategy}`;
    if (!latest.has(key)) {
      latest.set(key, row);
    }
  }

  return Array.from(latest.values());
}

export async function getRecentActivity(cookieStore, teamId, { limit = 15 } = {}) {
  const supabase = createServerSupabase(cookieStore);
  const { data: sites } = await supabase.from('sites').select('id').eq('team_id', teamId);
  if (!sites?.length) return [];

  const siteIds = sites.map((s) => s.id);
  const { data, error } = await supabase
    .from('scan_results')
    .select('id, strategy, performance, accessibility, best_practices, seo, fcp, lcp, scanned_at, site_id, sites(name, url)')
    .in('site_id', siteIds)
    .order('scanned_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function getSiteResults(cookieStore, siteId, { limit = 10 } = {}) {
  const supabase = createServerSupabase(cookieStore);
  const { data, error } = await supabase
    .from('scan_results')
    .select('*')
    .eq('site_id', siteId)
    .order('scanned_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// ============================================
// Monthly Snapshots (writes use service role)
// ============================================

export async function upsertMonthlySnapshot({ siteId, month, scores, counts, avgVitals }) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from('monthly_snapshots')
    .upsert(
      {
        site_id: siteId,
        month,
        performance: scores.performance,
        accessibility: scores.accessibility,
        best_practices: scores.bestPractices,
        seo: scores.seo,
        critical_count: counts.critical,
        improvement_count: counts.improvement,
        optional_count: counts.optional,
        avg_fcp_ms: avgVitals.fcpMs,
        avg_lcp_ms: avgVitals.lcpMs,
      },
      { onConflict: 'site_id,month' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSiteHistory(cookieStore, siteId, { limit = 12 } = {}) {
  const supabase = createServerSupabase(cookieStore);
  const { data, error } = await supabase
    .from('monthly_snapshots')
    .select('*')
    .eq('site_id', siteId)
    .order('month', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// Get previous month snapshot for regression detection
export async function getPreviousSnapshot(siteId, currentMonth) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from('monthly_snapshots')
    .select('*')
    .eq('site_id', siteId)
    .lt('month', currentMonth)
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ============================================
// Integrations
// ============================================

export async function getIntegrations(cookieStore, teamId) {
  const supabase = createServerSupabase(cookieStore);
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getIntegrationsByType(cookieStore, teamId, type) {
  const supabase = createServerSupabase(cookieStore);
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('team_id', teamId)
    .eq('type', type)
    .eq('enabled', true);

  if (error) throw error;
  return data;
}

export async function createIntegration(cookieStore, { teamId, type, config, enabled }) {
  const supabase = createServerSupabase(cookieStore);
  const { data, error } = await supabase
    .from('integrations')
    .insert({ team_id: teamId, type, config, enabled: enabled !== false })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateIntegration(cookieStore, integrationId, updates) {
  const supabase = createServerSupabase(cookieStore);

  const allowed = {};
  if (updates.config !== undefined) allowed.config = updates.config;
  if (updates.enabled !== undefined) allowed.enabled = updates.enabled;

  if (Object.keys(allowed).length === 0) throw new Error('No valid fields to update');

  const { data, error } = await supabase
    .from('integrations')
    .update(allowed)
    .eq('id', integrationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteIntegration(cookieStore, integrationId) {
  const supabase = createServerSupabase(cookieStore);
  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('id', integrationId);

  if (error) throw error;
}

// Get enabled integrations for a team (service role — used in notify worker)
export async function getTeamIntegrations(teamId) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('team_id', teamId)
    .eq('enabled', true);

  if (error) throw error;
  return data;
}

// ============================================
// Site Fixes (AI-suggested tasks the user can check off)
// ============================================

export async function getSiteFixes(cookieStore, siteId) {
  const supabase = createServerSupabase(cookieStore);
  const { data, error } = await supabase
    .from('site_fixes')
    .select('*')
    .eq('site_id', siteId)
    .order('status', { ascending: true })   // 'fixed' sorts before 'pending' alphabetically
    .order('last_seen_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Service role — called from the scheduler / /api/ai after AI produces top fixes.
// Merges AI output with existing rows:
//   - new (siteId,title): insert pending
//   - existing pending: update action + last_seen_at
//   - existing fixed: mark needs_reverify=true (issue reappeared) and bump last_seen_at
// Rows in DB not present in this batch are left alone (user still owns them).
export async function upsertSiteFixes(siteId, fixes = []) {
  if (!Array.isArray(fixes) || fixes.length === 0) return;

  const supabase = createServiceSupabase();
  const nowIso = new Date().toISOString();

  // Fetch existing rows for these titles
  const titles = fixes.map((f) => f.title).filter(Boolean);
  if (titles.length === 0) return;

  const { data: existing } = await supabase
    .from('site_fixes')
    .select('id, title, status, first_seen_at')
    .eq('site_id', siteId)
    .in('title', titles);

  const existingByTitle = new Map((existing || []).map((r) => [r.title, r]));

  const toInsert = [];
  const toUpdate = [];

  for (const fix of fixes) {
    if (!fix?.title) continue;
    const prior = existingByTitle.get(fix.title);
    if (!prior) {
      toInsert.push({
        site_id: siteId,
        title: fix.title,
        action: fix.action || null,
        status: 'pending',
        last_seen_at: nowIso,
      });
    } else if (prior.status === 'fixed') {
      toUpdate.push({
        id: prior.id,
        patch: {
          action: fix.action || null,
          last_seen_at: nowIso,
          needs_reverify: true,
        },
      });
    } else {
      // still pending — refresh action + timestamp
      toUpdate.push({
        id: prior.id,
        patch: { action: fix.action || null, last_seen_at: nowIso },
      });
    }
  }

  if (toInsert.length > 0) {
    await supabase.from('site_fixes').insert(toInsert);
  }
  for (const u of toUpdate) {
    await supabase.from('site_fixes').update(u.patch).eq('id', u.id);
  }
}

// Save the latest full AI analysis markdown for a site (service role).
export async function saveSiteAIAnalysis(siteId, markdown) {
  if (!siteId || !markdown) return;
  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from('sites')
    .update({ ai_markdown: markdown, ai_generated_at: new Date().toISOString() })
    .eq('id', siteId);
  if (error) console.error('saveSiteAIAnalysis failed:', error.message);
}
