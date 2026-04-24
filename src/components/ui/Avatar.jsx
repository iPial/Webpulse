/**
 * <Avatar> — circular team-member avatar with gradient fill.
 *
 * Used ONLY for people (team page). Not for sites — sites use <Logo>.
 * Color pair is derived deterministically from `name` via a small hash,
 * so the same person always gets the same color. No DB field needed.
 *
 * Props:
 *   name: string (required — used for initials + color seed)
 *   email?: string (optional fallback for initials if name is blank)
 *   size: 'sm' (28) | 'md' (40) | 'lg' (52)
 */

const PALETTES = [
  // [from, to, text]
  ['#D6FF3C', '#9EE036', '#1F2605'], // lime
  ['#FFC2AA', '#FF5C35', '#2A0C06'], // orange
  ['#CFC4FF', '#7B5CFF', '#13082E'], // violet
  ['#BEE5FF', '#6CB6E7', '#05263D'], // sky
  ['#FFC2D1', '#F095AE', '#4A0B25'], // rose
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickPalette(seed) {
  if (!seed) return PALETTES[0];
  return PALETTES[hash(seed) % PALETTES.length];
}

function initialsFrom(name, email) {
  const source = (name || email || '').trim();
  if (!source) return '?';
  const words = source.split(/[\s@._-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words[0].length > 1) return words[0].slice(0, 2).toUpperCase();
  return words[0][0].toUpperCase();
}

const SIZE_PX = { sm: 28, md: 40, lg: 52 };
const SIZE_FONT = { sm: 11, md: 14, lg: 18 };

export default function Avatar({ name, email, size = 'md', className = '' }) {
  const [from, to, text] = pickPalette(name || email || '');
  const px = SIZE_PX[size] || SIZE_PX.md;
  const font = SIZE_FONT[size] || SIZE_FONT.md;
  const initials = initialsFrom(name, email);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold shrink-0 shadow-1 ${className}`}
      style={{
        width: px,
        height: px,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        color: text,
        fontSize: font,
      }}
      aria-label={name || email || 'avatar'}
    >
      {initials}
    </span>
  );
}
