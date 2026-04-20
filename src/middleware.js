import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Routes that don't require authentication
const publicRoutes = ['/login', '/auth/callback'];

// Routes that use their own auth (cron secret, QStash signature)
const serviceRoutes = [
  '/api/scan/trigger',
  '/api/scan/worker',
  '/api/scan/notify',
  '/api/webhook',
  '/api/schedules/run', // Called by QStash (no session cookie) + logged-in UI
  '/api/logs/ping',     // Called by the diagnostic QStash job
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Skip auth for public and service routes
  if (publicRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }
  if (serviceRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Skip auth if Supabase is not configured (local dev without env vars)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh the session — this is critical for keeping tokens alive
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (for non-API routes)
  if (!user && !pathname.startsWith('/api/')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Return 401 for unauthenticated API requests
  if (!user && pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
