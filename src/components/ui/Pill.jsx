/**
 * <Pill> — small status / label chip.
 *
 * Variants: default | good | warn | bad | ink | lime
 * dot (bool): show a leading colored dot.
 *
 * Usage:
 *   <Pill variant="good" dot>Active</Pill>
 *   <Pill variant="bad">12 critical</Pill>
 */

const VARIANT = {
  default: 'bg-paper-2 text-ink-2 border-line',
  good: 'bg-good-bg text-good border-good/20',
  warn: 'bg-warn-bg text-[#8A5A00] border-warn/30',
  bad: 'bg-bad-bg text-bad border-bad/20',
  ink: 'bg-ink text-lime border-transparent',
  lime: 'bg-lime text-lime-ink border-lime-deep',
};

const DOT_COLOR = {
  default: 'bg-muted',
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  ink: 'bg-lime',
  lime: 'bg-lime-ink',
};

export default function Pill({
  variant = 'default',
  dot = false,
  as: Tag = 'span',
  className = '',
  children,
  ...rest
}) {
  const variantClass = VARIANT[variant] || VARIANT.default;

  return (
    <Tag
      className={`inline-flex items-center gap-[6px] px-[10px] py-[3px] rounded-r-pill border text-[11px] font-semibold leading-none ${variantClass} ${className}`}
      {...rest}
    >
      {dot && <span className={`w-[6px] h-[6px] rounded-full ${DOT_COLOR[variant] || DOT_COLOR.default}`} />}
      {children}
    </Tag>
  );
}
