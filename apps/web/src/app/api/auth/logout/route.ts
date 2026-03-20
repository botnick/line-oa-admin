import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@line-oa/db';
import { getConfig } from '@line-oa/config';
import { getAppBaseUrl } from '@line-oa/config/settings';

const SESSION_COOKIE = 'session_token';

export const dynamic = 'force-dynamic';

/**
 * Inline logout logic — avoids calling destroySession()
 * which can lose async context when called indirectly.
 */
async function performLogout() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (token) {
      try {
        const config = getConfig();
        const secret = new TextEncoder().encode(config.SESSION_SECRET);
        const { payload } = await jwtVerify(token, secret);
        const sessionId = (payload as Record<string, unknown>).sessionId as string;
        if (sessionId) {
          await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
        }
      } catch {
        // Token invalid — just clear cookie
      }
    }

    // Clear the cookie
    cookieStore.set(SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
  } catch (err) {
    console.error('Logout cookie error:', err);
  }
}

/**
 * POST /api/auth/logout
 */
export async function POST(request: Request) {
  await performLogout();
  const req = { headers: { get: (name: string) => request.headers.get(name) } };
  return NextResponse.redirect(new URL('/login', getAppBaseUrl(req)), { status: 303 });
}

/**
 * GET /api/auth/logout (convenience — click link to logout)
 */
export async function GET(request: Request) {
  await performLogout();
  const req = { headers: { get: (name: string) => request.headers.get(name) } };
  return NextResponse.redirect(new URL('/login', getAppBaseUrl(req)), { status: 303 });
}
