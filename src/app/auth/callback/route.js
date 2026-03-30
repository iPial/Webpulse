import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Get redirect from query param (email OTP) or cookie (OAuth)
  const cookieStore = await cookies();
  const redirectParam = searchParams.get('redirect');
  const redirectCookie = cookieStore.get('auth_redirect')?.value;
  const redirect = redirectParam || (redirectCookie ? decodeURIComponent(redirectCookie) : '/');

  if (code) {
    const supabase = createServerSupabase(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const response = NextResponse.redirect(new URL(redirect, origin));
      // Clear the redirect cookie
      response.cookies.set('auth_redirect', '', { path: '/', maxAge: 0 });
      return response;
    }
  }

  // Auth error — redirect to login with error
  const response = NextResponse.redirect(new URL('/login?error=auth', origin));
  response.cookies.set('auth_redirect', '', { path: '/', maxAge: 0 });
  return response;
}
