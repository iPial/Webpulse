/**
 * <LineChart> — multi-series line chart with gridlines and x/y labels.
 * Port of renderMulti() from webpulse-redesign/assets/app.js.
 *
 * Props:
 *   series: [{ name, color, points: number[] }]
 *   labels: string[] — x-axis labels, same length as each series.points
 *   min / max: y-axis bounds (default: auto from data, floor 0 / ceil 100)
 *   height: px (default 220)
 *   background: 'light' (default) | 'ink' — adjusts grid/label colors for dark cards
 */

const LIGHT = {
  grid: 'rgba(14,13,16,0.07)',
  yLabel: 'rgba(14,13,16,0.45)',
  xLabel: 'rgba(14,13,16,0.5)',
  pointFill: 'var(--surface)',
};
const INK = {
  grid: 'rgba(255,255,255,0.08)',
  yLabel: 'rgba(255,255,255,0.55)',
  xLabel: 'rgba(255,255,255,0.6)',
  pointFill: 'var(--ink)',
};

export default function LineChart({
  series = [],
  labels = [],
  min,
  max,
  height = 220,
  background = 'light',
  className = '',
}) {
  if (!Array.isArray(series) || series.length === 0) {
    return <svg className={className} style={{ width: '100%', height }} />;
  }

  const w = 600;
  const h = height;
  const padL = 36, padR = 16, padT = 16, padB = 28;
  const theme = background === 'ink' ? INK : LIGHT;

  const allVals = series.flatMap((s) => s.points || []);
  const yMin = min !== undefined ? min : Math.min(...allVals, 0);
  const yMax = max !== undefined ? max : Math.max(...allVals, 100);
  const yRange = yMax - yMin || 1;

  const len = Math.max(...series.map((s) => s.points?.length || 0));
  const stepX = (w - padL - padR) / Math.max(1, len - 1);

  // Gridlines + y-labels
  const gridlines = [];
  for (let i = 0; i <= 4; i++) {
    const y = padT + ((h - padT - padB) * i) / 4;
    gridlines.push(
      <g key={`g${i}`}>
        <line
          x1={padL} x2={w - padR} y1={y} y2={y}
          stroke={theme.grid} strokeDasharray="3 4"
        />
        <text
          x={padL - 8} y={y + 4}
          textAnchor="end" fontSize="10"
          fill={theme.yLabel}
          fontFamily="var(--font-mono), monospace"
        >
          {Math.round(yMax - (yRange * i) / 4)}
        </text>
      </g>
    );
  }

  // X labels — render every ceil(len/6)-th label plus the last
  const xStep = labels.length ? Math.ceil(labels.length / 6) : 1;
  const xLabels = labels.map((lab, i) => {
    if (i % xStep !== 0 && i !== labels.length - 1) return null;
    const x = padL + i * stepX;
    return (
      <text
        key={`x${i}`} x={x} y={h - 8}
        textAnchor="middle" fontSize="10"
        fill={theme.xLabel}
        fontFamily="var(--font-mono), monospace"
      >
        {lab}
      </text>
    );
  });

  // Each series
  const seriesEls = series.map((s, si) => {
    const pts = (s.points || []).map((v, i) => [
      padL + i * stepX,
      padT + (h - padT - padB) - ((v - yMin) / yRange) * (h - padT - padB),
    ]);
    const d = 'M ' + pts.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join(' L ');

    return (
      <g key={s.name || si}>
        <path
          d={d} fill="none" stroke={s.color}
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        />
        {pts.map((p, pi) => (
          <circle
            key={pi} cx={p[0]} cy={p[1]} r="3"
            fill={theme.pointFill} stroke={s.color} strokeWidth="1.6"
          />
        ))}
      </g>
    );
  });

  return (
    <svg
      className={className}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block' }}
      aria-hidden="true"
    >
      {gridlines}
      {xLabels}
      {seriesEls}
    </svg>
  );
}
