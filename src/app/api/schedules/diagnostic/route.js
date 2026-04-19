import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase';
import { logEvent } from '@/lib/logs';
import { ensureTeam } from '@/lib/db';

// POST /api/schedules/diagnostic
// Checks QStash env vars + enqueues a delayed ping to verify the round-trip.
// Returns JSON the frontend can show directly.
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabase(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const team = await ensureTeam(cookieStore);

    const qstashToken = !!process.env.QSTASH_TOKEN;
    const qstashSigning = !!(process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY);

    let baseUrl = null;
    let baseUrlSource = null;
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
      baseUrlSource = 'NEXT_PUBLIC_SITE_URL';
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
      baseUrlSource = 'VERCEL_URL';
    } else {
      const host = request.headers.get('host');
      baseUrl = host ? `${host.includes('localhost') ? 'http' : 'https'}://${host}` : null;
      baseUrlSource = 'request-host';
    }

    const diagnostic = {
      qstashToken,
      qstashSigning,
      qstashUrl: process.env.QSTASH_URL || '(default: https://qstash.upstash.io)',
      baseUrl,
      baseUrlSource,
      testFire: { attempted: false, ok: false },
    };

    await logEvent({
      teamId: team.id,
      type: 'system',
      level: 'info',
      message: 'Diagnostic check started',
      metadata: { qstashToken, qstashSigning, baseUrl, baseUrlSource, triggeredBy: user.email },
    });

    if (!qstashToken || !baseUrl) {
      diagnostic.testFire.ok = false;
      diagnostic.testFire.error = !qstashToken
        ? 'QSTASH_TOKEN not set in environment'
        : 'Base URL not determined (set NEXT_PUBLIC_SITE_URL)';

      await logEvent({
        teamId: team.id,
        type: 'system',
        level: 'error',
        message: `Diagnostic cannot run: ${diagnostic.testFire.error}`,
        metadata: diagnostic,
      });

      return NextResponse.json(diagnostic);
    }

    // Attempt real QStash publish with 10s delay
    try {
      const { Client } = await import('@upstash/qstash');
      const clientConfig = { token: process.env.QSTASH_TOKEN };
      if (process.env.QSTASH_URL) clientConfig.baseUrl = process.env.QSTASH_URL;
      const client = new Client(clientConfig);
      const res = await client.publishJSON({
        url: `${baseUrl}/api/logs/ping`,
        body: { teamId: team.id, diagnostic: true, enqueuedAt: new Date().toISOString() },
        delay: 10,
        retries: 1,
      });

      diagnostic.testFire = {
        attempted: true,
        ok: true,
        messageId: res?.messageId || null,
        note: 'Ping enqueued. Wait ~15s and refresh Logs to see the ping arrive.',
      };

      await logEvent({
        teamId: team.id,
        type: 'system',
        level: 'info',
        message: 'Diagnostic ping enqueued via QStash (delay 10s)',
        metadata: { messageId: res?.messageId, baseUrl },
      });
    } catch (err) {
      diagnostic.testFire = {
        attempted: true,
        ok: false,
        error: err.message,
      };

      await logEvent({
        teamId: team.id,
        type: 'system',
        level: 'error',
        message: `QStash publish failed: ${err.message}`,
        metadata: { baseUrl },
      });
    }

    return NextResponse.json(diagnostic);
  } catch (err) {
    console.error('Diagnostic error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
