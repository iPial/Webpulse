import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSiteById, updateSite, deleteSite, getUserRole } from '@/lib/db';
import { createServiceSupabase } from '@/lib/supabase';
import { computeScheduledAt } from '@/lib/schedule-helpers';

// PATCH /api/sites/[id]
// Body (all fields optional — pass only what changed):
//   Site fields:    { name, url, scanFrequency, tags, logoUrl, isPublic, enabled }
//   Schedule fields: { frequency, dayOfWeek, dayOfMonth, timeOfDay,
//                      notifyAI, notifySlack, notifyEmail }
//
// If any schedule field is present, the route finds the linked schedule
// (config.siteId === siteId) and updates it; or creates one if missing.
// Site scan_frequency is set to 'custom' in that case so the legacy 6am
// cron skips it — the explicit schedule owns timing.
export async function PATCH(request, { params }) {
  try {
    const cookieStore = await cookies();
    const { id } = await params;
    const siteId = parseInt(id, 10);

    if (isNaN(siteId)) {
      return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
    }

    const site = await getSiteById(cookieStore, siteId);
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const role = await getUserRole(cookieStore, site.team_id);
    if (!role || role === 'viewer') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    // Validate URL if provided
    if (body.url) {
      try {
        new URL(body.url);
      } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
      }
    }

    // ─── Schedule update path ─────────────────────────────────────────
    // Detect whether any schedule-shaped field was sent.
    const hasScheduleFields =
      body.frequency !== undefined ||
      body.dayOfWeek !== undefined ||
      body.dayOfMonth !== undefined ||
      body.timeOfDay !== undefined ||
      body.notifyAI !== undefined ||
      body.notifySlack !== undefined ||
      body.notifyEmail !== undefined;

    if (hasScheduleFields) {
      const service = createServiceSupabase();

      // Find an existing schedule for this site. We use the JSON path
      // operator config->>siteId because siteId lives inside the jsonb
      // config column, and ->> casts the extracted value to text — so we
      // compare against the stringified id.
      const { data: existing, error: findError } = await service
        .from('integrations')
        .select('*')
        .eq('team_id', site.team_id)
        .eq('type', 'schedule')
        .eq('config->>siteId', String(siteId))
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError) {
        console.error('Schedule lookup error:', findError.message);
      }

      // Compose the new schedule config. Start from existing (preserving
      // anything we don't touch like createdBy / kind), then overwrite
      // with the fields the user sent.
      const baseCfg = existing?.config || { kind: 'scan', siteId, status: 'pending' };
      const nextCfg = { ...baseCfg, siteId };

      // Frequency + timing — only recompute scheduledAt if any of these changed
      if (
        body.frequency !== undefined ||
        body.dayOfWeek !== undefined ||
        body.dayOfMonth !== undefined ||
        body.timeOfDay !== undefined
      ) {
        const frequency = body.frequency ?? baseCfg.frequency ?? 'daily';
        // For 'once', oncePicker would be needed; this path handles
        // recurring schedules (the inline-edit form doesn't expose 'once').
        try {
          const computed = computeScheduledAt({
            frequency,
            oncePicker: null,
            dayOfWeek: body.dayOfWeek ?? 1,
            dayOfMonth: body.dayOfMonth ?? 1,
            timeOfDay: body.timeOfDay ?? '09:00',
          });
          nextCfg.scheduledAt = computed.toISOString();
          nextCfg.frequency = frequency;
          // Reset status when timing changes so the next occurrence fires fresh
          nextCfg.status = 'pending';
          nextCfg.error = null;
        } catch (err) {
          return NextResponse.json(
            { error: `Invalid schedule timing: ${err.message}` },
            { status: 400 }
          );
        }
      }

      // Notification flags — overwrite only if explicitly sent
      if (body.notifySlack !== undefined) nextCfg.notifySlack = !!body.notifySlack;
      if (body.notifyEmail !== undefined) nextCfg.notifyEmail = !!body.notifyEmail;
      if (body.notifyAI !== undefined) nextCfg.notifyAI = !!body.notifyAI;

      if (existing) {
        await service
          .from('integrations')
          .update({ config: nextCfg })
          .eq('id', existing.id);
      } else {
        await service.from('integrations').insert({
          team_id: site.team_id,
          type: 'schedule',
          config: nextCfg,
          enabled: true,
        });
      }

      // Make sure the site's scan_frequency reads 'custom' so the legacy
      // cron skips it. We override whatever scanFrequency was in the body.
      body.scanFrequency = 'custom';
    }

    // ─── Site update path ──────────────────────────────────────────────
    // Strip schedule-only fields before passing to updateSite — that helper
    // whitelists fields and would reject unknown keys.
    const { frequency, dayOfWeek, dayOfMonth, timeOfDay, notifyAI, notifySlack, notifyEmail, ...siteFields } = body;

    let updated = site;
    if (Object.keys(siteFields).length > 0) {
      try {
        updated = await updateSite(cookieStore, siteId, siteFields);
      } catch (err) {
        if (err.message !== 'No valid fields to update') throw err;
        // Site fields untouched — that's fine if only schedule changed.
      }
    }

    return NextResponse.json({ site: updated });
  } catch (error) {
    if (error.message === 'No valid fields to update') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('PATCH /api/sites/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update site' },
      { status: 500 }
    );
  }
}

// DELETE /api/sites/[id]
export async function DELETE(request, { params }) {
  try {
    const cookieStore = await cookies();
    const { id } = await params;
    const siteId = parseInt(id, 10);

    if (isNaN(siteId)) {
      return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
    }

    const site = await getSiteById(cookieStore, siteId);
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const role = await getUserRole(cookieStore, site.team_id);
    if (!role || role === 'viewer') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await deleteSite(cookieStore, siteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/sites/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete site' },
      { status: 500 }
    );
  }
}
