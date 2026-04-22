'use client';

import { useState } from 'react';

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
        <ActionButton
          label="Send to Slack"
          status={slackStatus}
          onClick={handleSlack}
          icon="#"
        />
        <ActionButton
          label="Weekly Trend"
          status={trendStatus}
          onClick={handleTrend}
          icon="📈"
        />
        <ActionButton
          label="Email Report"
          status={emailStatus}
          onClick={handleEmail}
          icon="@"
        />
      </div>
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400 max-w-md">
          <span className="flex-1">{errorMsg}</span>
          <button onClick={dismissError} className="text-red-500 hover:text-red-300 shrink-0">
            &times;
          </button>
        </div>
      )}
    </div>
  );
}

function ActionButton({ label, status, onClick, icon }) {
  const isLoading = status === 'loading';

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:cursor-not-allowed ${
        status === 'success'
          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
          : status === 'error'
          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
          : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
      }`}
    >
      {isLoading ? (
        <span className="w-3 h-3 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
      ) : (
        <span className="font-bold">{icon}</span>
      )}
      {status === 'success' ? 'Sent!' : status === 'error' ? 'Failed' : label}
    </button>
  );
}
