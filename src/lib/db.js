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
// Behavior (default = merge):
//   - new (siteId,title): insert pending
//   - existing pending: refresh fields + last_seen_at
//   - existing fixed: mark needs_reverify=true, bump last_seen_at
//   - pending rows NOT in this batch (stale titles): DELETED
//
// `reset: true` (used by explicit user Re-analyze):
//   - ALL existing rows for the site are deleted first, then new ones
//     inserted. User sees a completely fresh checklist. Fixed items are
//     also cleared — intentional, because user asked for a reset.
//
// Resilient to missing migration 005 columns.
export async function upsertSiteFixes(siteId, fixes = [], { reset = false } = {}) {
  if (!Array.isArray(fixes) || fixes.length === 0) return;

  const supabase = createServiceSupabase();
  const nowIso = new Date().toISOString();

  const titles = fixes.map((f) => f.title).filter(Boolean);
  if (titles.length === 0) return;

  // Reset mode: wipe everything first, then insert fresh
  if (reset) {
    await supabase.from('site_fixes').delete().eq('site_id', siteId);
    const rows = fixes.filter((f) => f?.title).map((fix) => ({
      site_id: siteId,
      title: fix.title,
      status: 'pending',
      action: fix.action || null,
      impact: fix.impact || null,
      expected_gain: fix.expectedGain || null,
      rocket_path: fix.rocketPath || null,
      caveats: fix.caveats || null,
      last_seen_at: nowIso,
    }));
    if (rows.length > 0) await insertFixesResilient(supabase, rows);
    return;
  }

  // Merge mode (default): preserve fixed rows, refresh pending, delete stale pending
  const { data: allExisting } = await supabase
    .from('site_fixes')
    .select('id, title, status')
    .eq('site_id', siteId);

  const existingByTitle = new Map((allExisting || []).map((r) => [r.title, r]));
  const newTitleSet = new Set(titles);

  const stalePendingIds = (allExisting || [])
    .filter((r) => r.status === 'pending' && !newTitleSet.has(r.title))
    .map((r) => r.id);
  if (stalePendingIds.length > 0) {
    await supabase.from('site_fixes').delete().in('id', stalePendingIds);
  }

  const toInsert = [];
  const toUpdate = [];

  for (const fix of fixes) {
    if (!fix?.title) continue;
    const fullFields = {
      action: fix.action || null,
      impact: fix.impact || null,
      expected_gain: fix.expectedGain || null,
      rocket_path: fix.rocketPath || null,
      caveats: fix.caveats || null,
      last_seen_at: nowIso,
    };

    const prior = existingByTitle.get(fix.title);
    if (!prior) {
      toInsert.push({
        site_id: siteId,
        title: fix.title,
        status: 'pending',
        ...fullFields,
      });
    } else if (prior.status === 'fixed') {
      toUpdate.push({
        id: prior.id,
        patch: { ...fullFields, needs_reverify: true },
      });
    } else {
      toUpdate.push({ id: prior.id, patch: fullFields });
    }
  }

  if (toInsert.length > 0) {
    await insertFixesResilient(supabase, toInsert);
  }
  for (const u of toUpdate) {
    await updateFixResilient(supabase, u.id, u.patch);
  }
}

// Retry helpers for environments where migration 005 hasn't been applied.
async function insertFixesResilient(supabase, rows) {
  const { error } = await supabase.from('site_fixes').insert(rows);
  if (!error) return;
  if (isMissingColumnError(error)) {
    const stripped = rows.map(stripExtendedFixFields);
    const { error: e2 } = await supabase.from('site_fixes').insert(stripped);
    if (e2) console.error('site_fixes insert (fallback) failed:', e2.message);
  } else {
    console.error('site_fixes insert failed:', error.message);
  }
}

async function updateFixResilient(supabase, id, patch) {
  const { error } = await supabase.from('site_fixes').update(patch).eq('id', id);
  if (!error) return;
  if (isMissingColumnError(error)) {
    const { error: e2 } = await supabase
      .from('site_fixes')
      .update(stripExtendedFixFields(patch))
      .eq('id', id);
    if (e2) console.error('site_fixes update (fallback) failed:', e2.message);
  } else {
    console.error('site_fixes update failed:', error.message);
  }
}

function isMissingColumnError(err) {
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'));
}

function stripExtendedFixFields(row) {
  const { impact: _i, expected_gain: _g, rocket_path: _r, caveats: _c, ...rest } = row;
  return rest;
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

// Returns per-site trend data for a 14-day window, split into this-week
// (last 7 days) and last-week (7 days before that). Shape is ready for
// buildTrendReport in slack.js.
//
// Output: { [siteId]: { site, thisWeek, lastWeek, bestDay, worstDay } }
//   thisWeek/lastWeek: { scanCount, avgPerf, avgDesktopPerf, avgA11y, avgBP,
//                        avgSEO, avgLcpMs, avgFcpMs, avgTbtMs, avgCls,
//                        criticalCount }
export async function getTrendData(cookieStore, teamId) {
  const supabase = createServerSupabase(cookieStore);

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();
  const fourteenDaysAgo = new Date(now - 14 * 86400000).toISOString();

  // Get all enabled sites for the team
  const { data: sites } = await supabase
    .from('sites')
    .select('id, name, url, team_id, logo_url, tags')
    .eq('team_id', teamId);
  if (!sites?.length) return {};

  const siteIds = sites.map((s) => s.id);

  // Fetch all scan_results in the last 14 days for these sites
  const { data: rows } = await supabase
    .from('scan_results')
    .select('site_id, strategy, performance, accessibility, best_practices, seo, fcp, lcp, tbt, cls, audits, scanned_at')
    .in('site_id', siteIds)
    .gte('scanned_at', fourteenDaysAgo);
  if (!rows) return {};

  function parseMs(displayValue) {
    if (!displayValue) return null;
    const s = String(displayValue).toLowerCase().replace(/,/g, '').trim();
    const n = parseFloat(s);
    if (isNaN(n)) return null;
    if (s.endsWith('ms')) return n;
    if (s.endsWith('s')) return n * 1000;
    return n;
  }

  function aggregate(rowsForSiteInRange) {
    if (rowsForSiteInRange.length === 0) return null;
    const mobile = rowsForSiteInRange.filter((r) => r.strategy === 'mobile');
    const desktop = rowsForSiteInRange.filter((r) => r.strategy === 'desktop');

    const avg = (arr, field) => {
      const vals = arr.map((r) => r[field]).filter((v) => v != null);
      if (vals.length === 0) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    const avgParsed = (arr, field) => {
      const vals = arr.map((r) => parseMs(r[field])).filter((v) => v != null);
      if (vals.length === 0) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    // Take the most recent mobile scan's critical count as this period's "critical count"
    const newestMobile = mobile.sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at))[0];
    const criticalCount = newestMobile?.audits?.critical?.length || 0;

    return {
      scanCount: rowsForSiteInRange.length,
      avgPerf: avg(mobile, 'performance'),
      avgDesktopPerf: avg(desktop, 'performance'),
      avgA11y: avg(mobile, 'accessibility'),
      avgBP: avg(mobile, 'best_practices'),
      avgSEO: avg(mobile, 'seo'),
      avgLcpMs: avgParsed(mobile, 'lcp'),
      avgFcpMs: avgParsed(mobile, 'fcp'),
      avgTbtMs: avgParsed(mobile, 'tbt'),
      avgCls: avgParsed(mobile, 'cls'),
      criticalCount,
    };
  }

  // Group rows by site
  const bySite = new Map();
  for (const s of sites) bySite.set(s.id, { site: s, rows: [] });
  for (const r of rows) bySite.get(r.site_id)?.rows.push(r);

  const result = {};
  for (const [siteId, { site, rows: siteRows }] of bySite) {
    const thisWeekRows = siteRows.filter((r) => r.scanned_at >= sevenDaysAgo);
    const lastWeekRows = siteRows.filter((r) => r.scanned_at < sevenDaysAgo);

    // Best/worst day across all scans this week, by mobile performance
    const mobileThisWeek = thisWeekRows.filter((r) => r.strategy === 'mobile');
    let bestDay = null;
    let worstDay = null;
    for (const r of mobileThisWeek) {
      if (r.performance == null) continue;
      if (!bestDay || r.performance > bestDay.perf) {
        bestDay = { dateIso: r.scanned_at, strategy: 'mobile', perf: r.performance };
      }
      if (!worstDay || r.performance < worstDay.perf) {
        worstDay = { dateIso: r.scanned_at, strategy: 'mobile', perf: r.performance };
      }
    }

    result[siteId] = {
      site,
      thisWeek: aggregate(thisWeekRows),
      lastWeek: aggregate(lastWeekRows),
      bestDay,
      worstDay,
    };
  }

  return result;
}
