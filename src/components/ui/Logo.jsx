'use client';

import { useState } from 'react';
import { resolveLogoUrl } from '@/lib/logos';

/**
 * <Logo> — site logo tile.
 *
 * Logos are resolved by src/lib/logos.js → custom logo_url (if set) → Google favicon.
 * No monograms, no gradients — just a rounded frame around whatever comes back.
 * If the image fails to load, falls back to plain initials on a neutral square
 * (safe last-resort; should rarely trigger since the favicon service almost always responds).
 *
 * Props:
 *   site: { id, name, url, logo_url }
 *   size: 'sm' (32) | 'md' (40) | 'lg' (44) | 'xl' (72)
 *
 * Usage:
 *   <Logo site={site} size="md" />
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
  // Scale the favicon request to match render size (retina-safe)
  const src = resolveLogoUrl(site, Math.max(64, px * 2));

  const frame = `inline-flex items-center justify-center overflow-hidden bg-surface border border-line shadow-1 shrink-0 ${className}`;
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
    // Using native <img> so the favicon fallback doesn't require next.config image
    // remote patterns config. resolveLogoUrl returns either a user-supplied URL
    // or Google's favicon service — both work fine as plain <img>.
    // eslint-disable-next-line @next/next/no-img-element
    <span className={frame} style={style}>
      <img
        src={src}
        alt={site?.name ? `${site.name} logo` : 'site logo'}
        width={px}
        height={px}
        onError={() => setErrored(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </span>
  );
}
