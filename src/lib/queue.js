import { Client } from '@upstash/qstash';

let qstashClient = null;

function getClient() {
  if (!qstashClient) {
    const token = process.env.QSTASH_TOKEN;
    if (!token) throw new Error('QSTASH_TOKEN is not set');

    // Pass baseUrl explicitly so EU / regional QStash accounts work.
    // SDK falls back to https://qstash.upstash.io (US) if omitted.
    const config = { token };
    if (process.env.QSTASH_URL) {
      config.baseUrl = process.env.QSTASH_URL;
    }
    qstashClient = new Client(config);
  }
  return qstashClient;
}

// Publish a single scan job to QStash
export async function enqueueScan(siteId, baseUrl) {
  const client = getClient();

  const result = await client.publishJSON({
    url: `${baseUrl}/api/scan/worker`,
    body: { siteId },
    retries: 3,
  });

  return result;
}

// Publish scan jobs for multiple sites.
// Uses individual publishJSON calls in parallel (same path as the
// known-working auto-fire) instead of batchJSON which has had delivery
// inconsistencies in our setup.
export async function enqueueBatchScans(siteIds, baseUrl) {
  const client = getClient();

  const results = await Promise.all(
    siteIds.map((siteId) =>
      client
        .publishJSON({
          url: `${baseUrl}/api/scan/worker`,
          body: { siteId },
          retries: 3,
        })
        .catch((err) => ({ error: err.message, siteId }))
    )
  );
  return results;
}

// Publish the notify job after scans complete.
// Scan workers run in parallel; each site's worker can take up to ~170s
// (90s first PSI attempt + retries for slow WP sites). Notify must wait
// long enough for workers to write scan_results before reading them.
// - Base: 200s (covers a worker's full retry budget)
// - Per site beyond 10: +10s (DB writes under parallel load)
// - Max: 290s (notify itself has 300s budget)
export async function enqueueNotify(teamSiteMap, baseUrl, scheduleOptions = {}) {
  const client = getClient();

  const totalSites = Object.values(teamSiteMap).flat().length;
  const delaySec = Math.min(290, Math.max(200, 200 + (totalSites - 10) * 10));

  const body = { teamSiteMap };

  // Pass schedule notification preferences if provided
  if (scheduleOptions.notifySlack !== undefined) body.notifySlack = scheduleOptions.notifySlack;
  if (scheduleOptions.notifyEmail !== undefined) body.notifyEmail = scheduleOptions.notifyEmail;
  if (scheduleOptions.notifyAI !== undefined) body.notifyAI = scheduleOptions.notifyAI;
  if (scheduleOptions.scheduleId) body.scheduleId = scheduleOptions.scheduleId;

  const result = await client.publishJSON({
    url: `${baseUrl}/api/scan/notify`,
    body,
    retries: 2,
    delay: delaySec,
  });

  return result;
}

// Enqueue a delayed message that fires a scheduled scan at the scheduled time.
// Uses `delay` (seconds from now) — simpler and less error-prone than absolute timestamps.
// If the scheduled time is in the past (or now), delay is 0 → fires immediately.
export async function enqueueScheduleFire(scheduleId, scheduledAt, baseUrl) {
  const client = getClient();
  const when = new Date(scheduledAt).getTime();
  const delaySec = Math.max(0, Math.floor((when - Date.now()) / 1000));

  const result = await client.publishJSON({
    url: `${baseUrl}/api/schedules/run`,
    body: { scheduleId },
    retries: 2,
    delay: delaySec,
  });

  return result;
}

// Verify that an incoming request is from QStash
// Returns the parsed JSON body if valid, throws on failure
export async function verifyQStashSignature(request) {
  const { Receiver } = await import('@upstash/qstash');

  const signingKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!signingKey || !nextSigningKey) {
    throw new Error('QStash signing keys not configured');
  }

  const receiver = new Receiver({
    currentSigningKey: signingKey,
    nextSigningKey: nextSigningKey,
  });

  // Clone request before reading body — Next.js may need the original
  const body = await request.clone().text();
  const signature = request.headers.get('upstash-signature');

  if (!signature) {
    throw new Error('Missing QStash signature');
  }

  // Receiver.verify throws on invalid signature
  await receiver.verify({
    signature,
    body,
    url: request.url,
  });

  return JSON.parse(body);
}
