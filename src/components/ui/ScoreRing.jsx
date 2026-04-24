/**
 * <ScoreRing> — conic-gradient score ring (redesign).
 *
 * Uses the `.score-ring` class from globals.css, which reads `--pct` and `--col`
 * from inline style. Color auto-selected by Lighthouse convention:
 *   >=90 → good (green), 50–89 → warn (amber), <50 → bad (orange)
 *
 * Sizes: default 88, site-detail hero uses 120.
 *
 * Usage:
 *   <ScoreRing score={43} />
 *   <ScoreRing score={87} size={120} showLabel="Performance" />
 */

function scoreColor(score) {
  if (score >= 90) return 'var(--good)';
  if (score >= 50) return 'var(--warn)';
  return 'var(--bad)';
}

function scoreTextClass(score) {
  if (score >= 90) return 'text-good';
  if (score >= 50) return 'text-warn';
  return 'text-bad';
}

// Font sizing inside the ring should scale with the ring.
function numberFontSize(size) {
  return Math.round(size * 0.38); // 88px → 34px, 120px → 46px
}

export default function ScoreRing({
  score = 0,
  size = 88,
  label,
  className = '',
}) {
  // Clamp to 0–100 to avoid gradient glitches on bad data.
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  const col = scoreColor(pct);
  const numCls = scoreTextClass(pct);

  return (
    <div className={`inline-flex flex-col items-center gap-[8px] ${className}`}>
      <div
        className="score-ring"
        style={{
          '--pct': pct,
          '--col': col,
          '--size': `${size}px`,
        }}
        role="img"
        aria-label={label ? `${label}: ${pct}` : `Score ${pct}`}
      >
        <span
          className={`font-serif leading-none tracking-tight ${numCls}`}
          style={{ fontSize: `${numberFontSize(size)}px` }}
        >
          {pct}
        </span>
      </div>
      {label && (
        <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
          {label}
        </span>
      )}
    </div>
  );
}
