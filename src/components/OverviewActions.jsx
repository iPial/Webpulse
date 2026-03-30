'use client';

import { useState } from 'react';

export default function OverviewActions({ teamId }) {
  const [slackStatus, setSlackStatus] = useState('idle');
  const [emailStatus, setEmailStatus] = useState('idle');

  async function handleSlack() {
    setSlackStatus('loading');
    try {
      const res = await fetch('/api/export/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setSlackStatus('success');
    } catch {
      setSlackStatus('error');
    }
    setTimeout(() => setSlackStatus('idle'), 4000);
  }

  async function handleEmail() {
    setEmailStatus('loading');
    try {
      const res = await fetch('/api/export/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setEmailStatus('success');
    } catch {
      setEmailStatus('error');
    }
    setTimeout(() => setEmailStatus('idle'), 4000);
  }

  return (
    <div className="flex gap-2">
      <ActionButton
        label="Send to Slack"
        status={slackStatus}
        onClick={handleSlack}
        icon="#"
      />
      <ActionButton
        label="Email Report"
        status={emailStatus}
        onClick={handleEmail}
        icon="@"
      />
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
