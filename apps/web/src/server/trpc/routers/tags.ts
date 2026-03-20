import { z } from 'zod';
import { prisma } from '@line-oa/db';
import { router, protectedProcedure } from '../trpc';
import { publishSyncEvent } from '@/server/redis';
import { withCache, invalidateCache } from '@/server/cache';

/**
 * Tags router — CRUD for contact tags + assign/remove.
 */
export const tagsRouter = router({
  /** List all tags optionally scoped by lineAccount */
  list: protectedProcedure
    .input(z.object({ lineAccountId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const cacheKey = `tags:list:${input?.lineAccountId || 'all'}`;
      return withCache(cacheKey, 86400, () => {
        const where = input?.lineAccountId ? { lineAccountId: input.lineAccountId } : {};
        return prisma.tag.findMany({
          where,
          orderBy: { name: 'asc' },
          include: { _count: { select: { contacts: true } } },
        });
      });
    }),

  /** Create a new tag */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        color: z.string().default('#6366f1'),
        lineAccountId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const tag = await prisma.tag.create({ data: input });
      await invalidateCache('tags:list:*');
      await publishSyncEvent('TAG_UPDATED', { action: 'created', tagId: tag.id });
      return tag;
    }),

  /** Update a tag */
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
      const tag = await prisma.tag.update({ where: { id }, data });
      await invalidateCache('tags:list:*');
      await invalidateCache('tags:contact:*');
      await publishSyncEvent('TAG_UPDATED', { action: 'updated', tagId: tag.id });
      return tag;
    }),

  /** Delete a tag */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const tag = await prisma.tag.delete({ where: { id: input.id } });
      await invalidateCache('tags:list:*');
      await invalidateCache('tags:contact:*');
      await publishSyncEvent('TAG_UPDATED', { action: 'deleted', tagId: input.id });
      return tag;
    }),

  /** Get tags for a specific contact */
  getForContact: protectedProcedure
    .input(z.object({ contactId: z.string() }))
    .query(async ({ input }) => {
      return withCache(`tags:contact:${input.contactId}`, 86400, async () => {
        const contactTags = await prisma.contactTag.findMany({
          where: { contactId: input.contactId },
          include: { tag: true },
          orderBy: { createdAt: 'desc' },
        });
        return contactTags.map((ct) => ct.tag);
      });
    }),

  /** Assign a tag to a contact */
  assign: protectedProcedure
    .input(z.object({ contactId: z.string(), tagId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await prisma.contactTag.upsert({
        where: { contactId_tagId: { contactId: input.contactId, tagId: input.tagId } },
        create: { contactId: input.contactId, tagId: input.tagId },
        update: {},
      });
      await invalidateCache('tags:list:*');
      await invalidateCache(`tags:contact:${input.contactId}`);
      await publishSyncEvent('TAG_UPDATED', { action: 'assigned', contactId: input.contactId, tagId: input.tagId });
      return result;
    }),

  /** Remove a tag from a contact */
  remove: protectedProcedure
    .input(z.object({ contactId: z.string(), tagId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await prisma.contactTag.deleteMany({
        where: { contactId: input.contactId, tagId: input.tagId },
      });
      await invalidateCache('tags:list:*');
      await invalidateCache(`tags:contact:${input.contactId}`);
      await publishSyncEvent('TAG_UPDATED', { action: 'removed', contactId: input.contactId, tagId: input.tagId });
      return result;
    }),
});
