'use client';

import { useState } from 'react';
import SiteForm from './SiteForm';

export default function SitesManager({ teamId, initialSites }) {
  const [sites, setSites] = useState(initialSites);

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
                <th className="text-center text-xs font-medium text-gray-400 px-3 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-400 px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id} className="border-b border-gray-800/50 last:border-0">
                  <td className="px-5 py-3 text-sm text-white font-medium">{site.name}</td>
                  <td className="px-3 py-3 text-sm text-gray-400 max-w-xs truncate">{site.url}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                      {site.scan_frequency}
                    </span>
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
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(site.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
