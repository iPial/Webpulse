import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSiteById, getSiteHistory } from '@/lib/db';

// GET /api/history/[siteId]?limit=12
// Returns monthly snapshots for trend analysis
export async function GET(request, { params }) {
  try {
    const cookieStore = await cookies();
    const { siteId } = await params;
    const id = parseInt(siteId, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
    }

    // Verify user can access this site
    const site = await getSiteById(cookieStore, id);
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '12', 10);
    const safeLimit = Math.min(Math.max(1, limit), 24);

    const history = await getSiteHistory(cookieStore, id, { limit: safeLimit });
    return NextResponse.json({ site, history });
  } catch (error) {
    console.error('GET /api/history/[siteId] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site history' },
      { status: 500 }
    );
  }
}
