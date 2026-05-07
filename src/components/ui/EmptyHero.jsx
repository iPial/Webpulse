import Link from 'next/link';
import Card from '@/components/ui/Card';

/**
 * <EmptyHero> — friendly first-run / no-data screen.
 *
 * Used by Overview and History when a user hasn't added any sites yet
 * (or hasn't scanned anything yet). Designed to feel like an onboarding
 * card, not a dead "no data" placeholder:
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │              [icon]                              │
 *   │                                                  │
 *   │           Big serif headline                     │
 *   │     One-line muted explainer copy.               │
 *   │                                                  │
 *   │       [ Primary CTA ]   [ Secondary link ]       │
 *   │                                                  │
 *   │   ┌─ Step 1 ─┐  ┌─ Step 2 ─┐  ┌─ Step 3 ─┐       │
 *   │   │   …      │  │   …      │  │   …      │       │
 *   │   └──────────┘  └──────────┘  └──────────┘       │
 *   └──────────────────────────────────────────────────┘
 *
 * Steps are optional. Pass an array of { n, title, body } to render
 * them as a 3-up grid below the hero copy.
 */
export default function EmptyHero({
  icon,
  eyebrow,
  title,
  message,
  primaryCta,
  secondaryCta,
  steps,
}) {
  return (
    <Card variant="hairline" className="!gap-0 !py-12 !px-8">
      <div className="text-center max-w-[560px] mx-auto">
        {icon && (
          <div className="mx-auto w-[64px] h-[64px] rounded-full bg-paper-2 grid place-items-center mb-5">
            <span className="text-ink-2">{icon}</span>
          </div>
        )}

        {eyebrow && (
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted mb-2">
            {eyebrow}
          </div>
        )}

        <h2 className="font-serif text-[28px] md:text-[36px] leading-tight tracking-tight text-ink">
          {title}
        </h2>

        {message && (
          <p className="text-[14px] text-muted mt-3 mx-auto">
            {message}
          </p>
        )}

        {(primaryCta || secondaryCta) && (
          <div className="flex items-center justify-center gap-3 flex-wrap mt-6">
            {primaryCta && (
              <Link
                href={primaryCta.href}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-r-pill bg-ink text-surface text-[13px] font-semibold shadow-ink hover:brightness-110 transition"
              >
                {primaryCta.label}
                <span aria-hidden>→</span>
              </Link>
            )}
            {secondaryCta && (
              <Link
                href={secondaryCta.href}
                className="inline-flex items-center px-4 py-2.5 rounded-r-pill border border-line text-[13px] font-semibold text-ink hover:bg-paper-2 transition"
              >
                {secondaryCta.label}
              </Link>
            )}
          </div>
        )}
      </div>

      {steps && steps.length > 0 && (
        <div className="grid md:grid-cols-3 grid-cols-1 gap-3 mt-10 max-w-[760px] mx-auto w-full">
          {steps.map((step) => (
            <div
              key={step.n}
              className="rounded-r-md border border-line bg-surface p-4 flex flex-col gap-1.5"
            >
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-ink text-surface text-[11px] font-semibold">
                {step.n}
              </span>
              <h3 className="text-[14px] font-semibold text-ink mt-1">{step.title}</h3>
              <p className="text-[12px] text-muted leading-snug">{step.body}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
