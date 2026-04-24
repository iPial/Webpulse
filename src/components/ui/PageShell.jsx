'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

/**
 * <PageShell> — redesigned sidebar + main layout for authenticated pages.
 *
 * Coexists with the legacy <AppShell> + <Sidebar>. Pages opt into the
 * redesign by rendering their own <PageShell> inside the page component.
 * (AppShell is still the route-level wrapper; it just renders children
 * unchanged, and each reskinned page swaps in <PageShell> as its own top element.)
 *
 * Keeps LiveClock and a user-card (with sign-out) — the same functionality
 * the legacy Sidebar has, just restyled.
 *
 * Usage:
 *   <PageShell>
 *     <Topbar eyebrow="…" title="Overview" subtitle="…" actions={…} />
 *     <BentoGrid>…</BentoGrid>
 *   </PageShell>
 */

const NAV = [
  { href: '/', label: 'Overview', icon: GridIcon, match: (p) => p === '/' },
  { href: '/history', label: 'History', icon: HistoryIcon, match: (p) => p.startsWith('/history') },
  { href: '/logs', label: 'Logs', icon: LogsIcon, match: (p) => p.startsWith('/logs') },
  { href: '/settings', label: 'Settings', icon: GearIcon, match: (p) => p.startsWith('/settings') },
];

export default function PageShell({ children, className = '' }) {
  return (
    <div
      className={`app-shell-bg grid grid-cols-[240px_1fr] min-h-screen ${className}`}
      style={{ fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif' }}
    >
      <Sidebar />
      <main className="p-[32px] min-w-0">{children}</main>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname() || '/';

  return (
    <aside className="sticky top-0 h-screen flex flex-col p-[20px_16px] bg-paper/60 border-r border-line gap-4">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-[10px] px-[6px] pb-2">
        <span className="w-[32px] h-[32px] rounded-r-sm bg-ink text-lime grid place-items-center font-serif text-[18px] leading-none">
          W
        </span>
        <span className="font-semibold text-[15px] tracking-tight text-ink">Webpulse</span>
        <span className="pulse-dot ml-auto" />
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-[2px]">
        {NAV.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-[10px] px-[12px] py-[9px] rounded-r-sm text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-ink text-surface shadow-ink'
                  : 'text-ink-2 hover:bg-paper-2'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" active={active} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <LiveClock />
      <UserCard />
    </aside>
  );
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!mounted) {
    return (
      <div className="px-[12px] py-[10px]">
        <div className="h-[10px] rounded bg-paper-2 animate-pulse" />
      </div>
    );
  }

  const localTime = now.toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const utcTime = now.toUTCString().slice(17, 25);
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').split('/').slice(-1)[0] || 'local';

  return (
    <div className="px-[12px] py-[10px] rounded-r-sm bg-surface border border-line shadow-1">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[13px] text-ink tabular-nums">{localTime}</span>
        <span className="text-[10px] text-muted">{tz}</span>
      </div>
      <div className="text-[10px] text-muted mt-[2px] font-mono">{utcTime} UTC</div>
    </div>
  );
}

function UserCard() {
  const [user, setUser] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setUser(data))
      .catch(() => {});
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const { createBrowserSupabase } = await import('@/lib/supabase');
      const supabase = createBrowserSupabase();
      if (supabase) await supabase.auth.signOut();
      router.push('/login');
    } catch {
      router.push('/login');
    }
  }

  if (!user) {
    return (
      <div className="px-[12px] py-[10px] rounded-r-sm bg-surface border border-line shadow-1 flex items-center gap-[10px]">
        <div className="w-[32px] h-[32px] rounded-full bg-paper-2 animate-pulse shrink-0" />
        <div className="flex-1 space-y-[6px]">
          <div className="h-[8px] rounded bg-paper-2 animate-pulse w-3/4" />
          <div className="h-[6px] rounded bg-paper-2 animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  const initials = (user.email || '?').charAt(0).toUpperCase();

  return (
    <div className="px-[12px] py-[10px] rounded-r-sm bg-surface border border-line shadow-1">
      <div className="flex items-center gap-[10px]">
        <span className="w-[32px] h-[32px] rounded-full bg-lime text-lime-ink grid place-items-center font-bold text-[12px] shrink-0">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-ink truncate" title={user.email}>
            {user.email}
          </div>
          <div className="text-[10px] text-muted truncate">
            {user.role}{user.teamName ? ` · ${user.teamName}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="shrink-0 w-[26px] h-[26px] grid place-items-center rounded-full text-muted hover:text-ink hover:bg-paper-2 disabled:opacity-50"
          aria-label="Sign out"
          title="Sign out"
        >
          <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─────────── Icons ─────────── */

function GridIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
function HistoryIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function LogsIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}
function GearIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0 1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3 2 2 0 1 1-2.8-2.8 1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8 2 2 0 1 1 2.8-2.8 1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0 1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3 2 2 0 1 1 2.8 2.8 1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
