import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase';
import { getUserTeams } from '@/lib/db';

// GET /api/logs?type=&level=&limit=&before=<id>
// Returns { logs: [...] } scoped to the user's team(s). Belt-and-suspenders:
// RLS on event_logs already restricts SELECTs to the user's teams, but we
// also explicitly filter by team_id here so the boundary is obvious in
// code review (and to make sure orphan rows with team_id IS NULL never
// leak — they were the cause of brand-new users seeing months of
// unrelated system error logs on /logs).
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabase(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Resolve the caller's teams. New users with no team yet get an
    // empty list back instead of leaking system-wide rows.
    const teams = await getUserTeams(cookieStore);
    const teamIds = (teams || []).map((t) => t.id);
    if (teamIds.length === 0) {
      return NextResponse.json({ logs: [] });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const level = searchParams.get('level');
    const before = searchParams.get('before');
    const limitRaw = parseInt(searchParams.get('limit') || '100', 10);
    const limit = Math.min(Math.max(limitRaw, 1), 200);

    let query = supabase
      .from('event_logs')
      .select('*')
      .in('team_id', teamIds)
      .order('id', { ascending: false })
      .limit(limit);

    if (type && type !== 'all') query = query.eq('type', type);
    if (level && level !== 'all') query = query.eq('level', level);
    if (before) query = query.lt('id', parseInt(before, 10));

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ logs: data || [] });
  } catch (err) {
    console.error('GET /api/logs error:', err);
    return NextResponse.json({ error: 'Failed to fetch logs', details: err.message }, { status: 500 });
  }
}
