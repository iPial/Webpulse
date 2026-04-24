/**
 * Field primitives — Input, Select, Textarea, plus a Field wrapper
 * for label + optional hint/error text.
 *
 * Usage:
 *   <Field label="Site name">
 *     <Input placeholder="My Website" value={...} onChange={...} />
 *   </Field>
 *
 *   <Field label="Frequency">
 *     <Select value={freq} onChange={...}>
 *       <option>Daily</option>…
 *     </Select>
 *   </Field>
 *
 *   <Input placeholder="inline, no label" />  // bare use is fine too
 */

const BASE =
  'w-full bg-surface text-ink border border-line rounded-[14px] px-[14px] py-[10px] text-[13px] shadow-1 ' +
  'placeholder:text-muted focus:outline-none focus:border-ink focus:ring-4 focus:ring-ink/5 ' +
  'transition-[border-color,box-shadow] duration-150 disabled:opacity-60 disabled:cursor-not-allowed';

export function Input({ className = '', ...rest }) {
  return <input className={`${BASE} ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }) {
  return (
    <select className={`${BASE} appearance-none pr-9 ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', rows = 4, ...rest }) {
  return <textarea rows={rows} className={`${BASE} resize-y ${className}`} {...rest} />;
}

export function Field({ label, hint, error, htmlFor, className = '', children }) {
  return (
    <div className={`flex flex-col gap-[6px] ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted"
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span className="text-[11px] text-bad">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-muted">{hint}</span>
      ) : null}
    </div>
  );
}

// Default export for convenience
export default Field;
