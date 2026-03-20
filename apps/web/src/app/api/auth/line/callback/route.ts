import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@line-oa/db';
import { getAppBaseUrl } from '@line-oa/config/settings';
import { exchangeCode, verifyIdToken } from '@/server/auth/line-login';
import { createSession } from '@/server/auth/session';
import dayjs from 'dayjs';

/**
 * GET /api/auth/line/callback
 *
 * LINE Login OAuth callback:
 * 1. Verify state matches cookie
 * 2. Exchange code for tokens
 * 3. Verify ID token with nonce
 * 4. Check admin authorization via Database
 * 5. Create/update AdminUser
 * 6. Create session
 * 7. Redirect to /inbox
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const req = { headers: { get: (name: string) => request.headers.get(name) } };
  const baseUrl = getAppBaseUrl(req);

  // Handle LINE Login errors
  if (error) {
    console.error('[auth] LINE Login error:', error);
    return NextResponse.redirect(new URL('/login?error=line_denied', baseUrl));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=missing_params', baseUrl));
  }

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get('line_oauth_state')?.value;
  const storedNonce = cookieStore.get('line_oauth_nonce')?.value;

  // Clean up OAuth cookies
  cookieStore.delete('line_oauth_state');
  cookieStore.delete('line_oauth_nonce');

  if (!storedState || state !== storedState) {
    console.error('[auth] State mismatch');
    return NextResponse.redirect(new URL('/login?error=invalid_state', baseUrl));
  }

  if (!storedNonce) {
    return NextResponse.redirect(new URL('/login?error=missing_nonce', baseUrl));
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code, req);

    // Verify ID token
    const profile = await verifyIdToken(tokens.id_token, storedNonce);

    // --- Authorization: Database-driven ---
    const existingUser = await prisma.adminUser.findUnique({
      where: { lineUserId: profile.userId },
    });

    // Check if this is the very first admin (bootstrap)
    const totalAdmins = await prisma.adminUser.count();
    const isFirstUser = totalAdmins === 0;

    if (!isFirstUser && !existingUser) {
      // Not first user AND not in DB → register as pending
      await prisma.adminUser.create({
        data: {
          lineUserId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          role: 'ADMIN',
          isActive: false,
          lastLoginAt: dayjs().toDate(),
        }
      });
      console.info('[auth] New user registered, pending approval:', profile.userId);
      return NextResponse.redirect(new URL('/login?error=pending_approval', baseUrl));
    }

    if (existingUser && !existingUser.isActive) {
      // In DB but deactivated/pending → reject with pending message
      console.warn('[auth] Deactivated/pending admin login attempt:', profile.userId);
      return NextResponse.redirect(new URL('/login?error=pending_approval', baseUrl));
    }

    // Create or update admin user
    const adminUser = await prisma.adminUser.upsert({
      where: { lineUserId: profile.userId },
      update: {
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        lastLoginAt: dayjs().toDate(),
      },
      create: {
        lineUserId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        role: isFirstUser ? 'SUPER_ADMIN' : 'ADMIN',
        lastLoginAt: dayjs().toDate(),
      },
    });

    if (isFirstUser) {
      console.info('[auth] First admin bootstrapped as SUPER_ADMIN:', profile.userId);
    }

    // Create session
    await createSession(adminUser, req);

    // Redirect to inbox
    return NextResponse.redirect(new URL('/inbox', baseUrl));
  } catch (err) {
    console.error('[auth] Callback error:', err);
    return NextResponse.redirect(new URL('/login?error=auth_failed', baseUrl));
  }
}
