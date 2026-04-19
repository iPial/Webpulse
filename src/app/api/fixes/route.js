import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase';
import { getSiteFixes, getSiteById, getUserRole } from '@/lib/db';

// GET /api/fixes?siteId=X
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabase(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const siteId = parseInt(new URL(request.url).searchParams.get('siteId'), 10);
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    const fixes = await getSiteFixes(cookieStore, siteId);
    return NextResponse.json({ fixes });
  } catch (err) {
    console.error('GET /api/fixes error:', err);
    return NextResponse.json({ error: 'Failed to load fixes', details: err.message }, { status: 500 });
  }
}

// PATCH /api/fixes
// Body: { id, status: 'pending' | 'fixed' }
export async function PATCH(request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabase(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { id, status } = body;
    if (!id || !['pending', 'fixed'].includes(status)) {
      return NextResponse.json({ error: 'id and status required' }, { status: 400 });
    }

    const service = createServiceSupabase();
    // Look up the row first to enforce team access
    const { data: row } = await service.from('site_fixes').select('id, site_id').eq('id', id).single();
    if (!row) return NextResponse.json({ error: 'Fix not found' }, { status: 404 });

    const site = await getSiteById(cookieStore, row.site_id);
    if (!site) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    const role = await getUserRole(cookieStore, site.team_id);
    if (!role || role === 'viewer') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const patch =
      status === 'fixed'
        ? { status: 'fixed', fixed_at: new Date().toISOString(), needs_reverify: false }
        : { status: 'pending', fixed_at: null, needs_reverify: false };

    const { data: updated, error: updateError } = await service
      .from('site_fixes')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ fix: updated });
  } catch (err) {
    console.error('PATCH /api/fixes error:', err);
    return NextResponse.json({ error: 'Failed to update fix', details: err.message }, { status: 500 });
  }
}
