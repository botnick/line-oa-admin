import { z } from 'zod';
import { prisma } from '@line-oa/db';
import { Prisma } from '@line-oa/db';
import { router, protectedProcedure } from '../trpc';
import { unifiedSearch } from '../../search/search-engine';
import { getAccessibleChannelIds, buildChannelWhere } from '../lib/channel-access';

/**
 * Search router — full-text search on messages with channel access control.
 */
export const searchRouter = router({
  /** Search messages across all conversations */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(20),
        lineAccountId: z.string().optional(),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { query, limit, lineAccountId, cursor } = input;

      // Channel access control
      const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);
      const channelFilter = buildChannelWhere(accessibleIds, lineAccountId);

      if (channelFilter && '__denied' in channelFilter) {
        return { items: [], nextCursor: undefined };
      }

      // Build where — messages have lineAccountId directly
      const messageWhere: Record<string, unknown> = {
        textContent: { contains: query, mode: Prisma.QueryMode.insensitive },
      };

      if (channelFilter) {
        messageWhere.lineAccountId = channelFilter.lineAccountId;
      }

      const messages = await prisma.message.findMany({
        where: messageWhere,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          conversation: {
            include: {
              lineAccount: true,
              contact: {
                select: {
                  id: true,
                  displayName: true,
                  pictureUrl: true,
                },
              },
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (messages.length > limit) {
        const next = messages.pop();
        nextCursor = next?.id;
      }

      return {
        items: messages,
        nextCursor,
      };
    }),

  /** Search messages within a specific conversation */
  searchInConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { conversationId, query, limit, cursor } = input;

      // Verify the admin has access to this conversation's channel
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { lineAccountId: true },
      });

      if (!conversation) return { items: [], nextCursor: undefined };

      const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);
      if (accessibleIds && !accessibleIds.includes(conversation.lineAccountId)) {
        return { items: [], nextCursor: undefined };
      }

      const messages = await prisma.message.findMany({
        where: {
          conversationId,
          textContent: { contains: query, mode: Prisma.QueryMode.insensitive },
        },
        select: {
          id: true,
          source: true,
          type: true,
          textContent: true,
          sentByName: true,
          createdAt: true,
          sentByAdmin: { select: { pictureUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (messages.length > limit) {
        const next = messages.pop();
        nextCursor = next?.id;
      }

      return {
        items: messages,
        nextCursor,
      };
    }),

  /** Unified search across contacts and messages */
  unifiedSearch: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(20),
        lineAccountId: z.string().optional(),
        scope: z.enum(['all', 'contacts', 'messages']).default('all'),
      })
    )
    .query(async ({ ctx, input }) => {
      // Channel access control
      const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);

      // Determine which channels to search for
      let searchAccountId = input.lineAccountId;
      if (!searchAccountId && accessibleIds) {
        // No specific channel selected — restrict to accessible channels only
        if (accessibleIds.length === 0) {
          return { items: [] };
        }
        // NOTE: unifiedSearch supports single lineAccountId; if admin has multiple,
        // pass undefined and let the search engine return all, then filter below.
      }

      // Verify if selected channel is accessible
      if (searchAccountId && accessibleIds && !accessibleIds.includes(searchAccountId)) {
        return { items: [] };
      }

      const results = await unifiedSearch(input.query, {
        limit: input.limit,
        lineAccountId: searchAccountId,
        scope: input.scope,
      });

      // Post-filter results by accessible channels (for multi-channel admins without a selection)
      if (accessibleIds && !searchAccountId) {
        const filteredItems = results.filter((item: any) => {
          const accountId =
            item.lineAccountId ||
            item.conversation?.lineAccountId ||
            item.conversations?.[0]?.lineAccount?.id;
          if (!accountId) return false;
          return accessibleIds.includes(accountId);
        });
        return { items: filteredItems };
      }

      return {
        items: results,
      };
    }),
});
