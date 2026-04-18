'use client';

import { useState, useEffect } from 'react';

export default function ScheduleBanner({ teamId }) {
  const [nextSchedule, setNextSchedule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    async function fetchNext() {
      try {
        const res = await fetch(`/api/schedules?teamId=${teamId}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const pending = (data.schedules || [])
          .filter((s) => s.config?.status === 'pending' && s.config?.scheduledAt)
          .sort((a, b) => new Date(a.config.scheduledAt) - new Date(b.config.scheduledAt));

        setNextSchedule(pending[0] || null);
      } catch {
        // Silently fail — banner is non-critical
      } finally {
        setLoading(false);
      }
    }

    fetchNext();
  }, [teamId]);

  function formatTime(isoString) {
    try {
      return new Date(isoString).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoString;
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 flex items-center gap-2 text-sm text-blue-400 mb-6">
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <span>
        {nextSchedule ? (
          <>
            Next scheduled scan: <strong>{formatTime(nextSchedule.config.scheduledAt)}</strong>
            <span className="text-blue-500/60 ml-1">
              ({nextSchedule.config.frequency !== 'once' ? nextSchedule.config.frequency : 'one-time'})
            </span>
          </>
        ) : (
          <>
            Automated scans run <strong>daily at 6:00 AM UTC</strong>. Weekly sites scan on Mondays, monthly on the 1st.
          </>
        )}
      </span>
    </div>
  );
}
