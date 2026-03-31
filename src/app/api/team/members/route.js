import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ensureTeam, getUserRole } from '@/lib/db';
import { createServiceSupabase, createServerSupabase } from '@/lib/supabase';

// GET /api/team/members
// Returns all members of the current user's team
export async function GET() {
  try {
    const cookieStore = await cookies();
    const team = await ensureTeam(cookieStore);

    const supabase = createServiceSupabase();
    const { data: members, error } = await supabase
      .from('team_members')
      .select('id, role, invited_at, user_id')
      .eq('team_id', team.id)
      .order('invited_at', { ascending: true });

    if (error) throw error;

    // Fetch user emails from auth.users
    const enriched = [];
    for (const member of members) {
      const { data: { user } } = await supabase.auth.admin.getUserById(member.user_id);
      enriched.push({
        id: member.id,
        userId: member.user_id,
        email: user?.email || 'Unknown',
        role: member.role,
        joinedAt: member.invited_at,
      });
    }

    return NextResponse.json({ members: enriched, teamId: team.id, teamName: team.name });
  } catch (error) {
    console.error('GET /api/team/members error:', error);
    return NextResponse.json({ error: 'Failed to fetch members', details: error.message }, { status: 500 });
  }
}

// POST /api/team/members
// Body: { email, role? }
// Adds a user to the team by email
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const team = await ensureTeam(cookieStore);

    // Check requester is owner
    const role = await getUserRole(cookieStore, team.id);
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only team owners can add members' }, { status: 403 });
    }

    const body = await request.json();
    const { email, role: memberRole = 'viewer' } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!['admin', 'viewer'].includes(memberRole)) {
      return NextResponse.json({ error: 'Role must be admin or viewer' }, { status: 400 });
    }

    const supabase = createServiceSupabase();

    // Find user by email in auth.users
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const targetUser = users.find((u) => u.email === email);
    if (!targetUser) {
      return NextResponse.json(
        { error: 'No account found with that email. The user must sign up first.' },
        { status: 404 }
      );
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', team.id)
      .eq('user_id', targetUser.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'User is already a team member' }, { status: 409 });
    }

    // Remove them from their auto-created team (if they have one with only themselves)
    const { data: theirTeams } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', targetUser.id);

    for (const t of theirTeams || []) {
      if (t.team_id === team.id) continue;
      const { data: memberCount } = await supabase
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', t.team_id);

      // If they're the only member, delete that empty team
      if (memberCount?.length <= 1) {
        await supabase.from('team_members').delete().eq('team_id', t.team_id).eq('user_id', targetUser.id);
        await supabase.from('teams').delete().eq('id', t.team_id);
      }
    }

    // Add to this team
    const { error: insertError } = await supabase
      .from('team_members')
      .insert({ team_id: team.id, user_id: targetUser.id, role: memberRole });

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      member: { userId: targetUser.id, email: targetUser.email, role: memberRole },
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/team/members error:', error);
    return NextResponse.json({ error: 'Failed to add member', details: error.message }, { status: 500 });
  }
}

// DELETE /api/team/members
// Body: { userId }
export async function DELETE(request) {
  try {
    const cookieStore = await cookies();
    const team = await ensureTeam(cookieStore);

    const role = await getUserRole(cookieStore, team.id);
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only team owners can remove members' }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Don't allow removing yourself
    const supabase = createServerSupabase(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id === userId) {
      return NextResponse.json({ error: 'Cannot remove yourself from the team' }, { status: 400 });
    }

    const service = createServiceSupabase();
    const { error } = await service
      .from('team_members')
      .delete()
      .eq('team_id', team.id)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/team/members error:', error);
    return NextResponse.json({ error: 'Failed to remove member', details: error.message }, { status: 500 });
  }
}

// PATCH /api/team/members
// Body: { userId, role }
export async function PATCH(request) {
  try {
    const cookieStore = await cookies();
    const team = await ensureTeam(cookieStore);

    const role = await getUserRole(cookieStore, team.id);
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only team owners can change roles' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role: newRole } = body;

    if (!userId || !newRole) {
      return NextResponse.json({ error: 'userId and role are required' }, { status: 400 });
    }

    if (!['admin', 'viewer'].includes(newRole)) {
      return NextResponse.json({ error: 'Role must be admin or viewer' }, { status: 400 });
    }

    const service = createServiceSupabase();
    const { error } = await service
      .from('team_members')
      .update({ role: newRole })
      .eq('team_id', team.id)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true, role: newRole });
  } catch (error) {
    console.error('PATCH /api/team/members error:', error);
    return NextResponse.json({ error: 'Failed to update role', details: error.message }, { status: 500 });
  }
}
