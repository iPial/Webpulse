'use client';

import { useState, useEffect } from 'react';
import SiteForm from './SiteForm';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Pill from '@/components/ui/Pill';
import Logo from '@/components/ui/Logo';
import { Input } from '@/components/ui/Field';

export default function SitesManager({ teamId, initialSites }) {
  const [sites, setSites] = useState(initialSites);
  const [scanning, setScanning] = useState(null);
  const [scanMessages, setScanMessages] = useState({}); // { siteId: { type, text } }
  const [editingLogoId, setEditingLogoId] = useState(null);
  const [logoInput, setLogoInput] = useState('');

  async function handleSaveLogo(site) {
    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: logoInput.trim() || null }),
      });
      if (!res.ok) return;
      const { site: updated } = await res.json();
      setSites((prev) => prev.map((s) => (s.id === site.id ? updated : s)));
      setEditingLogoId(null);
      setLogoInput('');
    } catch {
      // ignore
    }
  }

  function openLogoEditor(site) {
    setEditingLogoId(site.id);
    setLogoInput(site.logo_url || '');
  }

  useEffect(() => {
    const ids = Object.keys(scanMessages);
    if (ids.length === 0) return;
    const timer = setTimeout(() => setScanMessages({}), 10000);
    return () => clearTimeout(timer);
  }, [scanMessages]);

  function handleSiteAdded(site) {
    setSites((prev) => [...prev, site]);
  }

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

  async function handleDelete(siteId) {
    if (!confirm('Delete this site and all its scan data?')) return;
    const res = await fetch(`/api/sites/${siteId}`, { method: 'DELETE' });
    if (res.ok) {
      setSites((prev) => prev.filter((s) => s.id !== siteId));
      setScanMessages((prev) => { const next = { ...prev }; delete next[siteId]; return next; });
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
              <p className="text-[12px] text-muted mt-0.5">Click Scan now to run Lighthouse on both strategies.</p>
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
                  const isEditingLogo = editingLogoId === site.id;
                  return (
                    <tr key={site.id} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Logo site={site} size="sm" />
                          <div className="min-w-0">
                            <div className="font-semibold text-ink flex items-center gap-2">
                              {site.name}
                              <button
                                onClick={() => (isEditingLogo ? setEditingLogoId(null) : openLogoEditor(site))}
                                className="text-[10px] text-muted hover:text-cobalt transition-colors underline-offset-2 hover:underline"
                                title="Edit logo URL"
                              >
                                {isEditingLogo ? 'cancel' : site.logo_url ? 'edit logo' : 'custom logo'}
                              </button>
                            </div>
                            {isEditingLogo && (
                              <div className="mt-2 flex items-center gap-2">
                                <Input
                                  type="text"
                                  value={logoInput}
                                  onChange={(e) => setLogoInput(e.target.value)}
                                  placeholder="https://… (leave empty to use favicon)"
                                  className="flex-1 min-w-0 py-1 text-[12px]"
                                />
                                <Button size="sm" variant="ink" onClick={() => handleSaveLogo(site)}>
                                  Save
                                </Button>
                              </div>
                            )}
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
                      <td className="px-3 py-3 font-mono text-[12px] text-muted max-w-xs truncate">
                        {site.url}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Pill>{site.scan_frequency}</Pill>
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-[12px] text-muted">
                        {site.enabled ? getNextScanTime(site.scan_frequency) : '—'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleToggle(site.id, site.enabled)}
                            className={`text-[11px] px-2.5 py-0.5 rounded-r-pill border transition-colors ${
                              site.enabled
                                ? 'bg-good-bg text-good border-good/20 hover:brightness-95'
                                : 'bg-paper-2 text-muted border-line hover:bg-paper'
                            }`}
                          >
                            {site.enabled ? '● Active' : 'Paused'}
                          </button>
                          <button
                            onClick={() => handleToggleWPRocket(site)}
                            title="Tag this site as using WP Rocket. AI analysis will give WP Rocket-specific fix instructions."
                            className={`text-[10px] px-2 py-0.5 rounded-r-pill border transition-colors ${
                              site.tags?.includes('wp-rocket')
                                ? 'bg-violet/15 text-violet border-violet/30'
                                : 'bg-paper-2 text-muted border-line hover:bg-paper'
                            }`}
                          >
                            🚀 WP Rocket
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleScan(site.id)}
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
                          <Button size="sm" variant="danger" onClick={() => handleDelete(site.id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
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

function getNextScanTime(frequency) {
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

  return (
    next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' +
    next.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  );
}
