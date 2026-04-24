/**
 * <Button> — redesign primitive.
 *
 * Variants: default | primary (lime) | ink | ghost | danger
 * Sizes: sm | md | lg
 * as: override element (e.g. "a" for link-styled buttons, or pass a Next <Link> via `as={Link}`).
 *
 * Usage:
 *   <Button variant="primary">Scan all</Button>
 *   <Button as={Link} href="/settings" variant="ghost" size="sm">Manage</Button>
 */

const VARIANT = {
  default:
    'bg-surface text-ink border border-line hover:bg-paper-2 hover:border-line-2 shadow-1',
  primary:
    'bg-lime text-lime-ink border border-lime-deep hover:brightness-95 shadow-lime font-semibold',
  ink:
    'bg-ink text-surface border border-transparent hover:brightness-110 shadow-ink',
  ghost:
    'bg-transparent text-ink-2 border border-transparent hover:bg-paper-2',
  danger:
    'bg-surface text-bad border border-bad/30 hover:bg-bad-bg shadow-1',
};

const SIZE = {
  sm: 'px-[10px] py-[6px] text-[12px] gap-[6px]',
  md: 'px-[14px] py-[8px] text-[13px] gap-[8px]',
  lg: 'px-[20px] py-[12px] text-[14px] gap-[10px]',
};

export default function Button({
  variant = 'default',
  size = 'md',
  as: Tag = 'button',
  className = '',
  children,
  type,
  ...rest
}) {
  const variantClass = VARIANT[variant] || VARIANT.default;
  const sizeClass = SIZE[size] || SIZE.md;
  // Only emit type="button" on native <button>; leave it off for <a>, <Link>, etc.
  const typeProp = Tag === 'button' ? { type: type || 'button' } : {};

  return (
    <Tag
      className={`inline-flex items-center justify-center rounded-r-pill font-medium transition-[background-color,border-color,filter] duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClass} ${variantClass} ${className}`}
      {...typeProp}
      {...rest}
    >
      {children}
    </Tag>
  );
}
