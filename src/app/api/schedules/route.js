import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase';
import { getUserTeams } from '@/lib/db';

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
    const { teamId, scheduledAt, frequency, notifySlack, notifyEmail } = body;

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

    return NextResponse.json({ schedule: data }, { status: 201 });
  } catch (error) {
    console.error('Schedules POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create schedule', details: error.message },
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
