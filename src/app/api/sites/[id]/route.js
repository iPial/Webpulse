import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSiteById, updateSite, deleteSite, getUserRole } from '@/lib/db';

// PATCH /api/sites/[id]
// Body: { name?, url?, enabled?, scanFrequency?, tags? }
export async function PATCH(request, { params }) {
  try {
    const cookieStore = await cookies();
    const { id } = await params;
    const siteId = parseInt(id, 10);

    if (isNaN(siteId)) {
      return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
    }

    // Verify user can access this site
    const site = await getSiteById(cookieStore, siteId);
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Check user has admin/owner role
    const role = await getUserRole(cookieStore, site.team_id);
    if (!role || role === 'viewer') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate URL if provided
    if (body.url) {
      try {
        new URL(body.url);
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }
    }

    const updated = await updateSite(cookieStore, siteId, body);
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

    // Verify user can access this site
    const site = await getSiteById(cookieStore, siteId);
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Check user has admin/owner role
    const role = await getUserRole(cookieStore, site.team_id);
    if (!role || role === 'viewer') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
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
