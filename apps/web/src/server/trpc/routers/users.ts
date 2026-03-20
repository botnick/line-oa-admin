import { z } from 'zod';
import { router, superAdminProcedure } from '../trpc';
import { prisma } from '@line-oa/db';
import { TRPCError } from '@trpc/server';

export const usersRouter = router({
  /** List all admin users with channel access info (SUPER_ADMIN only) */
  list: superAdminProcedure.query(async () => {
    return prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        displayName: true,
        pictureUrl: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        channelAccess: {
          select: {
            lineAccountId: true,
            lineAccount: {
              select: { id: true, displayName: true, basicId: true, pictureUrl: true },
            },
          },
        },
      },
    });
  }),

  /** Update channel access for a user (SUPER_ADMIN only) */
  updateChannelAccess: superAdminProcedure
    .input(z.object({
      userId: z.string(),
      lineAccountIds: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      const { userId, lineAccountIds } = input;

      // Verify user exists
      const user = await prisma.adminUser.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้งาน' });
      }

      // Replace all channel access in a transaction
      await prisma.$transaction([
        prisma.adminChannelAccess.deleteMany({ where: { adminUserId: userId } }),
        ...(lineAccountIds.length > 0
          ? [prisma.adminChannelAccess.createMany({
              data: lineAccountIds.map((lineAccountId) => ({
                adminUserId: userId,
                lineAccountId,
              })),
              skipDuplicates: true,
            })]
          : []),
      ]);

      // Broadcast so the target admin's UI updates in realtime
      const { publishSyncEvent } = await import('../../redis');
      await publishSyncEvent('CHANNEL_ACCESS_UPDATED', {
        targetAdminUserId: userId,
        lineAccountIds,
      });

      return { success: true };
    }),

  /** Update user role (SUPER_ADMIN only) */
  updateRole: superAdminProcedure
    .input(z.object({ id: z.string(), role: z.enum(['ADMIN', 'SUPER_ADMIN']) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.adminUserId === input.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'ไม่สามารถเปลี่ยน Role ของตัวเองได้' });
      }
      return prisma.adminUser.update({
        where: { id: input.id },
        data: { role: input.role },
      });
    }),

  /** Toggle user active status (SUPER_ADMIN only) */
  toggleActive: superAdminProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.adminUserId === input.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'ไม่สามารถระงับบัญชีของตัวเองได้' });
      }
      return prisma.adminUser.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
    }),

  /** Delete user (SUPER_ADMIN only) */
  delete: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.adminUserId === input.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'ไม่สามารถลบบัญชีของตัวเองได้' });
      }
      await prisma.adminUser.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
