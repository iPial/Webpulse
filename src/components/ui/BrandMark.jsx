/**
 * <BrandMark> — Webpulse logo, inline SVG.
 *
 * A stylized "W" where the middle peak is replaced with an EKG-style
 * heartbeat spike. Reads as a W silhouette from a distance, as a pulse
 * waveform up close.
 *
 * Two color variants:
 *   - default (dark): ink-black square, lime stroke. Use anywhere with
 *     a light background.
 *   - inverse: lime square, ink-black stroke. Use on dark backgrounds
 *     where the dark square would disappear.
 *
 * Sizes any pixel value. Inline-rendered so it stays crisp at every
 * screen density without going through the favicon service or
 * next/image optimizer.
 */
export default function BrandMark({ size = 32, variant = 'default', className = '', title = 'Webpulse' }) {
  const inverse = variant === 'inverse';
  const bg = inverse ? '#D6FF3C' : '#0E0D10';
  const stroke = inverse ? '#0E0D10' : '#D6FF3C';

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      <rect width="100" height="100" rx="22" ry="22" fill={bg} />
      {/* W with a heartbeat spike replacing the middle apex.
          Outer strokes trace the W; inner zig-zag reads as EKG. */}
      <path
        d="M18 28 L32 72 L40 50 L46 30 L50 78 L54 30 L60 50 L68 72 L82 28"
        fill="none"
        stroke={stroke}
        strokeWidth="5.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
