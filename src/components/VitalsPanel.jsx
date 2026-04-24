import Card from '@/components/ui/Card';
import Pill from '@/components/ui/Pill';

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
    <Card>
      <h3 className="font-semibold text-[15px] text-ink">Core Web Vitals</h3>
      <p className="text-[12px] text-muted mt-0.5">
        Threshold bars compare to Google&apos;s good / needs-work / poor thresholds.
      </p>
      <div className="flex flex-col gap-5 mt-4">
        {vitals.map(({ key, value }) => {
          if (!value) return null;
          return <VitalRow key={key} vitalKey={key} value={value} />;
        })}
      </div>
    </Card>
  );
}

function VitalRow({ vitalKey, value }) {
  const meta = VITAL_META[vitalKey];
  const numericMs = parseDisplayValue(vitalKey, value);
  const status = getStatus(vitalKey, numericMs);
  const statusColor =
    status === 'good' ? 'var(--good)' : status === 'average' ? 'var(--warn)' : 'var(--bad)';
  const statusText =
    status === 'good' ? 'Good' : status === 'average' ? 'Needs work' : 'Poor';
  const statusVariant =
    status === 'good' ? 'good' : status === 'average' ? 'warn' : 'bad';
  const valueColor =
    status === 'good' ? 'text-good' : status === 'average' ? 'text-warn' : 'text-bad';

  const maxVal = meta.poor * 1.5;
  const barWidth = numericMs !== null ? Math.min(100, (numericMs / maxVal) * 100) : 0;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-ink">{meta.label}</span>
          <Pill variant={statusVariant}>{statusText}</Pill>
        </div>
        <span className={`font-serif text-[22px] leading-none tracking-tight ${valueColor}`}>
          {value}
        </span>
      </div>

      {/* Threshold bar */}
      <div className="relative h-[6px] rounded-full bg-paper-2 overflow-hidden mt-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${barWidth}%`, backgroundColor: statusColor }}
        />
        <div
          className="absolute top-0 h-full w-px bg-good/40"
          style={{ left: `${(meta.good / maxVal) * 100}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-bad/40"
          style={{ left: `${(meta.poor / maxVal) * 100}%` }}
        />
      </div>

      <div className="flex justify-between font-mono text-[10px] text-muted mt-1">
        <span>0</span>
        <span>
          Good: {vitalKey === 'cls' ? meta.good : `${meta.good / 1000}s`}
        </span>
        <span>
          Poor: {vitalKey === 'cls' ? meta.poor : `${meta.poor / 1000}s`}
        </span>
      </div>

      {status !== 'good' && (
        <div className="text-[12px] text-muted mt-2">
          <p>{meta.desc}</p>
          <p className="text-ink-2 mt-1">
            <span className="font-semibold">Fix: </span>
            {meta.fix}
          </p>
        </div>
      )}
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
