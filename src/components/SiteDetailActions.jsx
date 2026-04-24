'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

export default function SiteDetailActions({ siteId }) {
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState('');
  const router = useRouter();

  async function handleScan() {
    setScanning(true);
    setStatus('Scanning mobile…');

    try {
      const mobileRes = await fetch('/api/scan/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, strategy: 'mobile' }),
      });
      const mobileData = await mobileRes.json();
      if (!mobileRes.ok) throw new Error(mobileData.details || mobileData.error);

      setStatus(`Mobile: ${mobileData.scores.performance} — scanning desktop…`);

      const desktopRes = await fetch('/api/scan/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, strategy: 'desktop' }),
      });
      const desktopData = await desktopRes.json();
      if (!desktopRes.ok) throw new Error(desktopData.details || desktopData.error);

      setStatus(`Done! Mobile: ${mobileData.scores.performance} / Desktop: ${desktopData.scores.performance}`);

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
    <div className="flex items-center gap-3 flex-wrap">
      {status && (
        <span
          className={`text-[12px] ${
            status.startsWith('Error') ? 'text-bad' : 'text-cobalt'
          }`}
        >
          {scanning && !status.startsWith('Error') && !status.startsWith('Done') && (
            <span className="inline-block w-3 h-3 border-2 border-line border-t-cobalt rounded-full animate-spin mr-1.5 align-middle" />
          )}
          {status}
        </span>
      )}
      <Button variant="ink" onClick={handleScan} disabled={scanning}>
        {scanning ? 'Scanning…' : 'Scan now'}
      </Button>
    </div>
  );
}
