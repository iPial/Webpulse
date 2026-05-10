'use client';

import { useEffect, useState } from 'react';

// <LocalTime iso="..." format="compact" />
//
// Renders an ISO timestamp in the *browser's* local timezone, with a
// hover tooltip showing the unambiguous full date + zone name.
//
// Why this component exists:
//   Most pages on this site are server components. Vercel's Node
//   runtime is UTC, so a `toLocaleString` call during SSR produces a
//   UTC-formatted string — which then ships in the HTML and is what
//   users see on first paint. Even on `'use client'` components, the
//   SSR pass still runs the function in UTC.
//
//   By formatting inside a useEffect (which only runs in the browser
//   after hydration) we guarantee the displayed text is always in the
//   viewer's own zone, no matter where the server ran.
//
// To avoid layout shift on initial paint, we render the same compact
// format on the server (UTC) and replace it with the local version
// after mount. The brief mismatch is silenced via
// suppressHydrationWarning.

const FORMATS = {
  // "May 10, 07:08 AM"
  compact: { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  // "May 10, 2026, 7:08 AM"
  datetime: { dateStyle: 'medium', timeStyle: 'short' },
  // "May 10, 2026, 7:08:25 AM Bangladesh Standard Time"
  full: { dateStyle: 'medium', timeStyle: 'long' },
  // "May 10, 2026"
  date: { dateStyle: 'medium' },
  // The default `toLocaleString()` (locale-and-zone-aware, full date+time).
  default: null,
};

function safeFormat(iso, opts) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return opts ? d.toLocaleString(undefined, opts) : d.toLocaleString();
}

export default function LocalTime({ iso, format = 'compact', className = '' }) {
  const opts = FORMATS[format] !== undefined ? FORMATS[format] : FORMATS.compact;

  // Initial render uses whichever zone the runtime is in (UTC on the
  // server, local on the client). After mount we re-format from the
  // browser, which is always local.
  const [text, setText] = useState(() => safeFormat(iso, opts));
  const [title, setTitle] = useState(() => safeFormat(iso, FORMATS.full));

  useEffect(() => {
    setText(safeFormat(iso, opts));
    setTitle(safeFormat(iso, FORMATS.full));
  }, [iso, format]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!iso) return null;
  return (
    <span className={className} suppressHydrationWarning title={title}>
      {text}
    </span>
  );
}
