import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@line-oa/db';
import { getConfig } from '@line-oa/config';
import dayjs from 'dayjs';

/**
 * Session Management
 *
 * Uses JWE (encrypted JWT) stored in httpOnly cookie.
 * Session record also stored in DB for revocation.
 */

const SESSION_COOKIE = 'session_token';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

/** Get the secret key for JWT signing */
function getSecret() {
  const config = getConfig();
  return new TextEncoder().encode(config.SESSION_SECRET);
}

export interface SessionPayload {
  sessionId: string;
  adminUserId: string;
  lineUserId: string;
}

/**
 * Create a new session for an admin user.
 * Stores session in DB and sets httpOnly cookie.
 */
export async function createSession(
  adminUser: { id: string; lineUserId: string },
  req?: { headers: { get(name: string): string | null } }
): Promise<string> {
  const expiresAt = dayjs().add(30, 'day').toDate();

  const session = await prisma.session.create({
    data: {
      adminUserId: adminUser.id,
      token: crypto.randomUUID(),
      expiresAt,
      userAgent: req?.headers.get('user-agent') ?? null,
      ipAddress: req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    },
  });

  const payload: SessionPayload = {
    sessionId: session.id,
    adminUserId: adminUser.id,
    lineUserId: adminUser.lineUserId,
  };

  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  return session.id;
}

/**
 * Get the current session from the request cookie.
 * Returns null if no valid session exists.
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getSecret());
    const sessionPayload = payload as unknown as SessionPayload;

    // Verify session still exists in DB and hasn't expired
    const dbSession = await prisma.session.findUnique({
      where: { id: sessionPayload.sessionId },
    });

    if (!dbSession || dayjs(dbSession.expiresAt).isBefore(dayjs())) {
      // Session expired or revoked — clean up
      if (dbSession) {
        await prisma.session.delete({ where: { id: dbSession.id } });
      }
      return null;
    }

    return sessionPayload;
  } catch {
    return null;
  }
}

/**
 * Destroy the current session.
 */
export async function destroySession(
  givenCookieStore?: Awaited<ReturnType<typeof cookies>>
): Promise<void> {
  const session = await getSession();
  if (session) {
    await prisma.session.delete({ where: { id: session.sessionId } }).catch(() => {});
  }

  const cookieStore = givenCookieStore ?? (await cookies());
  cookieStore.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Get the current admin user from the session.
 */
export async function getCurrentAdmin() {
  const session = await getSession();
  if (!session) return null;

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminUserId },
  });

  if (!admin || !admin.isActive) return null;

  return admin;
}
