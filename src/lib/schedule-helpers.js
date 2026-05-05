// Shared scheduling helpers used by both ScheduleManager (the explicit
// "Schedules" card) and SiteForm (the inline "Watch a new site" form).
// Keeps day-of-week / day-of-month math + helpers in one place.

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// Capped at 28 — months without day 29/30/31 silently roll over to the
// next month otherwise (Feb 31 → Mar 3), which surprises users.
export const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => i + 1);

// Parse "HH:MM" → [hours, minutes] integers, clamped to valid ranges.
export function parseTime(str) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(str || '');
  if (!m) return [9, 0];
  return [
    Math.max(0, Math.min(23, parseInt(m[1], 10))),
    Math.max(0, Math.min(59, parseInt(m[2], 10))),
  ];
}

// 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th", … 21 → "21st", etc.
export function dayOrdinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

// Compute the next future occurrence of a daily slot ("every day at HH:MM").
export function computeNextDaily(hh, mm) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hh, mm, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

// Compute the next future occurrence of a weekly slot
// ("every <dayOfWeek> at HH:MM").
export function computeNextWeekly(dayOfWeek, hh, mm) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hh, mm, 0, 0);
  const currentDay = next.getDay();
  let daysToAdd = (dayOfWeek - currentDay + 7) % 7;
  if (daysToAdd === 0 && next <= now) daysToAdd = 7;
  next.setDate(next.getDate() + daysToAdd);
  return next;
}

// Compute the next future occurrence of a monthly slot
// ("the <dayOfMonth> at HH:MM").
export function computeNextMonthly(dayOfMonth, hh, mm) {
  const now = new Date();
  let next = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, hh, mm, 0, 0);
  if (next <= now) {
    next = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth, hh, mm, 0, 0);
  }
  return next;
}

// Compose the right Date for a given frequency + the relevant fields.
// `oncePicker` is the datetime-local string used for one-off schedules.
export function computeScheduledAt({
  frequency,
  oncePicker,
  dayOfWeek,
  dayOfMonth,
  timeOfDay,
}) {
  if (frequency === 'once') {
    const d = new Date(oncePicker);
    if (isNaN(d.getTime())) throw new Error('Invalid one-off date/time');
    return d;
  }
  const [hh, mm] = parseTime(timeOfDay);
  if (frequency === 'daily') return computeNextDaily(hh, mm);
  if (frequency === 'weekly') return computeNextWeekly(Number(dayOfWeek), hh, mm);
  if (frequency === 'monthly') return computeNextMonthly(Number(dayOfMonth), hh, mm);
  throw new Error(`Unknown frequency: ${frequency}`);
}
