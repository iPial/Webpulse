'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * <Sparkline> — single-line sparkline with area fill.
 * Port of renderSpark() from webpulse-redesign/assets/app.js.
 *
 * Renders at the container's actual pixel width so the line/dot proportions
 * match the design across all viewport widths.
 *
 * Props:
 *   data: number[] — at least 2 points recommended
 *   color: CSS color string (default currentColor)
 *   height: px (default 60)
 */
export default function Sparkline({
  data = [],
  color = 'currentColor',
  height = 60,
  className = '',
}) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(300);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(Math.max(60, Math.round(el.clientWidth)));

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const next = Math.max(60, Math.round(entry.contentRect.width));
      setWidth((prev) => (prev === next ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!Array.isArray(data) || data.length < 2) {
    return (
      <div ref={containerRef} className={className} style={{ width: '100%', height }} />
    );
  }

  const w = width;
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
    <div ref={containerRef} className={className} style={{ width: '100%' }}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ display: 'block' }}
        aria-hidden="true"
      >
        <path d={area} fill={color} className="spark-area" />
        <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
      </svg>
    </div>
  );
}
