import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSiteById, getSiteResults } from '@/lib/db';

// GET /api/results/[siteId]?limit=10
// Returns scan history for a specific site
export async function GET(request, { params }) {
  try {
    const cookieStore = await cookies();
    const { siteId } = await params;
    const id = parseInt(siteId, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
    }

    // Verify user can access this site (RLS handles it, but 404 is better UX)
    const site = await getSiteById(cookieStore, id);
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const safeLimit = Math.min(Math.max(1, limit), 100);

    const results = await getSiteResults(cookieStore, id, { limit: safeLimit });
    return NextResponse.json({ site, results });
  } catch (error) {
    console.error('GET /api/results/[siteId] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site results' },
      { status: 500 }
    );
  }
}
