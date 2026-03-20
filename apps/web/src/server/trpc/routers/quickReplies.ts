import { z } from 'zod';
import { prisma } from '@line-oa/db';
import { router, protectedProcedure } from '../trpc';

export const quickRepliesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.quickReply.findMany({
      where: { userId: ctx.session.adminUserId },
      orderBy: { createdAt: 'desc' },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        content: z.string().min(1).max(2000),
        category: z.string().optional(),
        shortcut: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { title, content, category, shortcut } = input;
      return prisma.quickReply.create({
        data: {
          title,
          content,
          category,
          shortcut,
          userId: ctx.session.adminUserId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(100).optional(),
        content: z.string().min(1).max(2000).optional(),
        category: z.string().nullable().optional(),
        shortcut: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      // Only allow updating own quick replies
      return prisma.quickReply.update({
        where: { id, userId: ctx.session.adminUserId },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Only allow deleting own quick replies
      return prisma.quickReply.delete({
        where: { id: input.id, userId: ctx.session.adminUserId },
      });
    }),
});
