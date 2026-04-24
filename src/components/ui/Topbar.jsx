/**
 * <Topbar> — header for redesigned authenticated pages.
 *
 * Sits at the top of main content inside <PageShell>. Matches the
 * mockup pattern: eyebrow, h1 title, optional subtitle, right-side actions slot.
 *
 * Usage:
 *   <Topbar
 *     eyebrow="Thursday, Apr 23"
 *     title="Overview"
 *     subtitle="2 sites monitored · 49 critical issues"
 *     actions={<Button variant="primary">Scan all</Button>}
 *   />
 */
export default function Topbar({ eyebrow, title, subtitle, actions, right, className = '' }) {
  return (
    <header
      className={`flex items-start gap-6 flex-wrap mb-6 ${className}`}
    >
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted mb-[6px]">
            {eyebrow}
          </div>
        )}
        {title && (
          <h1 className="font-serif text-[40px] leading-[1.05] tracking-tight text-ink">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-[14px] text-muted mt-[6px]">{subtitle}</p>
        )}
      </div>
      {(actions || right) && (
        <div className="flex items-center gap-2 flex-wrap">
          {right}
          {actions}
        </div>
      )}
    </header>
  );
}
