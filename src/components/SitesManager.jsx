'use client';

import { useState, useEffect } from 'react';
import SiteForm from './SiteForm';

export default function SitesManager({ teamId, initialSites }) {
  const [sites, setSites] = useState(initialSites);
  const [scanning, setScanning] = useState(null);
  const [scanMessages, setScanMessages] = useState({}); // { siteId: { type, text } }

  // Auto-clear messages after 10s
  useEffect(() => {
    const ids = Object.keys(scanMessages);
    if (ids.length === 0) return;

    const timer = setTimeout(() => {
      setScanMessages({});
    }, 10000);

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

  async function handleScan(siteId, siteName) {
    setScanning(siteId);
    let mobileScore = null;
    let desktopScore = null;

    try {
      // Step 1: Mobile scan
      setScanMessages((prev) => ({ ...prev, [siteId]: { type: 'info', text: 'Scanning mobile...' } }));
      const mobileResult = await scanStrategy(siteId, 'mobile');
      mobileScore = mobileResult.scores.performance;

      // Step 2: Desktop scan
      setScanMessages((prev) => ({
        ...prev,
        [siteId]: { type: 'info', text: `Mobile: ${mobileScore} — Scanning desktop...` },
      }));
      const desktopResult = await scanStrategy(siteId, 'desktop');
      desktopScore = desktopResult.scores.performance;

      // Done
      setScanMessages((prev) => ({
        ...prev,
        [siteId]: {
          type: 'success',
          text: `Perf: ${mobileScore} (mobile) / ${desktopScore} (desktop)`,
        },
      }));
    } catch (err) {
      // Show partial results if we got mobile before desktop failed
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
    <div className="space-y-6">
      <SiteForm teamId={teamId} onSiteAdded={handleSiteAdded} />

      {sites.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
          <p className="text-sm text-gray-400">No sites added yet. Add your first site above.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">Name</th>
                <th className="text-left text-xs font-medium text-gray-400 px-3 py-3">URL</th>
                <th className="text-center text-xs font-medium text-gray-400 px-3 py-3">Frequency</th>
                <th className="text-center text-xs font-medium text-gray-400 px-3 py-3">Next Scan</th>
                <th className="text-center text-xs font-medium text-gray-400 px-3 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-400 px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => {
                const msg = scanMessages[site.id];
                return (
                  <tr key={site.id} className="border-b border-gray-800/50 last:border-0">
                    <td className="px-5 py-3">
                      <div className="text-sm text-white font-medium">{site.name}</div>
                      {msg && (
                        <div className={`text-xs mt-1 ${
                          msg.type === 'error' ? 'text-red-400' :
                          msg.type === 'success' ? 'text-green-400' :
                          'text-blue-400'
                        }`}>
                          {msg.type === 'info' && (
                            <span className="inline-flex items-center gap-1">
                              <span className="w-3 h-3 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
                              {msg.text}
                            </span>
                          )}
                          {msg.type !== 'info' && msg.text}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-400 max-w-xs truncate">{site.url}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                        {site.scan_frequency}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-gray-500">
                      {site.enabled ? getNextScanTime(site.scan_frequency) : '—'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleToggle(site.id, site.enabled)}
                        className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                          site.enabled
                            ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                            : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                        }`}
                      >
                        {site.enabled ? 'Active' : 'Paused'}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right space-x-3">
                      <button
                        onClick={() => handleScan(site.id, site.name)}
                        disabled={scanning === site.id}
                        className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                      >
                        {scanning === site.id ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="w-3 h-3 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
                            Scanning
                          </span>
                        ) : 'Scan Now'}
                      </button>
                      <button
                        onClick={() => handleDelete(site.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function getNextScanTime(frequency) {
  const now = new Date();
  const next = new Date(now);

  // Next 06:00 UTC
  next.setUTCHours(6, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

  if (frequency === 'weekly') {
    // Next Monday at 06:00 UTC
    while (next.getUTCDay() !== 1) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  } else if (frequency === 'monthly') {
    // 1st of next month at 06:00 UTC
    next.setUTCMonth(next.getUTCMonth() + 1, 1);
    next.setUTCHours(6, 0, 0, 0);
  }

  return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + next.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}
