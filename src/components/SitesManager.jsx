'use client';

import { useState, useEffect } from 'react';
import SiteForm from './SiteForm';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Pill from '@/components/ui/Pill';
import Logo from '@/components/ui/Logo';
import { Input, Select, Field } from '@/components/ui/Field';
import {
  DAYS_OF_WEEK,
  DAYS_OF_MONTH,
  dayOrdinal,
  computeScheduledAt,
} from '@/lib/schedule-helpers';

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const DEFAULT_EDIT_FORM = {
  name: '',
  url: '',
  logoUrl: '',
  frequency: 'daily',
  dayOfWeek: 1,
  dayOfMonth: 1,
  timeOfDay: '09:00',
  notifyAI: true,
  notifySlack: false,
  notifyEmail: false,
};

export default function SitesManager({ teamId, initialSites, initialSchedules = [] }) {
  const [sites, setSites] = useState(initialSites);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [scanning, setScanning] = useState(null);
  const [scanMessages, setScanMessages] = useState({});

  // Refetch schedules when anything changes (a site added, a site edited,
  // or another tab updated a schedule). Keeps the "Next scan" column live.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    async function refetch() {
      try {
        const res = await fetch(`/api/schedules?teamId=${teamId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.schedules)) setSchedules(data.schedules);
      } catch {
        // best-effort
      }
    }
    function handler() { refetch(); }
    window.addEventListener('webpulse:sites-updated', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('webpulse:sites-updated', handler);
    };
  }, [teamId]);

  // Build a Map<siteId, schedule> for O(1) lookups in row render. Most
  // recent schedule wins if a site somehow has multiple.
  const scheduleBySiteId = new Map();
  for (const s of schedules) {
    const sid = s.config?.siteId;
    if (!sid) continue;
    const existing = scheduleBySiteId.get(sid);
    if (!existing || s.id > existing.id) scheduleBySiteId.set(sid, s);
  }

  // Editor state — holds the site currently being edited and its form values.
  const [editingSiteId, setEditingSiteId] = useState(null);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    const ids = Object.keys(scanMessages);
    if (ids.length === 0) return;
    const timer = setTimeout(() => setScanMessages({}), 10000);
    return () => clearTimeout(timer);
  }, [scanMessages]);

  function handleSiteAdded(site) {
    setSites((prev) => [...prev, site]);
    notifySitesUpdated();
  }

  function notifySitesUpdated() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('webpulse:sites-updated'));
  }

  // ── Edit panel ────────────────────────────────────────────────────────

  async function openEditor(site) {
    setEditError('');
    setEditingSiteId(site.id);

    // Pre-fill from site fields. Schedule fields default to sensible values
    // until the linked schedule (if any) loads and overwrites them.
    setEditForm({
      name: site.name || '',
      url: site.url || '',
      logoUrl: site.logo_url || '',
      frequency:
        site.scan_frequency && site.scan_frequency !== 'custom'
          ? site.scan_frequency
          : 'daily',
      dayOfWeek: 1,
      dayOfMonth: 1,
      timeOfDay: '09:00',
      notifyAI: true,
      notifySlack: false,
      notifyEmail: false,
    });

    // Fetch the linked schedule (if any) and overlay its fields.
    try {
      const res = await fetch(`/api/schedules?teamId=${teamId}&siteId=${site.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const schedule = (data.schedules || [])[0];
      if (!schedule) return;
      const cfg = schedule.config || {};

      // Derive day-of-week / day-of-month / time-of-day from the stored
      // scheduledAt, in the user's local timezone.
      const at = cfg.scheduledAt ? new Date(cfg.scheduledAt) : null;
      const pad = (n) => String(n).padStart(2, '0');
      const fields = {};
      if (at && !isNaN(at.getTime())) {
        fields.dayOfWeek = at.getDay();
        fields.dayOfMonth = at.getDate();
        fields.timeOfDay = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
      }
      if (cfg.frequency && cfg.frequency !== 'once') fields.frequency = cfg.frequency;
      if (cfg.notifyAI !== undefined) fields.notifyAI = !!cfg.notifyAI;
      if (cfg.notifySlack !== undefined) fields.notifySlack = !!cfg.notifySlack;
      if (cfg.notifyEmail !== undefined) fields.notifyEmail = !!cfg.notifyEmail;

      setEditForm((prev) => ({ ...prev, ...fields }));
    } catch {
      // best-effort — form falls back to defaults
    }
  }

  function closeEditor() {
    setEditingSiteId(null);
    setEditForm(DEFAULT_EDIT_FORM);
    setEditError('');
  }

  async function saveEditor(site) {
    setEditLoading(true);
    setEditError('');
    try {
      // Compute scheduledAt CLIENT-SIDE so the user's local timezone is
      // honored. If we ship raw timeOfDay to the server, computeScheduledAt
      // there runs in Vercel's UTC and "9:00" becomes 9:00 UTC instead of
      // 9:00 BD. Compute here, send the ISO string, server stores verbatim.
      let scheduledAtIso = null;
      try {
        const computed = computeScheduledAt({
          frequency: editForm.frequency,
          oncePicker: null,
          dayOfWeek: Number(editForm.dayOfWeek),
          dayOfMonth: Number(editForm.dayOfMonth),
          timeOfDay: editForm.timeOfDay,
        });
        scheduledAtIso = computed.toISOString();
      } catch (err) {
        throw new Error(`Invalid schedule timing: ${err.message}`);
      }

      const body = {
        name: editForm.name.trim(),
        url: editForm.url.trim(),
        logoUrl: editForm.logoUrl.trim() || null,
        // Schedule fields — server uses scheduledAt verbatim, no recompute
        frequency: editForm.frequency,
        scheduledAt: scheduledAtIso,
        notifyAI: editForm.notifyAI,
        notifySlack: editForm.notifySlack,
        notifyEmail: editForm.notifyEmail,
      };
      const res = await fetch(`/api/sites/${site.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.details || 'Failed to save');
      }
      const { site: updated } = await res.json();
      setSites((prev) => prev.map((s) => (s.id === site.id ? { ...s, ...updated } : s)));
      // Tell the Schedules card to refresh its picker + list
      notifySitesUpdated();
      closeEditor();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  }

  // ── Site mutations (unchanged behavior) ───────────────────────────────

  async function handleToggle(siteId, enabled) {
    const res = await fetch(`/api/sites/${siteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    if (res.ok) {
      const { site } = await res.json();
      setSites((prev) => prev.map((s) => (s.id === siteId ? site : s)));
    }
  }

  async function handleToggleWPRocket(site) {
    const current = site.tags || [];
    const hasTag = current.includes('wp-rocket');
    const nextTags = hasTag ? current.filter((t) => t !== 'wp-rocket') : [...current, 'wp-rocket'];

    const res = await fetch(`/api/sites/${site.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: nextTags }),
    });
    if (res.ok) {
      const { site: updated } = await res.json();
      setSites((prev) => prev.map((s) => (s.id === site.id ? updated : s)));
    }
  }

  async function handleTogglePublic(site) {
    const res = await fetch(`/api/sites/${site.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: !site.is_public }),
    });
    if (res.ok) {
      const { site: updated } = await res.json();
      setSites((prev) => prev.map((s) => (s.id === site.id ? updated : s)));
    }
  }

  async function copyPublicLink(siteId) {
    const url = `${window.location.origin}/site/${siteId}`;
    try {
      await navigator.clipboard.writeText(url);
      setScanMessages((prev) => ({
        ...prev,
        [siteId]: { type: 'success', text: 'Public link copied to clipboard' },
      }));
    } catch {
      window.prompt('Copy this public link:', url);
    }
  }

  async function handleDelete(siteId) {
    if (!confirm('Delete this site and all its scan data?')) return;
    const res = await fetch(`/api/sites/${siteId}`, { method: 'DELETE' });
    if (res.ok) {
      setSites((prev) => prev.filter((s) => s.id !== siteId));
      setScanMessages((prev) => { const next = { ...prev }; delete next[siteId]; return next; });
      if (editingSiteId === siteId) closeEditor();
      notifySitesUpdated();
    }
  }

  async function scanStrategy(siteId, strategy) {
    const res = await fetch('/api/scan/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, strategy }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.details || data.error || 'Scan failed');
    return data;
  }

  async function handleScan(siteId) {
    setScanning(siteId);
    let mobileScore = null;
    let desktopScore = null;
    try {
      setScanMessages((prev) => ({ ...prev, [siteId]: { type: 'info', text: 'Scanning mobile…' } }));
      const mobileResult = await scanStrategy(siteId, 'mobile');
      mobileScore = mobileResult.scores.performance;

      setScanMessages((prev) => ({
        ...prev,
        [siteId]: { type: 'info', text: `Mobile: ${mobileScore} — scanning desktop…` },
      }));
      const desktopResult = await scanStrategy(siteId, 'desktop');
      desktopScore = desktopResult.scores.performance;

      setScanMessages((prev) => ({
        ...prev,
        [siteId]: { type: 'success', text: `Perf: ${mobileScore} (mobile) / ${desktopScore} (desktop)` },
      }));
    } catch (err) {
      const partial = mobileScore !== null ? ` (mobile: ${mobileScore})` : '';
      setScanMessages((prev) => ({
        ...prev,
        [siteId]: { type: 'error', text: `${err.message}${partial}` },
      }));
    } finally {
      setScanning(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SiteForm teamId={teamId} onSiteAdded={handleSiteAdded} />

      {sites.length === 0 ? (
        <Card variant="hairline" className="text-center py-10">
          <p className="text-[13px] text-muted">No sites added yet. Add your first site above.</p>
        </Card>
      ) : (
        <Card padding="sm" className="overflow-hidden">
          <div className="flex items-center justify-between mb-3 px-2 pt-2">
            <div>
              <h3 className="font-semibold text-[15px] text-ink">Your sites</h3>
              <p className="text-[12px] text-muted mt-0.5">
                Click <strong>Edit</strong> to change a site&apos;s name, URL, logo, schedule, or notifications.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.1em] font-semibold text-muted">
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">URL</th>
                  <th className="px-3 py-2.5 text-center">Frequency</th>
                  <th className="px-3 py-2.5 text-center">Next scan</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => {
                  const msg = scanMessages[site.id];
                  const isEditing = editingSiteId === site.id;
                  return (
                    <RowFragment
                      key={site.id}
                      site={site}
                      schedule={scheduleBySiteId.get(site.id) || null}
                      msg={msg}
                      isEditing={isEditing}
                      editForm={editForm}
                      editLoading={editLoading}
                      editError={editError}
                      scanning={scanning}
                      onEdit={openEditor}
                      onCloseEdit={closeEditor}
                      onSaveEdit={saveEditor}
                      onChangeEditField={(field, value) =>
                        setEditForm((prev) => ({ ...prev, [field]: value }))
                      }
                      onToggle={handleToggle}
                      onToggleWPRocket={handleToggleWPRocket}
                      onTogglePublic={handleTogglePublic}
                      onCopyPublicLink={copyPublicLink}
                      onScan={handleScan}
                      onDelete={handleDelete}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// One site renders as two table rows when editing: the data row, then an
// expanded edit panel below it spanning all columns. Keeping it as a
// separate component keeps the table-mapping code readable.
function RowFragment({
  site,
  schedule,
  msg,
  isEditing,
  editForm,
  editLoading,
  editError,
  scanning,
  onEdit,
  onCloseEdit,
  onSaveEdit,
  onChangeEditField,
  onToggle,
  onToggleWPRocket,
  onTogglePublic,
  onCopyPublicLink,
  onScan,
  onDelete,
}) {
  return (
    <>
      <tr className="border-b border-line/60 last:border-0">
        <td className="px-3 py-3">
          <div className="flex items-center gap-3">
            <Logo site={site} size="sm" />
            <div className="min-w-0">
              <div className="font-semibold text-ink">{site.name}</div>
            </div>
          </div>
          {msg && (
            <div
              className={`text-[11px] mt-1 ${
                msg.type === 'error' ? 'text-bad' : msg.type === 'success' ? 'text-good' : 'text-cobalt'
              }`}
            >
              {msg.type === 'info' && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-line border-t-cobalt rounded-full animate-spin" />
                  {msg.text}
                </span>
              )}
              {msg.type !== 'info' && msg.text}
            </div>
          )}
        </td>
        <td className="px-3 py-3 font-mono text-[12px] text-muted max-w-xs truncate">{site.url}</td>
        <td className="px-3 py-3 text-center">
          <Pill>{site.scan_frequency}</Pill>
        </td>
        <td className="px-3 py-3 text-center font-mono text-[12px] text-muted">
          {site.enabled ? formatNextScan(site, schedule) : '—'}
        </td>
        <td className="px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <button
              onClick={() => onToggle(site.id, site.enabled)}
              className={`text-[11px] px-2.5 py-0.5 rounded-r-pill border transition-colors ${
                site.enabled
                  ? 'bg-good-bg text-good border-good/20 hover:brightness-95'
                  : 'bg-paper-2 text-muted border-line hover:bg-paper'
              }`}
            >
              {site.enabled ? '● Active' : 'Paused'}
            </button>
            <button
              onClick={() => onToggleWPRocket(site)}
              title="Tag this site as using WP Rocket. AI analysis will give WP Rocket-specific fix instructions."
              className={`text-[10px] px-2 py-0.5 rounded-r-pill border transition-colors ${
                site.tags?.includes('wp-rocket')
                  ? 'bg-violet/15 text-violet border-violet/30'
                  : 'bg-paper-2 text-muted border-line hover:bg-paper'
              }`}
            >
              🚀 WP Rocket
            </button>
            <button
              onClick={() => onTogglePublic(site)}
              title={
                site.is_public
                  ? 'Public — anyone with the report URL can view this site, no login required. Click to make private.'
                  : 'Private — only team members can view. Click to allow public read-only access (Slack/email links work for stakeholders).'
              }
              className={`text-[10px] px-2 py-0.5 rounded-r-pill border transition-colors ${
                site.is_public
                  ? 'bg-good-bg text-good border-good/30'
                  : 'bg-paper-2 text-muted border-line hover:bg-paper'
              }`}
            >
              {site.is_public ? '🔗 Public' : '🔒 Private'}
            </button>
            {site.is_public && (
              <button
                onClick={() => onCopyPublicLink(site.id)}
                title="Copy public report URL"
                className="text-[10px] px-2 py-0.5 rounded-r-pill border bg-cobalt/10 text-cobalt border-cobalt/30 hover:bg-cobalt/15 inline-flex items-center gap-1"
              >
                📋 Copy link
              </button>
            )}
          </div>
        </td>
        <td className="px-3 py-3 text-right">
          <div className="inline-flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => onScan(site.id)}
              disabled={scanning === site.id}
            >
              {scanning === site.id ? (
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-line border-t-cobalt rounded-full animate-spin" />
                  Scanning
                </span>
              ) : (
                'Scan now'
              )}
            </Button>
            <Button
              size="sm"
              variant={isEditing ? 'ink' : 'default'}
              onClick={() => (isEditing ? onCloseEdit() : onEdit(site))}
            >
              {isEditing ? 'Close' : 'Edit'}
            </Button>
            <Button size="sm" variant="danger" onClick={() => onDelete(site.id)}>
              Delete
            </Button>
          </div>
        </td>
      </tr>

      {isEditing && (
        <tr className="border-b border-line/60 last:border-0">
          <td colSpan={6} className="px-3 py-4 bg-paper-2/40">
            <EditPanel
              site={site}
              form={editForm}
              loading={editLoading}
              error={editError}
              onChange={onChangeEditField}
              onSave={() => onSaveEdit(site)}
              onCancel={onCloseEdit}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function EditPanel({ site, form, loading, error, onChange, onSave, onCancel }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-[14px] text-ink">Edit site</h4>
        <span className="text-[11px] text-muted">id: {site.id}</span>
      </div>

      {error && (
        <div className="rounded-r-sm bg-bad-bg border border-bad/20 p-3 text-[12px] text-bad">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
        <Field label="Site name">
          <Input value={form.name} onChange={(e) => onChange('name', e.target.value)} required />
        </Field>
        <Field label="URL">
          <Input value={form.url} onChange={(e) => onChange('url', e.target.value)} required />
        </Field>
      </div>

      <Field label="Logo URL (optional)" hint="Auto-detected from favicon when empty.">
        <Input
          value={form.logoUrl}
          onChange={(e) => onChange('logoUrl', e.target.value)}
          placeholder="https://… or leave empty"
        />
      </Field>

      <div className="grid md:grid-cols-3 grid-cols-1 gap-3">
        <Field label="Frequency">
          <Select
            value={form.frequency}
            onChange={(e) => onChange('frequency', e.target.value)}
          >
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>

        {form.frequency === 'weekly' && (
          <Field label="Day of week">
            <Select
              value={form.dayOfWeek}
              onChange={(e) => onChange('dayOfWeek', Number(e.target.value))}
            >
              {DAYS_OF_WEEK.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </Select>
          </Field>
        )}

        {form.frequency === 'monthly' && (
          <Field label="Day of month">
            <Select
              value={form.dayOfMonth}
              onChange={(e) => onChange('dayOfMonth', Number(e.target.value))}
            >
              {DAYS_OF_MONTH.map((d) => (
                <option key={d} value={d}>{dayOrdinal(d)}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Time of day (local)">
          <Input
            type="time"
            value={form.timeOfDay}
            onChange={(e) => onChange('timeOfDay', e.target.value)}
            required
          />
        </Field>
      </div>

      <Field
        label="Notifications"
        hint="Applied to the schedule attached to this site. Toggling here is equivalent to clicking the per-row pills in the Schedules card."
      >
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="inline-flex items-center gap-2 text-[13px] text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={form.notifyAI}
              onChange={(e) => onChange('notifyAI', e.target.checked)}
              className="w-4 h-4 rounded border-line accent-ink"
            />
            <span>🤖 AI analysis</span>
          </label>
          <label className="inline-flex items-center gap-2 text-[13px] text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={form.notifySlack}
              onChange={(e) => onChange('notifySlack', e.target.checked)}
              className="w-4 h-4 rounded border-line accent-ink"
            />
            <span># Slack</span>
          </label>
          <label className="inline-flex items-center gap-2 text-[13px] text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={form.notifyEmail}
              onChange={(e) => onChange('notifyEmail', e.target.checked)}
              className="w-4 h-4 rounded border-line accent-ink"
            />
            <span>@ Email</span>
          </label>
        </div>
      </Field>

      <div className="flex items-center gap-2 pt-1">
        <Button variant="ink" onClick={onSave} disabled={loading}>
          {loading ? 'Saving…' : 'Save changes'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Returns the next scan datetime as a localized string.
// Preference order:
//   1. The linked schedule's scheduledAt (the truth for sites with explicit
//      schedules — most reliable, includes the user's chosen time-of-day).
//   2. Fallback: the legacy 6am-UTC cron computation, used for sites that
//      still rely on scan_frequency without an attached schedule.
function formatNextScan(site, schedule) {
  if (schedule?.config?.scheduledAt) {
    const d = new Date(schedule.config.scheduledAt);
    if (!isNaN(d.getTime())) return formatLocal(d);
  }
  return formatLegacyCronNext(site.scan_frequency);
}

function formatLocal(d) {
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
  );
}

// Legacy cron fires at 06:00 UTC for daily, Mondays for weekly, 1st-of-month
// for monthly. Used only when a site has no attached schedule.
function formatLegacyCronNext(frequency) {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(6, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

  if (frequency === 'weekly') {
    while (next.getUTCDay() !== 1) next.setUTCDate(next.getUTCDate() + 1);
  } else if (frequency === 'monthly') {
    next.setUTCMonth(next.getUTCMonth() + 1, 1);
    next.setUTCHours(6, 0, 0, 0);
  }
  return formatLocal(next);
}
