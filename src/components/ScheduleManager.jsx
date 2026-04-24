'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Pill from '@/components/ui/Pill';
import { Input, Select, Field } from '@/components/ui/Field';

const FREQUENCY_OPTIONS = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const STATUS_VARIANT = {
  pending: 'warn',
  running: 'default',
  scanned: 'default',
  completed: 'good',
  failed: 'bad',
};

const STATUS_LABELS = {
  scanned: 'Finalizing',
};

function getDefaultDatetime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function addMinutes(mins) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + mins);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatLocalTime(isoString) {
  try {
    return new Date(isoString).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return isoString;
  }
}

export default function ScheduleManager({ teamId }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);

  const [scheduledAt, setScheduledAt] = useState(getDefaultDatetime);
  const [frequency, setFrequency] = useState('once');
  const [notifySlack, setNotifySlack] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyAI, setNotifyAI] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, []);

  async function fetchSchedules() {
    try {
      setLoading(true);
      const res = await fetch(`/api/schedules?teamId=${teamId}`);
      if (!res.ok) throw new Error('Failed to load schedules');
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const localDate = new Date(scheduledAt);
      const isoScheduledAt = localDate.toISOString();

      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          scheduledAt: isoScheduledAt,
          frequency,
          notifySlack,
          notifyEmail,
          notifyAI,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to create schedule');
      }

      const data = await res.json();
      setSchedules((prev) => [data.schedule, ...prev]);
      setShowForm(false);
      resetForm();

      if (data.autoFire && data.autoFire.startsWith('failed')) {
        setError(
          `Schedule saved, but automatic firing is not available: ${data.autoFire.replace(
            'failed: ',
            ''
          )}. Use "Run Now" to trigger it manually.`
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(scheduleId) {
    if (!confirm('Delete this scheduled scan?')) return;
    try {
      const res = await fetch(`/api/schedules?id=${scheduleId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete schedule');
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRunAllPending() {
    try {
      const res = await fetch('/api/schedules/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.details || data.error || 'Check failed');
      await fetchSchedules();
      if (data.count === 0) {
        setError('No pending schedules are due right now.');
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleFlag(scheduleId, flag, newValue) {
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === scheduleId ? { ...s, config: { ...s.config, [flag]: newValue } } : s
      )
    );
    try {
      const res = await fetch('/api/schedules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: scheduleId, action: 'setFlag', flag, value: newValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.details || data.error || 'Toggle failed');
      setSchedules((prev) => prev.map((s) => (s.id === scheduleId ? data.schedule : s)));
    } catch (err) {
      setError(err.message);
      fetchSchedules();
    }
  }

  async function handleReset(scheduleId) {
    try {
      const res = await fetch('/api/schedules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: scheduleId, action: 'reset' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.details || data.error || 'Reset failed');
      setSchedules((prev) => prev.map((s) => (s.id === scheduleId ? data.schedule : s)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRunNow(scheduleId) {
    try {
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === scheduleId ? { ...s, config: { ...s.config, status: 'running' } } : s
        )
      );

      const res = await fetch('/api/schedules/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.details || data.error || 'Failed to run scan');

      const result = (data.results || [])[0];
      if (result && result.status === 'failed') {
        throw new Error(result.error || 'Scan failed');
      }

      await fetchSchedules();
    } catch (err) {
      setError(err.message);
      await fetchSchedules();
    }
  }

  function resetForm() {
    setScheduledAt(getDefaultDatetime());
    setFrequency('once');
    setNotifySlack(false);
    setNotifyEmail(false);
    setNotifyAI(false);
  }

  return (
    <Card variant="ink">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-lime">
            Scheduled scans
          </div>
          <h2 className="font-serif text-[28px] leading-tight text-surface mt-1">
            Every site, on your clock.
          </h2>
          <p className="text-[13px] text-white/60 mt-1 max-w-[520px]">
            QStash fires exact-minute triggers. A 60s dashboard fallback catches anything that slips.
            Check the <a href="/logs" className="text-lime hover:underline">Logs page</a> for a live trace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRunAllPending}
            title="Check for any pending schedules and run them now"
            className="!bg-white/10 !text-surface !border-white/15 hover:!brightness-125"
          >
            Run pending now
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel' : '+ New schedule'}
          </Button>
        </div>
      </div>

      <div className="h-px bg-white/10 my-4" />

      {error && (
        <div className="rounded-r-sm bg-bad-bg border border-bad/30 p-3 text-[13px] text-bad mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-r-sm border border-white/10 bg-white/5 p-4 mb-4 flex flex-col gap-4"
        >
          <Field label="Scan date & time" className="[&_label]:text-white/70">
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="bg-white/5 text-surface border-white/10 [color-scheme:dark]"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { label: 'In 1 min', mins: 1 },
                { label: 'In 5 min', mins: 5 },
                { label: 'In 30 min', mins: 30 },
                { label: 'In 1 hour', mins: 60 },
              ].map(({ label, mins }) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setScheduledAt(addMinutes(mins))}
                  className="px-2.5 py-1 rounded-r-pill bg-white/10 text-white/70 hover:bg-white/20 text-[11px] border border-white/10"
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Frequency" className="[&_label]:text-white/70">
            <Select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="bg-white/5 text-surface border-white/10"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="text-ink">
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-wrap gap-5">
            {[
              { label: 'Slack', value: notifySlack, set: setNotifySlack },
              { label: 'Email', value: notifyEmail, set: setNotifyEmail },
              { label: '🤖 Include AI analysis', value: notifyAI, set: setNotifyAI },
            ].map((o) => (
              <label key={o.label} className="flex items-center gap-2 cursor-pointer text-surface text-[13px]">
                <input
                  type="checkbox"
                  checked={o.value}
                  onChange={(e) => o.set(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-lime focus:ring-lime"
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>

          <Button type="submit" variant="primary" disabled={creating} className="self-start">
            {creating ? 'Scheduling…' : 'Create schedule'}
          </Button>
        </form>
      )}

      {/* Schedule list */}
      {loading ? (
        <div className="text-[13px] text-white/50 py-4 text-center">Loading schedules…</div>
      ) : schedules.length === 0 ? (
        <div className="text-[13px] text-white/50 py-4 text-center border border-dashed border-white/15 rounded-r-sm">
          No scheduled scans. Click &ldquo;+ New Schedule&rdquo; to create one.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {schedules.map((schedule) => (
            <ScheduleRow
              key={schedule.id}
              schedule={schedule}
              onDelete={handleDelete}
              onRunNow={handleRunNow}
              onReset={handleReset}
              onToggleFlag={handleToggleFlag}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function ScheduleRow({ schedule, onDelete, onRunNow, onReset, onToggleFlag }) {
  const config = schedule.config || {};
  const status = config.status || 'pending';
  const statusVariant = STATUS_VARIANT[status] || 'default';
  const statusLabel = STATUS_LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1);
  const isStuck =
    status === 'running' &&
    config.runStartedAt &&
    Date.now() - new Date(config.runStartedAt).getTime() > 6 * 60 * 1000;

  return (
    <div className="flex items-center justify-between gap-3 rounded-r-sm border border-white/10 bg-white/5 px-4 py-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-surface">{formatLocalTime(config.scheduledAt)}</span>
          <Pill variant={statusVariant}>{statusLabel}</Pill>
          <span className="text-[11px] text-white/50 capitalize">{config.frequency || 'once'}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <FlagPill
            label="Slack"
            emoji="#"
            on={!!config.notifySlack}
            onClick={() => onToggleFlag?.(schedule.id, 'notifySlack', !config.notifySlack)}
          />
          <FlagPill
            label="Email"
            emoji="@"
            on={!!config.notifyEmail}
            onClick={() => onToggleFlag?.(schedule.id, 'notifyEmail', !config.notifyEmail)}
          />
          <FlagPill
            label="AI"
            emoji="🤖"
            on={!!config.notifyAI}
            onClick={() => onToggleFlag?.(schedule.id, 'notifyAI', !config.notifyAI)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isStuck && (
          <button
            onClick={() => onReset(schedule.id)}
            className="px-3 py-1.5 rounded-r-pill border border-warn/40 bg-warn/15 text-[11px] text-warn hover:brightness-110"
            title="This schedule has been running for over 5 minutes — likely stuck."
          >
            Reset
          </button>
        )}
        {(status === 'pending' || status === 'failed' || status === 'completed') && (
          <button
            onClick={() => onRunNow(schedule.id)}
            className="px-3 py-1.5 rounded-r-pill border border-white/15 bg-white/5 text-[11px] text-surface hover:bg-white/10"
            title="Run this scan now"
          >
            {status === 'failed' ? 'Retry' : status === 'completed' ? 'Run again' : 'Run now'}
          </button>
        )}
        {config.error && (
          <span className="text-[11px] text-bad max-w-xs truncate" title={config.error}>
            {config.error}
          </span>
        )}
        <button
          onClick={() => onDelete(schedule.id)}
          className="p-1.5 rounded-r-sm text-white/50 hover:text-bad hover:bg-bad/10"
          title="Delete schedule"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function FlagPill({ label, emoji, on, onClick }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      title={on ? `Click to turn ${label} off` : `Click to turn ${label} on`}
      className={`text-[10px] px-2 py-0.5 rounded-r-pill border inline-flex items-center gap-1 transition-colors ${
        on
          ? 'bg-lime/15 text-lime border-lime/30'
          : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
      }`}
    >
      <span>{emoji}</span>
      <span>{label}</span>
      <span className="opacity-60">{on ? 'on' : 'off'}</span>
    </button>
  );
}
