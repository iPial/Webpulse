'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Field';
import {
  DAYS_OF_WEEK,
  DAYS_OF_MONTH,
  dayOrdinal,
  computeScheduledAt,
} from '@/lib/schedule-helpers';

// Inline lime-card field styling (matches the rest of the Quick Add card)
const liteStyle = { background: '#FDFFE9', borderColor: 'var(--lime-deep)' };

export default function SiteForm({ teamId, onSiteAdded }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [frequency, setFrequency] = useState('daily');
  // Recurrence-specific fields used to compose the actual schedule time.
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1) Compute the schedule time before any side-effects so a bad time
      //    fails fast without leaving an orphan site.
      const computed = computeScheduledAt({
        frequency,
        oncePicker: null, // SiteForm doesn't expose the 'once' option
        dayOfWeek,
        dayOfMonth,
        timeOfDay,
      });
      const scheduledAtIso = computed.toISOString();

      // 2) Create the site. We mark scan_frequency='custom' so the legacy
      //    daily 6-am-UTC cron skips this site — the explicit schedule
      //    we're about to create takes over timing.
      const siteRes = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          name,
          url: url.startsWith('http') ? url : `https://${url}`,
          scanFrequency: 'custom',
          logoUrl: logoUrl.trim() || null,
        }),
      });

      if (!siteRes.ok) {
        const data = await siteRes.json();
        throw new Error(data.error || 'Failed to add site');
      }
      const { site } = await siteRes.json();

      // 3) Create a schedule attached to this site. Best-effort: if the
      //    schedule POST fails the site still got created, and the user
      //    can fix it from the Schedules card.
      try {
        const schedRes = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId,
            siteId: site.id,
            scheduledAt: scheduledAtIso,
            frequency,
            kind: 'scan',
          }),
        });
        if (!schedRes.ok) {
          const data = await schedRes.json().catch(() => ({}));
          // Non-fatal — surface a soft warning in the form, but the site is added.
          console.warn('Schedule creation failed:', data.error || schedRes.status);
        }
      } catch (scheduleErr) {
        console.warn('Schedule creation threw:', scheduleErr);
      }

      // 4) Reset the form + notify parent
      setName('');
      setUrl('');
      setLogoUrl('');
      setFrequency('daily');
      setDayOfWeek(1);
      setDayOfMonth(1);
      setTimeOfDay('09:00');
      onSiteAdded?.(site);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card variant="lime">
      <div className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: '#364503' }}>
        Quick add
      </div>
      <h3 className="font-semibold text-[18px] text-lime-ink mt-1 mb-3">Watch a new site</h3>

      {error && (
        <div className="rounded-r-sm bg-bad-bg border border-bad/20 p-3 text-[13px] text-bad mb-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid md:grid-cols-3 grid-cols-1 gap-3">
          <Field label="Site name">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Website"
              required
              style={liteStyle}
            />
          </Field>
          <Field label="URL">
            <Input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              style={liteStyle}
            />
          </Field>
          <Field label="Frequency">
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={liteStyle}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </Field>
        </div>

        {/* Frequency-aware time pickers — same logic as the Schedules card,
            sized inline so the Quick Add stays compact. */}
        {frequency === 'daily' && (
          <Field label="Time of day (your local time)">
            <Input
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              required
              style={liteStyle}
            />
            <p className="text-[11px] mt-1" style={{ color: '#364503' }}>
              Scans every day at {timeOfDay}.
            </p>
          </Field>
        )}

        {frequency === 'weekly' && (
          <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
            <Field label="Day of week">
              <Select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                style={liteStyle}
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Time of day (local)">
              <Input
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                required
                style={liteStyle}
              />
            </Field>
            <p className="md:col-span-2 text-[11px] -mt-1" style={{ color: '#364503' }}>
              Scans every {DAYS_OF_WEEK.find((d) => d.value === Number(dayOfWeek))?.label} at {timeOfDay}.
            </p>
          </div>
        )}

        {frequency === 'monthly' && (
          <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
            <Field label="Day of month">
              <Select
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                style={liteStyle}
              >
                {DAYS_OF_MONTH.map((d) => (
                  <option key={d} value={d}>{dayOrdinal(d)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Time of day (local)">
              <Input
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                required
                style={liteStyle}
              />
            </Field>
            <p className="md:col-span-2 text-[11px] -mt-1" style={{ color: '#364503' }}>
              Scans the {dayOrdinal(Number(dayOfMonth))} of every month at {timeOfDay}. (Capped at the 28th — months without that day are otherwise unpredictable.)
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-[1fr_auto] grid-cols-1 gap-3">
          <Field label="Logo URL (optional)" hint="Auto-detected from favicon when empty">
            <Input
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
              style={liteStyle}
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="ink" disabled={loading} className="w-full md:w-auto">
              {loading ? 'Adding…' : '+ Add site'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
