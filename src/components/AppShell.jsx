'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import SchedulePoller from './SchedulePoller';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login';

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 ml-64 p-8">{children}</main>
      <SchedulePoller />
    </>
  );
}
