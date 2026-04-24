'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Field';
import Sparkline from '@/components/ui/charts/Sparkline';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="bg-paper min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'magic'
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const redirect = searchParams.get('redirect') || '/';
  const configured = supabase !== null;

  // Redirect already-authenticated users
  useEffect(() => {
    if (!configured) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(redirect);
    });
  }, [supabase, router, redirect, configured]);

  // Show error from callback
  useEffect(() => {
    if (searchParams.get('error') === 'auth') {
      setError('Authentication failed. Please try again.');
    }
  }, [searchParams]);

  if (!configured) {
    return (
      <main className="bg-paper min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-[44px] text-ink mb-3">Webpulse</h1>
          <div className="rounded-r-md bg-warn-bg border border-warn/30 p-5 text-sm text-[#8A5A00] text-left">
            <p className="font-semibold mb-2">Supabase not configured</p>
            <p>
              Set <code className="font-mono text-[12px] bg-warn/10 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
              <code className="font-mono text-[12px] bg-warn/10 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your{' '}
              <code className="font-mono text-[12px] bg-warn/10 px-1 rounded">.env.local</code> file.
            </p>
          </div>
        </div>
      </main>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
          },
        });
        if (error) throw error;
        setMessage('Check your email for the login link.');
      } else if (mode === 'signup') {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
          },
        });
        if (error) throw error;
        setMessage('Check your email to confirm your account.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.replace(redirect);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function storeRedirect() {
    if (redirect !== '/') {
      document.cookie = `auth_redirect=${encodeURIComponent(redirect)};path=/;max-age=600;SameSite=Lax`;
    }
  }

  async function handleGoogleLogin() {
    storeRedirect();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  async function handleGitHubLogin() {
    storeRedirect();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  const isPasswordMode = mode === 'signin' || mode === 'signup';

  return (
    <div
      className="app-shell-bg min-h-screen grid lg:grid-cols-[1.05fr_1fr] grid-cols-1"
      style={{ fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif' }}
    >
      {/* LEFT — hero */}
      <aside className="hidden lg:flex flex-col justify-between p-[56px_64px]">
        <div className="flex items-center gap-[10px]">
          <span className="w-[32px] h-[32px] rounded-r-sm bg-ink text-lime grid place-items-center font-serif text-[18px] leading-none">
            W
          </span>
          <span className="font-semibold text-[15px] tracking-tight text-ink">Webpulse</span>
          <span className="pulse-dot" />
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted">
            {mode === 'signup' ? 'Get started' : mode === 'magic' ? 'Magic link sign-in' : 'Welcome back'}
          </span>
          <h1 className="font-serif text-[52px] leading-[1.05] tracking-tight text-ink mt-3">
            Give your site a{' '}
            <span
              className="inline-block px-[10px] rounded-[10px] shadow-lime"
              style={{ background: 'var(--lime)', color: 'var(--lime-ink)', transform: 'rotate(-1deg)' }}
            >
              pulse
            </span>
            .<br />
            Keep it <em className="text-orange not-italic font-serif italic">alive.</em>
          </h1>

          {/* mini preview */}
          <div
            className="mt-[38px] rounded-r-xl p-[22px] shadow-ink"
            style={{ background: 'var(--ink)', color: 'var(--surface)' }}
          >
            <div className="grid grid-cols-2 gap-[14px]">
              <PreviewTile label="Performance (mobile)" num="43" color="var(--orange)" data={[30, 38, 42, 28, 38, 57, 43]} />
              <PreviewTile label="Accessibility" num="84" color="var(--warn)" data={[84, 84, 84, 84, 81, 84, 84]} />
              <PreviewTile label="Best Practices" num="100" color="var(--good)" data={[100, 100, 100, 100, 100, 100, 100]} />
              <PreviewTile label="SEO" num="92" color="var(--good)" data={[85, 92, 92, 92, 92, 92, 92]} />
            </div>
          </div>
        </div>

        <div className="text-[12px] text-muted">
          Trusted by WordPress agencies for automated PageSpeed monitoring.
        </div>
      </aside>

      {/* RIGHT — auth form */}
      <main className="flex items-center justify-center px-[20px] py-[40px]">
        <div
          className="w-full max-w-[440px] rounded-r-xl bg-surface border border-line shadow-3 p-[36px]"
        >
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-orange">
            {mode === 'signup' ? 'Get started' : mode === 'magic' ? 'Passwordless' : 'Welcome back'}
          </div>
          <h2 className="font-serif text-[32px] leading-tight text-ink mt-[6px] mb-[22px]">
            {mode === 'signup' ? 'Create your account' : 'Sign in to Webpulse'}
          </h2>

          {error && (
            <div className="rounded-r-sm bg-bad-bg border border-bad/20 p-3 text-[13px] text-bad mb-4">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-r-sm bg-good-bg border border-good/20 p-3 text-[13px] text-good mb-4">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-[12px]">
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </Field>

            {isPasswordMode && (
              <Field label="Password" htmlFor="pw">
                <Input
                  id="pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                />
              </Field>
            )}

            <Button type="submit" variant="ink" size="lg" disabled={loading} className="w-full justify-center mt-1">
              {loading
                ? (mode === 'magic' ? 'Sending link…' : mode === 'signup' ? 'Creating account…' : 'Signing in…')
                : (mode === 'magic' ? 'Send magic link' : mode === 'signup' ? 'Create account' : 'Sign in')}
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Button>

            {mode === 'signin' && (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => { setMode('magic'); setError(''); setMessage(''); }}
                className="w-full justify-center"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M3 8l9 6 9-6" />
                </svg>
                Use magic link instead
              </Button>
            )}
            {mode === 'magic' && (
              <Button
                type="button" variant="ghost" size="md"
                onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
                className="w-full justify-center"
              >
                Use password instead
              </Button>
            )}
          </form>

          <div className="relative my-[18px] text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <span className="relative inline-block bg-surface px-2 text-[12px] text-muted">or continue with</span>
          </div>

          <div className="grid grid-cols-2 gap-[10px]">
            <Button type="button" onClick={handleGoogleLogin} className="justify-center">
              <svg width="16" height="16" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.7 6.1 29.1 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.1 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C33.7 6.1 29.1 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.1 0 9.6-1.9 13.1-5l-6-5.1c-2 1.4-4.5 2.2-7.1 2.2-5.2 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.7 2.1-2 4-3.7 5.3l6 5.1C41.3 35 44 29.9 44 24c0-1.3-.1-2.7-.4-3.9z" />
              </svg>
              Google
            </Button>
            <Button type="button" onClick={handleGitHubLogin} className="justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.9 1.2 2 1.2 3.2 0 4.6-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
              </svg>
              GitHub
            </Button>
          </div>

          <div className="text-center text-[13px] text-muted mt-[22px]">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
                  className="text-ink font-medium hover:underline"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="text-ink font-medium hover:underline">
                  Sign up free
                </Link>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function PreviewTile({ label, num, color, data }) {
  return (
    <div
      className="rounded-[16px] p-[14px]"
      style={{ background: 'rgba(255,255,255,0.05)' }}
    >
      <div className="text-[11px]" style={{ color: '#A4A0AB' }}>{label}</div>
      <div className="font-serif text-[40px] leading-none tracking-tight" style={{ color }}>{num}</div>
      <Sparkline data={data} color={color} height={40} />
    </div>
  );
}
