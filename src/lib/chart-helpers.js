// Shared helpers for chart rendering — small pure functions used by both
// server components (history page) and client components (SiteProgress).

// Compute a sensible y-axis max for an FCP/LCP-style "lower is better"
// chart. The old behavior forced a 25-second minimum so the axis could
// always fit slow mobile scans; that broke desktop charts where values
// of 1–2s clustered at the very bottom of a 0–25 axis. Now we size the
// max to the actual data with ~20% headroom and a small floor so a
// flat 0.5s line still has visible space above it.
export function computeVitalsYMax(series) {
  if (!series?.length) return 5;
  const allValues = series.flatMap((s) => s.points || []).filter((v) => v != null);
  if (!allValues.length) return 5;
  const max = Math.max(...allValues);
  // headroom: 20% of max, with a minimum of 1 unit so tight ranges still breathe
  const padded = max + Math.max(1, max * 0.2);
  // floor of 3 so charts with tiny values (e.g. desktop FCP 0.4s) aren't
  // unreadably zoomed-in
  return Math.max(3, Math.ceil(padded));
}

// Parse a vital displayValue like "6.8 s", "2,170 ms", or "0.043" into
// a numeric seconds value. Useful for feeding raw scan_results rows
// into the Core Web Vitals trend chart.
export function parseVitalSeconds(displayValue) {
  if (!displayValue) return null;
  const s = String(displayValue).toLowerCase().replace(/,/g, '').trim();
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  if (s.endsWith('ms')) return n / 1000;
  if (s.endsWith('s')) return n;
  return n;
}
