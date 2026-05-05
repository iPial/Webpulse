'use client';

import { useState } from 'react';
import Image from 'next/image';
import { resolveLogoUrl } from '@/lib/logos';

/**
 * <Logo> — site logo tile.
 *
 * Uses next/image so the source URL is auto-optimized: WebP/AVIF, srcset
 * for 1x/2x/3x, and high-quality server-side downsizing. This is what
 * makes the difference between a soft-looking 256px source rendered into
 * a 72px CSS box and a sharp one — Next picks the closest deviceSizes
 * variant and lets the browser render at native pixel mapping.
 *
 * Logos are resolved by src/lib/logos.js → custom logo_url (if set) →
 * Google's favicon service. No monograms.
 *
 * If the image fails to load, falls back to plain initials on a neutral
 * square (safe last-resort; should rarely trigger).
 *
 * Props:
 *   site: { id, name, url, logo_url }
 *   size: 'sm' (32) | 'md' (40) | 'lg' (44) | 'xl' (72)
 */

const SIZE_PX = { sm: 32, md: 40, lg: 44, xl: 72 };
const SIZE_RADIUS = { sm: 10, md: 12, lg: 12, xl: 20 };
const SIZE_FONT = { sm: 13, md: 15, lg: 16, xl: 28 };

function initialsFrom(site) {
  if (!site) return '?';
  const source = site.name || '';
  const words = source.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (words.length === 1 && words[0].length > 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  try {
    const host = new URL(site.url).hostname.replace(/^www\./, '');
    return host.slice(0, 2).toUpperCase();
  } catch {
    return '?';
  }
}

export default function Logo({ site, size = 'md', className = '' }) {
  const [errored, setErrored] = useState(false);
  const px = SIZE_PX[size] || SIZE_PX.md;
  const radius = SIZE_RADIUS[size] || SIZE_RADIUS.md;
  const font = SIZE_FONT[size] || SIZE_FONT.md;

  // For favicons (no logo_url), request 4× CSS size — this is just a hint
  // to Google's service for what to fetch from the source. next/image then
  // re-optimizes on top.
  const src = resolveLogoUrl(site, Math.max(128, px * 4));

  const frame = `inline-flex items-center justify-center overflow-hidden bg-surface border border-line shadow-1 shrink-0 relative ${className}`;
  const style = { width: px, height: px, borderRadius: radius };

  if (!src || errored) {
    return (
      <span
        className={`${frame} bg-paper-2 text-ink-2 font-semibold`}
        style={{ ...style, fontSize: font }}
        aria-label={site?.name || 'site logo'}
      >
        {initialsFrom(site)}
      </span>
    );
  }

  return (
    <span className={frame} style={style}>
      <Image
        src={src}
        alt={site?.name ? `${site.name} logo` : 'site logo'}
        // fill + sizes lets Next pick the optimal srcset entry for the
        // current viewport's deviceSizes. The `sizes={px}px` hint tells
        // Next how big the box actually is so it doesn't fetch a huge file.
        fill
        sizes={`${px}px`}
        // quality=100: logos are tiny (≤ a few KB) so encoding at max quality
        // costs nothing and preserves every pixel of source detail.
        quality={100}
        onError={() => setErrored(true)}
        style={{ objectFit: 'contain' }}
        // Logos are above-the-fold on most pages — no point lazy-loading.
        priority={size === 'xl'}
      />
    </span>
  );
}
