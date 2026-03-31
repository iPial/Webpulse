const VITAL_META = {
  fcp: {
    label: 'First Contentful Paint',
    short: 'FCP',
    good: 1800,
    poor: 3000,
    desc: 'Time until the first text or image is painted.',
    fix: 'Eliminate render-blocking resources, preload key fonts, inline critical CSS.',
  },
  lcp: {
    label: 'Largest Contentful Paint',
    short: 'LCP',
    good: 2500,
    poor: 4000,
    desc: 'Time until the largest content element is visible.',
    fix: 'Optimize images, preload hero image, use CDN, reduce server response time.',
  },
  tbt: {
    label: 'Total Blocking Time',
    short: 'TBT',
    good: 200,
    poor: 600,
    desc: 'Total time the main thread was blocked, preventing input responsiveness.',
    fix: 'Break up long tasks, defer non-critical JS, remove unused JavaScript.',
  },
  cls: {
    label: 'Cumulative Layout Shift',
    short: 'CLS',
    good: 0.1,
    poor: 0.25,
    unit: '',
    desc: 'Measures visual stability — how much content shifts during loading.',
    fix: 'Set explicit dimensions on images/ads, avoid inserting content above existing content.',
  },
  si: {
    label: 'Speed Index',
    short: 'SI',
    good: 3400,
    poor: 5800,
    desc: 'How quickly content is visually displayed during page load.',
    fix: 'Minimize main-thread work, reduce JS execution time, optimize images.',
  },
};

export default function VitalsPanel({ result }) {
  if (!result) return null;

  const vitals = [
    { key: 'fcp', value: result.fcp },
    { key: 'lcp', value: result.lcp },
    { key: 'tbt', value: result.tbt },
    { key: 'cls', value: result.cls },
    { key: 'si', value: result.si },
  ];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Core Web Vitals</h3>
      <div className="space-y-4">
        {vitals.map(({ key, value }) => {
          if (!value) return null;
          return <VitalRow key={key} vitalKey={key} value={value} />;
        })}
      </div>
    </div>
  );
}

function VitalRow({ vitalKey, value }) {
  const meta = VITAL_META[vitalKey];
  const numericMs = parseDisplayValue(vitalKey, value);
  const status = getStatus(vitalKey, numericMs);
  const statusColor = status === 'good' ? '#10B981' : status === 'average' ? '#F59E0B' : '#EF4444';
  const statusText = status === 'good' ? 'Good' : status === 'average' ? 'Needs Work' : 'Poor';
  const statusBg = status === 'good' ? 'bg-green-500/10 text-green-400' : status === 'average' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400';

  // Calculate bar width (0-100%) relative to poor threshold
  const maxVal = meta.poor * 1.5;
  const barWidth = numericMs !== null ? Math.min(100, (numericMs / maxVal) * 100) : 0;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">{meta.label}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBg}`}>
            {statusText}
          </span>
        </div>
        <span className="text-sm font-bold" style={{ color: statusColor }}>{value}</span>
      </div>

      {/* Progress bar with threshold markers */}
      <div className="relative h-2 rounded-full bg-gray-800 overflow-hidden mb-1.5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${barWidth}%`, backgroundColor: statusColor }}
        />
        {/* Good threshold marker */}
        <div
          className="absolute top-0 h-full w-px bg-green-500/40"
          style={{ left: `${(meta.good / maxVal) * 100}%` }}
        />
        {/* Poor threshold marker */}
        <div
          className="absolute top-0 h-full w-px bg-red-500/40"
          style={{ left: `${(meta.poor / maxVal) * 100}%` }}
        />
      </div>

      {/* Threshold labels */}
      <div className="flex justify-between text-[9px] text-gray-600 mb-1">
        <span>0</span>
        <span style={{ marginLeft: `${(meta.good / maxVal) * 100 - 5}%` }}>
          Good: {vitalKey === 'cls' ? meta.good : `${meta.good / 1000}s`}
        </span>
        <span>
          Poor: {vitalKey === 'cls' ? meta.poor : `${meta.poor / 1000}s`}
        </span>
      </div>

      {/* Description + fix (shown on hover/always for poor) */}
      <div className={`text-xs text-gray-500 mt-1 ${status === 'poor' ? 'block' : 'hidden group-hover:block'}`}>
        <p>{meta.desc}</p>
        {status !== 'good' && (
          <p className="text-gray-400 mt-0.5">
            <span className="font-medium">Fix: </span>{meta.fix}
          </p>
        )}
      </div>
    </div>
  );
}

function getStatus(key, numericMs) {
  if (numericMs === null) return 'average';
  const meta = VITAL_META[key];
  if (numericMs <= meta.good) return 'good';
  if (numericMs <= meta.poor) return 'average';
  return 'poor';
}

function parseDisplayValue(key, displayValue) {
  if (!displayValue) return null;
  if (key === 'cls') {
    const num = parseFloat(displayValue);
    return isNaN(num) ? null : num;
  }
  const secMatch = displayValue.match(/([\d.]+)\s*s$/);
  if (secMatch) return parseFloat(secMatch[1]) * 1000;
  const msMatch = displayValue.match(/([\d,]+)\s*ms$/);
  if (msMatch) return parseFloat(msMatch[1].replace(/,/g, ''));
  return null;
}
