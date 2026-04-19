'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Silent client-side fallback for scheduling.
// Every 60s (while any dashboard page is open) calls POST /api/schedules/run
// with no body — the endpoint fires any pending schedules whose scheduledAt
// has passed. This makes scheduling work regardless of QStash.
export default function SchedulePoller() {
  const pathname = usePathname();
  const timerRef = useRef(null);
  const firingRef = useRef(false);

  useEffect(() => {
    // Skip on login/auth pages
    if (!pathname || pathname === '/login' || pathname.startsWith('/auth')) return;

    async function checkPending() {
      if (firingRef.current) return;
      firingRef.current = true;
      try {
        await fetch('/api/schedules/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      } catch {
        // Silent — user doesn't need to know about transient polling failures
      } finally {
        firingRef.current = false;
      }
    }

    // Fire once on mount (catches anything immediately due)
    checkPending();

    // Then every 60 seconds
    timerRef.current = setInterval(checkPending, 60000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pathname]);

  return null;
}
