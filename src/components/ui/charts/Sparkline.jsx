/**
 * <Sparkline> — single-line sparkline with area fill.
 * Port of renderSpark() from webpulse-redesign/assets/app.js.
 *
 * Props:
 *   data: number[] — at least 2 points recommended
 *   color: CSS color string (default --ink)
 *   height: px (default 60)
 *
 * The SVG fills its container's width via viewBox + preserveAspectRatio="none",
 * so no ResizeObserver is needed.
 */
export default function Sparkline({
  data = [],
  color = 'currentColor',
  height = 60,
  className = '',
}) {
  if (!Array.isArray(data) || data.length < 2) {
    return <svg className={className} style={{ width: '100%', height }} />;
  }

  const w = 300; // viewBox width; scales via preserveAspectRatio
  const h = height;
  const pad = 4;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 1);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / Math.max(1, data.length - 1);

  const pts = data.map((v, i) => [
    pad + i * stepX,
    h - pad - ((v - min) / range) * (h - pad * 2),
  ]);

  const d = 'M ' + pts.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join(' L ');
  const area = `${d} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg
      className={className}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block' }}
      aria-hidden="true"
    >
      <path d={area} fill={color} className="spark-area" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}
