import { NextResponse } from 'next/server';
import { verifyQStashSignature } from '@/lib/queue';
import { runNotifyPipeline } from '@/lib/notify';
import { logEvent } from '@/lib/logs';

// POST /api/scan/notify — called by QStash after scan jobs complete.
// Sends Slack + email + (optional) AI summaries; marks schedule completed.
export async function POST(request) {
  let body;
  try {
    body = await verifyQStashSignature(request);
  } catch (error) {
    console.error('QStash verification failed:', error.message);
    // Log so we can see this in /logs when QStash silently gives up
    await logEvent({
      teamId: null,
      type: 'notification',
      level: 'error',
      message: `QStash signature verification failed for /api/scan/notify: ${error.message}`,
      metadata: { error: error.message },
    }).catch(() => {});
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    teamSiteMap,
    notifySlack,
    notifyEmail,
    notifyAI,
    scheduleId,
  } = body || {};

  if (!teamSiteMap) {
    return NextResponse.json({ error: 'Missing teamSiteMap' }, { status: 400 });
  }

  try {
    const result = await runNotifyPipeline(teamSiteMap, {
      notifySlack,
      notifyEmail,
      notifyAI,
      scheduleId,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Notify pipeline error:', error);
    return NextResponse.json(
      { error: 'Notification failed', details: error.message },
      { status: 500 }
    );
  }
}
