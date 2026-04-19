// Compute score deltas between the current scan row and the previous one.
// Returns null if base is missing.
export function computeDeltas(current, previous) {
  if (!current || !previous) return null;
  return {
    performance: safeDelta(current.performance, previous.performance),
    accessibility: safeDelta(current.accessibility, previous.accessibility),
    bestPractices: safeDelta(current.best_practices, previous.best_practices),
    seo: safeDelta(current.seo, previous.seo),
  };
}

function safeDelta(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  return a - b;
}

// Text format: "▲+5", "▼−3", "—" (for 0 or null)
export function formatDelta(delta) {
  if (delta === null || delta === undefined) return '—';
  if (delta === 0) return '—';
  return delta > 0 ? `▲+${delta}` : `▼${delta}`;
}

// Plain numeric + sign (for Slack / places where arrows might not render well)
export function formatDeltaPlain(delta) {
  if (delta === null || delta === undefined) return '—';
  if (delta === 0) return '—';
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function deltaColor(delta) {
  if (delta === null || delta === undefined || delta === 0) return 'neutral';
  return delta > 0 ? 'good' : 'bad';
}

// Maps a numeric delta to a Tailwind text-color class.
export function deltaTextColor(delta) {
  const c = deltaColor(delta);
  if (c === 'good') return 'text-green-400';
  if (c === 'bad') return 'text-red-400';
  return 'text-gray-500';
}
