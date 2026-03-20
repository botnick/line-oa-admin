import { z } from 'zod';
import { prisma } from '@line-oa/db';
import { router, protectedProcedure } from '../trpc';
import { publishSyncEvent } from '@/server/redis';
import { withCache, invalidateCache } from '@/server/cache';

/**
 * Labels router — CRUD for conversation labels + assign/remove.
 */
export const labelsRouter = router({
  /** List all labels optionally scoped by lineAccount */
  list: protectedProcedure
    .input(z.object({ lineAccountId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const cacheKey = `labels:list:${input?.lineAccountId || 'all'}`;
      return withCache(cacheKey, 86400, () => {
        const where = input?.lineAccountId ? { lineAccountId: input.lineAccountId } : {};
        return prisma.label.findMany({
          where,
          orderBy: { name: 'asc' },
          include: { _count: { select: { conversations: true } } },
        });
      });
    }),

  /** Create a new label */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        color: z.string().default('#10b981'),
        lineAccountId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const label = await prisma.label.create({ data: input });
      await invalidateCache('labels:list:*');
      await publishSyncEvent('LABEL_UPDATED', { action: 'created', labelId: label.id });
      return label;
    }),

  /** Update a label */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(50).optional(),
        color: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const label = await prisma.label.update({ where: { id }, data });
      await invalidateCache('labels:list:*');
      await invalidateCache('labels:conversation:*');
      await publishSyncEvent('LABEL_UPDATED', { action: 'updated', labelId: label.id });
      return label;
    }),

  /** Delete a label */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const label = await prisma.label.delete({ where: { id: input.id } });
      await invalidateCache('labels:list:*');
      await invalidateCache('labels:conversation:*');
      await publishSyncEvent('LABEL_UPDATED', { action: 'deleted', labelId: input.id });
      return label;
    }),

  /** Get labels for a specific conversation */
  getForConversation: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ input }) => {
      return withCache(`labels:conversation:${input.conversationId}`, 86400, async () => {
        const convLabels = await prisma.conversationLabel.findMany({
          where: { conversationId: input.conversationId },
          include: { label: true },
          orderBy: { createdAt: 'desc' },
        });
        return convLabels.map((cl) => cl.label);
      });
    }),

  /** Assign a label to a conversation */
  assign: protectedProcedure
    .input(z.object({ conversationId: z.string(), labelId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await prisma.conversationLabel.upsert({
        where: {
          conversationId_labelId: {
            conversationId: input.conversationId,
            labelId: input.labelId,
          },
        },
        create: { conversationId: input.conversationId, labelId: input.labelId },
        update: {},
      });
      await invalidateCache('labels:list:*');
      await invalidateCache(`labels:conversation:${input.conversationId}`);
      await publishSyncEvent('LABEL_UPDATED', { action: 'assigned', conversationId: input.conversationId, labelId: input.labelId });
      return result;
    }),

  /** Remove a label from a conversation */
  remove: protectedProcedure
    .input(z.object({ conversationId: z.string(), labelId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await prisma.conversationLabel.deleteMany({
        where: { conversationId: input.conversationId, labelId: input.labelId },
      });
      await invalidateCache('labels:list:*');
      await invalidateCache(`labels:conversation:${input.conversationId}`);
      await publishSyncEvent('LABEL_UPDATED', { action: 'removed', conversationId: input.conversationId, labelId: input.labelId });
      return result;
    }),
});
