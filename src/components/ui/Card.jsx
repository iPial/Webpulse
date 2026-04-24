/**
 * <Card> — redesign primitive.
 *
 * Variants: default | ink | lime | orange | violet | cream | rose | sky | hairline
 * span: 1–12 (bento-grid column span). Omit if the Card isn't inside a <BentoGrid>.
 * padding: 'md' (default, 22px) | 'sm' (14px, for dense tiles like log rows)
 *
 * Usage:
 *   <Card variant="ink" span={8}>…</Card>
 */

const VARIANT = {
  default: 'bg-surface border border-line text-ink shadow-2',
  ink: 'bg-ink text-surface border border-transparent shadow-ink',
  lime: 'bg-lime text-lime-ink border border-lime-deep shadow-lime',
  orange: 'bg-orange text-white border border-transparent shadow-orange',
  violet: 'bg-violet text-white border border-transparent shadow-2',
  cream: 'bg-surface-2 border border-line text-ink shadow-1',
  rose: 'bg-rose text-ink border border-line shadow-1',
  sky: 'bg-sky text-cobalt border border-line shadow-1',
  hairline: 'bg-transparent border border-dashed border-line-2 text-ink',
};

const SPAN = {
  1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4',
  5: 'col-span-5', 6: 'col-span-6', 7: 'col-span-7', 8: 'col-span-8',
  9: 'col-span-9', 10: 'col-span-10', 11: 'col-span-11', 12: 'col-span-12',
};

const PADDING = {
  md: 'p-[22px]',
  sm: 'p-[14px_18px]',
  lg: 'p-[28px]',
};

export default function Card({
  variant = 'default',
  span,
  padding = 'md',
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}) {
  const variantClass = VARIANT[variant] || VARIANT.default;
  const spanClass = span ? SPAN[span] || '' : '';
  const paddingClass = PADDING[padding] || PADDING.md;

  return (
    <Tag
      className={`relative flex flex-col gap-[10px] rounded-r-lg ${paddingClass} ${variantClass} ${spanClass} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
