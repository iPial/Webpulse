import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase';

// GET /api/logs?type=&level=&limit=&before=<id>
// Returns { logs: [...] } filtered by the team the user belongs to (RLS).
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabase(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
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
