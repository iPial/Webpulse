'use client';

import Link from 'next/link';

/**
 * <Tabs> — pill-shaped tab group.
 *
 * Two flavors:
 *   - Link-based (Settings header: /settings, /settings/team, /settings/integrations)
 *     Pass `items={[{ label, href }]}` and `currentPath` (the string to match against href).
 *
 *   - State-based (Critical / Improve / Passed filters)
 *     Pass `items={[{ label, value, count? }]}`, `value` (active value), and `onChange(value)`.
 *
 * Usage:
 *   <Tabs
 *     items={[{ label: 'Sites', href: '/settings' }, ...]}
 *     currentPath="/settings/team"
 *   />
 *
 *   <Tabs
 *     items={[{ label: 'Fix immediately', value: 'critical', count: 28 }, ...]}
 *     value={tab}
 *     onChange={setTab}
 *   />
 */

export default function Tabs({ items = [], currentPath, value, onChange, className = '' }) {
  const mode = typeof onChange === 'function' ? 'state' : 'link';

  return (
    <div
      className={`inline-flex gap-[2px] p-[3px] bg-surface border border-line rounded-r-pill shadow-1 ${className}`}
      role={mode === 'state' ? 'tablist' : undefined}
    >
      {items.map((item) => {
        const isActive =
          mode === 'link'
            ? item.href === currentPath
            : item.value === value;

        const activeClass =
          'bg-ink text-surface shadow-ink';
        const inactiveClass =
          'text-ink-2 hover:bg-paper-2';

        const cls = `px-[14px] py-[7px] rounded-r-pill text-[13px] font-semibold transition-colors inline-flex items-center gap-[6px] ${
          isActive ? activeClass : inactiveClass
        }`;

        if (mode === 'link') {
          return (
            <Link key={item.href} href={item.href} className={cls}>
              {item.label}
              {typeof item.count === 'number' && (
                <span className="text-[11px] opacity-70">{item.count}</span>
              )}
            </Link>
          );
        }

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.value)}
            className={cls}
          >
            {item.label}
            {typeof item.count === 'number' && (
              <span className="text-[11px] opacity-70">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
