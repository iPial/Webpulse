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

// Publish scan jobs for multiple sites
export async function enqueueBatchScans(siteIds, baseUrl) {
  const client = getClient();

  const messages = siteIds.map((siteId) => ({
    url: `${baseUrl}/api/scan/worker`,
    body: { siteId },
    retries: 3,
  }));

  // QStash batch endpoint — sends all messages in one API call
  const results = await client.batchJSON(messages);
  return results;
}

// Publish the notify job after scans complete
// Delay scales with site count: each site takes ~15-30s to scan.
// QStash processes in parallel, but we add buffer for API latency + DB writes.
// If notify runs before all scans finish, it will still report whatever has landed.
export async function enqueueNotify(teamSiteMap, baseUrl, scheduleOptions = {}) {
  const client = getClient();

  const totalSites = Object.values(teamSiteMap).flat().length;
  // Min 60s, +5s per site beyond 10, max 300s (5 min)
  const delaySec = Math.min(300, Math.max(60, 60 + (totalSites - 10) * 5));

  const body = { teamSiteMap };

  // Pass schedule notification preferences if provided
  if (scheduleOptions.notifySlack !== undefined) body.notifySlack = scheduleOptions.notifySlack;
  if (scheduleOptions.notifyEmail !== undefined) body.notifyEmail = scheduleOptions.notifyEmail;
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
