'use client';

import { usePathname } from 'next/navigation';
import SchedulePoller from './SchedulePoller';

// Every authenticated page now renders its own <PageShell> (sidebar + topbar).
// AppShell's job is minimal: hide chrome on auth pages, and mount the
// background SchedulePoller everywhere else so scheduled scans keep firing.
export default function AppShell({ children }) {
  const pathname = usePathname() || '/';
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <SchedulePoller />
    </>
  );
}
