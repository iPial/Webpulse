const VITAL_META = {
  fcp: { label: 'First Contentful Paint', good: 1800, poor: 3000 },
  lcp: { label: 'Largest Contentful Paint', good: 2500, poor: 4000 },
  tbt: { label: 'Total Blocking Time', good: 200, poor: 600 },
  cls: { label: 'Cumulative Layout Shift', good: 0.1, poor: 0.25, unit: '' },
  si:  { label: 'Speed Index', good: 3400, poor: 5800 },
};

export default function VitalsPanel({ result }) {
  if (!result) return null;

  const vitals = [
    { key: 'fcp', value: result.fcp },
    { key: 'lcp', value: result.lcp },
    { key: 'tbt', value: result.tbt },
    { key: 'cls', value: result.cls },
    { key: 'si',  value: result.si },
  ];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Core Web Vitals</h3>
      <div className="space-y-3">
        {vitals.map(({ key, value }) => {
          if (!value) return null;
          const meta = VITAL_META[key];
          return (
            <VitalRow key={key} label={meta.label} value={value} vitalKey={key} />
          );
        })}
      </div>
    </div>
  );
}

function VitalRow({ label, value, vitalKey }) {
  const color = getVitalColor(vitalKey, value);

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-medium ${color}`}>{value}</span>
    </div>
  );
}

function getVitalColor(key, displayValue) {
  // Parse numeric value from display string (e.g. "1.2 s" → 1200, "0.05" → 0.05)
  const num = parseDisplayValue(key, displayValue);
  if (num === null) return 'text-gray-300';

  const meta = VITAL_META[key];
  if (num <= meta.good) return 'text-score-good';
  if (num <= meta.poor) return 'text-score-average';
  return 'text-score-poor';
}

function parseDisplayValue(key, displayValue) {
  if (!displayValue) return null;

  // CLS is a unitless decimal
  if (key === 'cls') {
    const num = parseFloat(displayValue);
    return isNaN(num) ? null : num;
  }

  // Try to parse "X.X s" format (seconds → ms)
  const secMatch = displayValue.match(/([\d.]+)\s*s$/);
  if (secMatch) return parseFloat(secMatch[1]) * 1000;

  // Try to parse "X,XXX ms" or "XXX ms" format
  const msMatch = displayValue.match(/([\d,]+)\s*ms$/);
  if (msMatch) return parseFloat(msMatch[1].replace(/,/g, ''));

  return null;
}
