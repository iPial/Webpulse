import { NextResponse } from 'next/server';
import { logEvent } from '@/lib/logs';

// POST /api/logs/ping
// Called by the QStash diagnostic job. Just logs a "ping received" event
// to prove the QStash round-trip works end-to-end.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await logEvent({
      teamId: body.teamId || null,
      type: 'system',
      level: 'info',
      message: 'Diagnostic ping received — QStash round-trip OK',
      metadata: {
        source: 'diagnostic',
        receivedAt: new Date().toISOString(),
        ...body,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
