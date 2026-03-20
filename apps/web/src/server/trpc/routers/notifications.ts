import { z } from 'zod';
import { prisma } from '@line-oa/db';
import { router, protectedProcedure } from '../trpc';

export const notificationsRouter = router({
  /**
   * List notifications with cursor pagination + filter (all/unread).
   */
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(15),
      cursor: z.string().optional(),
      filter: z.enum(['all', 'unread']).default('all'),
    }))
    .query(async ({ ctx, input }) => {
      const { limit, cursor, filter } = input;
      const adminUserId = ctx.session.adminUserId;

      const where: any = { adminUserId };
      if (filter === 'unread') {
        where.isRead = false;
      }

      const items = await prisma.notification.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items,
        nextCursor,
      };
    }),

  /**
   * Get unread notification count.
   */
  getUnreadCount: protectedProcedure
    .query(async ({ ctx }) => {
      const count = await prisma.notification.count({
        where: {
          adminUserId: ctx.session.adminUserId,
          isRead: false,
        },
      });
      return count;
    }),

  /**
   * Mark a single notification as read.
   */
  markAsRead: protectedProcedure
    .input(z.object({
      id: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const adminUserId = ctx.session.adminUserId;

      if (input.id) {
        const notif = await prisma.notification.findUnique({
          where: { id: input.id },
        });
        if (!notif || notif.adminUserId !== adminUserId) {
          throw new Error('NOT_FOUND_OR_UNAUTHORIZED');
        }
        return prisma.notification.update({
          where: { id: input.id },
          data: { isRead: true },
        });
      }

      // Mark all as read
      return prisma.notification.updateMany({
        where: { adminUserId, isRead: false },
        data: { isRead: true },
      });
    }),

  /**
   * Toggle read/unread status of a single notification.
   */
  toggleRead: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const adminUserId = ctx.session.adminUserId;
      const notif = await prisma.notification.findUnique({
        where: { id: input.id },
      });
      if (!notif || notif.adminUserId !== adminUserId) {
        throw new Error('NOT_FOUND_OR_UNAUTHORIZED');
      }
      return prisma.notification.update({
        where: { id: input.id },
        data: { isRead: !notif.isRead },
      });
    }),

  /**
   * Delete a single notification.
   */
  delete: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const adminUserId = ctx.session.adminUserId;
      const notif = await prisma.notification.findUnique({
        where: { id: input.id },
      });
      if (!notif || notif.adminUserId !== adminUserId) {
        throw new Error('NOT_FOUND_OR_UNAUTHORIZED');
      }
      return prisma.notification.delete({
        where: { id: input.id },
      });
    }),
});
