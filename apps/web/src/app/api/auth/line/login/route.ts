import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getLoginUrl } from '@/server/auth/line-login';

/**
 * GET /api/auth/line/login
 *
 * Initiates LINE Login OAuth flow:
 * 1. Generate random state + nonce
 * 2. Store in cookie for verification on callback
 * 3. Redirect to LINE Login
 */
export async function GET(request: Request) {
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();

  // Store state + nonce in temporary cookie
  const cookieStore = await cookies();
  cookieStore.set('line_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });
  cookieStore.set('line_oauth_nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const req = { headers: { get: (name: string) => request.headers.get(name) } };
  const loginUrl = getLoginUrl(state, nonce, req);

  return NextResponse.redirect(loginUrl);
}
