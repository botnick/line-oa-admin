import { initTRPC, TRPCError } from '@trpc/server';
import { prisma } from '@line-oa/db';
import superjson from 'superjson';
import { getSession, type SessionPayload } from '@/server/auth/session';
import { cookies } from 'next/headers';

/**
 * tRPC initialization with session-based context.
 */

export interface TRPCContext {
  session: SessionPayload | null;
  cookieStore?: Awaited<ReturnType<typeof cookies>>;
}

export async function createContext(): Promise<TRPCContext> {
  const session = await getSession();
  try {
    const cookieStore = await cookies();
    return { session, cookieStore };
  } catch {
    return { session };
  }
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Protected procedure — requires authenticated session.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'กรุณาเข้าสู่ระบบ',
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session, // guaranteed non-null
    },
  });
});

/**
 * Super Admin procedure — requires SUPER_ADMIN role.
 * Used for sensitive operations like LINE account management.
 */
export const superAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await prisma.adminUser.findUnique({
    where: { id: ctx.session.adminUserId },
    select: { role: true },
  });

  if (user?.role !== 'SUPER_ADMIN') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'ต้องเป็น Super Admin เท่านั้น',
    });
  }

  return next({ ctx });
});
