'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * <BarChart> — simple vertical bar chart with sparse x-labels.
 * Port of renderBars() from webpulse-redesign/assets/app.js.
 *
 * Measures container at runtime and renders SVG at actual pixel width so
 * font sizes and bar widths stay correct across viewports.
 *
 * Props:
 *   bars: [{ label, value, color }]
 *   max: y-axis max (default: auto, min 100)
 *   height: px (default 160)
 */
export default function BarChart({ bars = [], max, height = 160, className = '' }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(Math.max(200, Math.round(el.clientWidth)));

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const next = Math.max(200, Math.round(entry.contentRect.width));
      setWidth((prev) => (prev === next ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!Array.isArray(bars) || bars.length === 0) {
    return (
      <div ref={containerRef} className={className} style={{ width: '100%', height }} />
    );
  }

  const w = width;
  const h = height;
  const padL = 28, padR = 8, padT = 12, padB = 22;
  const yMax = max !== undefined ? max : Math.max(...bars.map((d) => d.value || 0), 100);
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const barW = innerW / bars.length - 6;

  const labelStep = Math.ceil(bars.length / 7);

  return (
    <div ref={containerRef} className={className} style={{ width: '100%' }}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ display: 'block' }}
        aria-hidden="true"
      >
        <line
          x1={padL} x2={w - padR} y1={h - padB} y2={h - padB}
          stroke="rgba(14,13,16,0.1)"
        />
        {bars.map((d, i) => {
          const x = padL + i * (innerW / bars.length) + 3;
          const bh = ((d.value || 0) / yMax) * innerH;
          const y = h - padB - bh;
          const showLabel = d.label && (i % labelStep === 0 || i === bars.length - 1);

          return (
            <g key={i}>
              <rect
                x={x} y={y}
                width={Math.max(0, barW)} height={Math.max(0, bh)}
                rx="4"
                fill={d.color || 'var(--ink)'}
              />
              {showLabel && (
                <text
                  x={x + barW / 2} y={h - 6}
                  textAnchor="middle" fontSize="10"
                  fill="rgba(14,13,16,0.5)"
                  fontFamily="var(--font-mono), monospace"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
