/**
 * <BentoGrid> — 12-col responsive grid for redesign pages.
 *
 * Collapses at 1100px (span-3/4 → span-6, span-5/6/7/8/9 → span-12)
 * and at 640px (everything → span-12). Rules live in globals.css.
 *
 * Usage:
 *   <BentoGrid>
 *     <Card span={8}>…</Card>
 *     <Card span={4}>…</Card>
 *   </BentoGrid>
 */
export default function BentoGrid({ as: Tag = 'section', className = '', children, ...rest }) {
  return (
    <Tag className={`bento-grid ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
