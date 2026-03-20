import { z } from 'zod';
import { prisma } from '@line-oa/db';
import { normalizeText } from '../../search/normalize';
import { router, protectedProcedure } from '../trpc';
import { getPublicR2Url } from '../../r2-client';
import { getAccessibleChannelIds, buildChannelWhere } from '../lib/channel-access';

/**
 * Contacts router — list and get contacts with channel access enforcement.
 */
export const contactsRouter = router({
  /** List contacts with cursor-based pagination + channel access */
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        search: z.string().optional(),
        lineAccountId: z.string().optional(),
        tagId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit, search, lineAccountId, tagId } = input;

      // Channel access control
      const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);
      const channelFilter = buildChannelWhere(accessibleIds, lineAccountId);

      if (channelFilter && '__denied' in channelFilter) {
        return { items: [], nextCursor: undefined, totalCount: 0 };
      }

      const where: Record<string, unknown> = {};

      // Filter contacts by their conversations' lineAccountId
      if (channelFilter) {
        where.conversations = { some: channelFilter };
      }

      if (search) {
        where.displayName = { contains: search, mode: 'insensitive' };
      }

      if (tagId) {
        where.tags = { some: { tagId } };
      }

      const [contacts, totalCount] = await Promise.all([
        prisma.contact.findMany({
          where,
          orderBy: { lastSeenAt: 'desc' },
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          include: {
            _count: {
              select: { conversations: true },
            },
            tags: {
              include: { tag: true },
              orderBy: { createdAt: 'desc' },
            },
            conversations: {
              where: channelFilter && !('__denied' in channelFilter) ? channelFilter : undefined,
              take: 1,
              orderBy: { lastMessageAt: 'desc' },
              select: {
                lineAccount: {
                  select: { id: true, displayName: true, pictureUrl: true },
                },
              },
            },
          },
        }),
        prisma.contact.count({ where }),
      ]);

      let nextCursor: string | undefined;
      if (contacts.length > limit) {
        const next = contacts.pop();
        nextCursor = next?.id;
      }

      const items = contacts.map(contact => ({
        ...contact,
        avatarUrl: contact.avatarR2Key
          ? getPublicR2Url(contact.avatarR2Key) || contact.pictureUrl
          : contact.pictureUrl,
        tags: contact.tags.map(ct => ct.tag),
        lineAccount: contact.conversations[0]?.lineAccount || null,
      }));

      return {
        items,
        nextCursor,
        totalCount,
      };
    }),

  /** Get single contact with conversations */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);
      const channelFilter = buildChannelWhere(accessibleIds, undefined);

      const contact = await prisma.contact.findUnique({
        where: { id: input.id },
        include: {
          conversations: {
            where: channelFilter && !('__denied' in channelFilter) ? channelFilter : undefined,
            orderBy: { lastMessageAt: 'desc' },
            take: 5,
            include: {
              lineAccount: {
                select: { id: true, displayName: true, pictureUrl: true },
              },
            },
          },
          tags: {
            include: { tag: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!contact) return null;

      return {
        ...contact,
        avatarUrl: contact.avatarR2Key
          ? getPublicR2Url(contact.avatarR2Key) || contact.pictureUrl
          : contact.pictureUrl,
        tags: contact.tags.map(ct => ct.tag),
      };
    }),

  /** Update contact details (displayName, etc) */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        displayName: z.string().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, displayName } = input;
      const data: Record<string, any> = {};
      if (displayName !== undefined) {
        data.displayName = displayName;
        data.displayNameNormalized = normalizeText(displayName);
      }

      const contact = await prisma.contact.update({
        where: { id },
        data,
      });

      // Broadcast realtime update
      const { publishSyncEvent } = await import('../../redis');
      await publishSyncEvent('CONTACT_UPDATED', { contactId: id });

      return contact;
    }),

  /** Get follow/unfollow history for a contact */
  followHistory: protectedProcedure
    .input(z.object({ contactId: z.string() }))
    .query(async ({ input }) => {
      const logs = await prisma.contactFollowLog.findMany({
        where: { contactId: input.contactId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return logs.map((log) => ({
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
      }));
    }),
});
