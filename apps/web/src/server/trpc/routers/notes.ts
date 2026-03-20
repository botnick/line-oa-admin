import { z } from 'zod';
import { prisma } from '@line-oa/db';
import { router, protectedProcedure } from '../trpc';

/**
 * Notes router — CRUD for conversation notes.
 */
export const notesRouter = router({
  /** List notes for a conversation */
  list: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ input }) => {
      return prisma.note.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  /** Create a note */
  create: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        content: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let createdByName = undefined;
      if (ctx.session?.adminUserId) {
        const admin = await prisma.adminUser.findUnique({
          where: { id: ctx.session.adminUserId },
          select: { displayName: true },
        });
        if (admin) {
          createdByName = admin.displayName;
        }
      }
      const note = await prisma.note.create({ data: { ...input, createdByName } });
      const { publishSyncEvent } = await import('../../redis');
      await publishSyncEvent('CONVERSATION_UPDATED', {
        conversationId: input.conversationId,
        action: 'noteCreated',
      });
      return note;
    }),

  /** Update a note */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ input }) => {
      const note = await prisma.note.update({
        where: { id: input.id },
        data: { content: input.content },
      });
      const { publishSyncEvent } = await import('../../redis');
      await publishSyncEvent('CONVERSATION_UPDATED', {
        conversationId: note.conversationId,
        action: 'noteUpdated',
      });
      return note;
    }),

  /** Delete a note */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const note = await prisma.note.delete({ where: { id: input.id } });
      const { publishSyncEvent } = await import('../../redis');
      await publishSyncEvent('CONVERSATION_UPDATED', {
        conversationId: note.conversationId,
        action: 'noteDeleted',
      });
      return note;
    }),
});
