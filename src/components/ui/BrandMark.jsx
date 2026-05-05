/**
 * <BrandMark> — Webpulse logo, inline SVG.
 *
 * Filled navy W with a lime EKG/heartbeat pulse line passing through it
 * horizontally, terminating in a glowing dot. Transparent background so
 * the mark adapts to whatever sits behind it (paper, ink, etc).
 *
 * Two variants:
 *   - default: navy W (#1F2D44), lime pulse + dot. Use on light/paper
 *     backgrounds.
 *   - inverse: paper-colored W, same lime pulse. Use on dark backgrounds
 *     where the navy W would disappear.
 *
 * Inline-rendered so it stays crisp at every size — no favicon-service
 * round-trip, no next/image optimization needed.
 */
export default function BrandMark({ size = 32, variant = 'default', className = '', title = 'Webpulse' }) {
  const inverse = variant === 'inverse';
  const wColor = inverse ? '#FFFDF8' : '#1F2D44'; // paper / navy
  const pulseColor = '#D6FF3C'; // lime — same in both variants

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      {/* W silhouette — drawn as a thick mitered stroke so it reads as a
          filled solid shape with sharp corners. Cleaner than a 10-vertex
          polygon and easier to tweak weight. */}
      <path
        d="M12 22 L34 78 L50 35 L66 78 L88 22"
        fill="none"
        stroke={wColor}
        strokeWidth="22"
        strokeLinejoin="miter"
        strokeMiterlimit="4"
        strokeLinecap="butt"
      />
      {/* Pulse line — flat baseline, sharp R-spike up, then S-trough down,
          back to baseline. Classic EKG-style profile. */}
      <path
        d="M22 50 L40 50 L45 35 L50 75 L55 35 L60 50 L80 50"
        fill="none"
        stroke={pulseColor}
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Terminal dot — visual anchor at the end of the pulse line, like
          the trailing dot on a heartbeat monitor. */}
      <circle cx="84" cy="50" r="4" fill={pulseColor} />
    </svg>
  );
}
