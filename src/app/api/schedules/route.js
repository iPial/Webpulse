import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase';
import { getUserTeams } from '@/lib/db';
import { logEvent } from '@/lib/logs';

// GET /api/schedules?teamId=xxx
// List all schedules (integrations where type='schedule') for the team
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const { searchParams } = new URL(request.url);
    let teamId = searchParams.get('teamId');

    if (!teamId) {
      const teams = await getUserTeams(cookieStore);
      if (teams.length === 0) {
        return NextResponse.json({ error: 'No team found' }, { status: 404 });
      }
      teamId = teams[0].id;
    }

    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('team_id', teamId)
      .eq('type', 'schedule')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ schedules: data });
  } catch (error) {
    console.error('Schedules GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedules', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/schedules
// Create a new schedule
// Body: { teamId, scheduledAt, frequency, notifySlack, notifyEmail }
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabase(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, scheduledAt, frequency, notifySlack, notifyEmail, notifyAI } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    if (!scheduledAt) {
      return NextResponse.json({ error: 'scheduledAt is required' }, { status: 400 });
    }

    // Validate the date
    const scheduleDate = new Date(scheduledAt);
    if (isNaN(scheduleDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const config = {
      scheduledAt: scheduleDate.toISOString(),
      frequency: frequency || 'once',
      notifySlack: !!notifySlack,
      notifyEmail: !!notifyEmail,
      notifyAI: !!notifyAI,
      status: 'pending',
      createdBy: user.id,
    };

    const service = createServiceSupabase();
    const { data, error } = await service
      .from('integrations')
      .insert({
        team_id: teamId,
        type: 'schedule',
        config,
        enabled: true,
      })
      .select()
      .single();

    if (error) throw error;

    await logEvent({
      teamId,
      type: 'schedule',
      level: 'info',
      message: `Schedule #${data.id} created for ${scheduleDate.toISOString()}`,
      metadata: {
        scheduleId: data.id,
        scheduledAt: scheduleDate.toISOString(),
        frequency: config.frequency,
        notifySlack: config.notifySlack,
        notifyEmail: config.notifyEmail,
        notifyAI: config.notifyAI,
        createdBy: user.email,
      },
    });

    // Try to enqueue a QStash delayed job that fires at the scheduled time.
    // Best-effort: if QStash is unconfigured, the user can still use "Run Now".
    let autoFireStatus = 'none';
    try {
      const { enqueueScheduleFire } = await import('@/lib/queue');
      const baseUrl = getBaseUrl(request);
      const result = await enqueueScheduleFire(data.id, scheduleDate, baseUrl);
      autoFireStatus = 'queued';
      await logEvent({
        teamId,
        type: 'schedule',
        level: 'info',
        message: `QStash auto-fire queued for schedule #${data.id}`,
        metadata: { scheduleId: data.id, baseUrl, messageId: result?.messageId || null },
      });
    } catch (qstashErr) {
      console.error('Failed to enqueue auto-fire (schedule still created):', qstashErr.message);
      autoFireStatus = `failed: ${qstashErr.message}`;
      await logEvent({
        teamId,
        type: 'schedule',
        level: 'error',
        message: `QStash auto-fire failed for schedule #${data.id}: ${qstashErr.message}`,
        metadata: { scheduleId: data.id, error: qstashErr.message, hint: 'Use "Run Now" to trigger manually. Check QSTASH_TOKEN / NEXT_PUBLIC_SITE_URL env vars in Vercel.' },
      });
    }

    return NextResponse.json({ schedule: data, autoFire: autoFireStatus }, { status: 201 });
  } catch (error) {
    console.error('Schedules POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create schedule', details: error.message },
      { status: 500 }
    );
  }
}

function getBaseUrl(request) {
  // Prefer explicit env var for production (avoids Vercel preview URL issues)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  const host = request.headers.get('host');
  const protocol = host?.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

// PATCH /api/schedules
// Body: { id, action: 'reset' }
// Resets a schedule's status back to 'pending' so it can be retried.
export async function PATCH(request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabase(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { id, action } = body;

    if (!id || action !== 'reset') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const service = createServiceSupabase();
    const { data: existing } = await service
      .from('integrations')
      .select('*')
      .eq('id', id)
      .eq('type', 'schedule')
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const cfg = existing.config || {};
    const { data: updated, error: updateError } = await service
      .from('integrations')
      .update({
        config: {
          ...cfg,
          status: 'pending',
          error: null,
          runStartedAt: null,
          staleReclaimedAt: null,
        },
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logEvent({
      teamId: existing.team_id,
      type: 'schedule',
      level: 'info',
      message: `Schedule #${id} reset to pending by ${user.email}`,
      metadata: { scheduleId: id, resetBy: user.email },
    });

    return NextResponse.json({ schedule: updated });
  } catch (error) {
    console.error('Schedules PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to reset schedule', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/schedules?id=xxx
// Delete a schedule by integration id
export async function DELETE(request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabase(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Schedule id is required' }, { status: 400 });
    }

    const service = createServiceSupabase();
    const { error } = await service
      .from('integrations')
      .delete()
      .eq('id', id)
      .eq('type', 'schedule');

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedules DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete schedule', details: error.message },
      { status: 500 }
    );
  }
}
