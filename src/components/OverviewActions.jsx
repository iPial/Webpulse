'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';

export default function OverviewActions({ teamId }) {
  const [slackStatus, setSlackStatus] = useState('idle');
  const [trendStatus, setTrendStatus] = useState('idle');
  const [emailStatus, setEmailStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSlack() {
    setSlackStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/export/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed');
      }
      setSlackStatus('success');
      setTimeout(() => setSlackStatus('idle'), 5000);
    } catch (err) {
      setSlackStatus('error');
      setErrorMsg(err.message);
    }
  }

  async function handleTrend() {
    setTrendStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/export/trend-slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed');
      }
      setTrendStatus('success');
      setTimeout(() => setTrendStatus('idle'), 5000);
    } catch (err) {
      setTrendStatus('error');
      setErrorMsg(err.message);
    }
  }

  async function handleEmail() {
    setEmailStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/export/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed');
      }
      setEmailStatus('success');
      setTimeout(() => setEmailStatus('idle'), 5000);
    } catch (err) {
      setEmailStatus('error');
      setErrorMsg(err.message);
    }
  }

  function dismissError() {
    setErrorMsg('');
    setSlackStatus('idle');
    setTrendStatus('idle');
    setEmailStatus('idle');
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2 flex-wrap">
        <ActionButton label="Send to Slack" status={slackStatus} onClick={handleSlack} icon="#" />
        <ActionButton label="Weekly trend" status={trendStatus} onClick={handleTrend} icon="📈" />
        <ActionButton label="Email report" status={emailStatus} onClick={handleEmail} icon="@" />
      </div>
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-r-sm bg-bad-bg border border-bad/20 px-3 py-2 text-[12px] text-bad max-w-md">
          <span className="flex-1">{errorMsg}</span>
          <button onClick={dismissError} className="text-bad hover:opacity-80 shrink-0" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function ActionButton({ label, status, onClick, icon }) {
  const isLoading = status === 'loading';
  const variant =
    status === 'success' ? 'primary' : status === 'error' ? 'danger' : 'default';

  return (
    <Button onClick={onClick} disabled={isLoading} variant={variant} size="sm">
      {isLoading ? (
        <span className="w-3 h-3 border-2 border-line border-t-ink rounded-full animate-spin" />
      ) : (
        <span className="font-bold">{icon}</span>
      )}
      {status === 'success' ? 'Sent!' : status === 'error' ? 'Failed' : label}
    </Button>
  );
}
