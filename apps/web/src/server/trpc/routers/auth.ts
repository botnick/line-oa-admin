import { prisma } from '@line-oa/db';
import { router, protectedProcedure } from '../trpc';
import { destroySession } from '../../auth/session';

/**
 * Auth router — current user info and logout.
 */
export const authRouter = router({
  /** Get current admin user */
  me: protectedProcedure.query(async ({ ctx }) => {
    const admin = await prisma.adminUser.findUnique({
      where: { id: ctx.session.adminUserId },
      select: {
        id: true,
        lineUserId: true,
        displayName: true,
        pictureUrl: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return admin;
  }),

  /** Logout */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      await destroySession(ctx.cookieStore);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: String(error) };
    }
  }),
});
