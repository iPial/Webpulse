'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SiteDetailActions({ siteId }) {
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState('');
  const router = useRouter();

  async function handleScan() {
    setScanning(true);
    setStatus('Scanning mobile...');

    try {
      // Mobile scan
      const mobileRes = await fetch('/api/scan/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, strategy: 'mobile' }),
      });
      const mobileData = await mobileRes.json();
      if (!mobileRes.ok) throw new Error(mobileData.details || mobileData.error);

      setStatus(`Mobile: ${mobileData.scores.performance} — Scanning desktop...`);

      // Desktop scan
      const desktopRes = await fetch('/api/scan/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, strategy: 'desktop' }),
      });
      const desktopData = await desktopRes.json();
      if (!desktopRes.ok) throw new Error(desktopData.details || desktopData.error);

      setStatus(`Done! Mobile: ${mobileData.scores.performance} / Desktop: ${desktopData.scores.performance}`);

      // Refresh the page to show new data
      setTimeout(() => {
        router.refresh();
        setStatus('');
        setScanning(false);
      }, 2000);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      setScanning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {status && (
        <span className={`text-xs ${status.startsWith('Error') ? 'text-red-400' : 'text-blue-400'}`}>
          {scanning && !status.startsWith('Error') && !status.startsWith('Done') && (
            <span className="inline-block w-3 h-3 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin mr-1.5 align-middle" />
          )}
          {status}
        </span>
      )}
      <button
        onClick={handleScan}
        disabled={scanning}
        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {scanning ? 'Scanning...' : 'Scan Now'}
      </button>
    </div>
  );
}
