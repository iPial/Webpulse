'use client';

import { useState, useEffect } from 'react';

const FREQUENCY_OPTIONS = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const STATUS_STYLES = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  running: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function getDefaultDatetime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  // Format as datetime-local value (YYYY-MM-DDTHH:mm)
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

  // Form state
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
      // Convert local datetime-local to ISO string
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

      // Warn if auto-fire couldn't be queued (user can still use Run Now)
      if (data.autoFire && data.autoFire.startsWith('failed')) {
        setError(
          `Schedule saved, but automatic firing is not available: ${data.autoFire.replace('failed: ', '')}. Use "Run Now" to trigger it manually.`
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
      // Refresh schedules to show updated statuses
      await fetchSchedules();
      if (data.count === 0) {
        setError('No pending schedules are due right now.');
      }
    } catch (err) {
      setError(err.message);
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
      // Mark optimistically as running in the UI
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

      if (!res.ok) {
        throw new Error(data.details || data.error || 'Failed to run scan');
      }

      // Check for per-schedule errors in the results array
      const result = (data.results || [])[0];
      if (result && result.status === 'failed') {
        throw new Error(result.error || 'Scan failed');
      }

      // Refresh schedules to see final status (completed)
      await fetchSchedules();
    } catch (err) {
      setError(err.message);
      // Refresh to pick up the 'failed' status from the DB
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
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Scheduled Scans</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Set custom scan times with notification preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunAllPending}
            title="Check for any pending schedules and run them now"
            className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 text-sm font-medium transition-colors"
          >
            Run Pending Now
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            {showForm ? 'Cancel' : '+ New Schedule'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 mb-4 text-xs text-blue-300 leading-relaxed">
        <strong className="text-blue-200">How scheduling works:</strong> We try to fire each schedule automatically via QStash at its exact time. As a backup, any open dashboard page also checks for due schedules every 60 seconds. If something looks stuck, use <strong>Run Pending Now</strong> or <strong>Run Now</strong> on the specific schedule. Check the <a href="/logs" className="underline hover:text-white">Logs page</a> for a live trace of what&apos;s happening.
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 mb-4 space-y-4">
          {/* Date & time */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Scan Date & Time
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            {/* Quick buttons */}
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
                  className="px-3 py-1 rounded-md border border-gray-600 bg-gray-700 text-xs text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notification toggles */}
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notifySlack}
                onChange={(e) => setNotifySlack(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-300">Notify via Slack</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-300">Notify via Email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyAI}
                onChange={(e) => setNotifyAI(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-300">🤖 Include AI analysis</span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {creating ? 'Scheduling...' : 'Create Schedule'}
          </button>
        </form>
      )}

      {/* Schedule list */}
      {loading ? (
        <div className="text-sm text-gray-500 py-4 text-center">Loading schedules...</div>
      ) : schedules.length === 0 ? (
        <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-700 rounded-lg">
          No scheduled scans. Click "+ New Schedule" to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((schedule) => (
            <ScheduleRow
              key={schedule.id}
              schedule={schedule}
              onDelete={handleDelete}
              onRunNow={handleRunNow}
              onReset={handleReset}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleRow({ schedule, onDelete, onRunNow, onReset }) {
  const config = schedule.config || {};
  const status = config.status || 'pending';
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const isStuck = status === 'running' && config.runStartedAt &&
    (Date.now() - new Date(config.runStartedAt).getTime()) > 5 * 60 * 1000;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white">
            {formatLocalTime(config.scheduledAt)}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyle}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
          <span className="text-xs text-gray-500 capitalize">
            {config.frequency || 'once'}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          {config.notifySlack && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
              </svg>
              Slack
            </span>
          )}
          {config.notifyEmail && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              Email
            </span>
          )}
          {config.notifyAI && (
            <span className="text-xs text-purple-400 flex items-center gap-1">🤖 AI</span>
          )}
          {!config.notifySlack && !config.notifyEmail && !config.notifyAI && (
            <span className="text-xs text-gray-500">No notifications</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isStuck && (
          <button
            onClick={() => onReset(schedule.id)}
            className="px-3 py-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-400 hover:bg-yellow-500/20 transition-colors"
            title="This schedule has been running for over 5 minutes — likely stuck. Reset to pending."
          >
            Reset
          </button>
        )}
        {(status === 'pending' || status === 'failed' || status === 'completed') && (
          <button
            onClick={() => onRunNow(schedule.id)}
            className="px-3 py-1.5 rounded-lg border border-gray-600 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            title="Run this scan now"
          >
            {status === 'failed' ? 'Retry' : status === 'completed' ? 'Run Again' : 'Run Now'}
          </button>
        )}
        {config.error && (
          <span className="text-xs text-red-400 max-w-xs truncate" title={config.error}>
            {config.error}
          </span>
        )}
        <button
          onClick={() => onDelete(schedule.id)}
          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Delete schedule"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  );
}
