import { z } from 'zod';
import { prisma } from '@line-oa/db';
import { router, protectedProcedure } from '../trpc';
import { getPublicR2Url } from '../../r2-client';
import { getAccessibleChannelIds } from '../lib/channel-access';

/**
 * Conversations router — list, get, pin, archive, mark read.
 */
export const conversationsRouter = router({
  /** List conversations with cursor-based pagination */
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        filter: z.enum(['all', 'unread', 'archived']).default('all'),
        lineAccountId: z.string().optional(),
        tagId: z.string().optional(),
        labelId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit, filter, lineAccountId, tagId, labelId } = input;

      const where: Record<string, unknown> = {};

      // Channel access control
      const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);

      if (lineAccountId) {
        // User selected a specific channel — verify access
        if (accessibleIds && !accessibleIds.includes(lineAccountId)) {
          return { items: [], nextCursor: undefined };
        }
        where.lineAccountId = lineAccountId;
      } else if (accessibleIds) {
        // Filter to accessible channels only
        where.lineAccountId = { in: accessibleIds };
      }

      if (filter === 'unread') {
        where.unreadCount = { gt: 0 };
        where.isArchived = false;
      } else if (filter === 'archived') {
        where.isArchived = true;
      } else {
        where.isArchived = false;
      }

      // Tag filter — find conversations whose contact has the specified tag
      if (tagId) {
        where.contact = {
          ...(where.contact as Record<string, unknown> ?? {}),
          tags: { some: { tagId } },
        };
      }

      // Label filter — find conversations that have the specified label
      if (labelId) {
        where.labels = { some: { labelId } };
      }

      const conversations = await prisma.conversation.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' },
          { lastMessageAt: 'desc' },
        ],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          lineAccount: {
            select: { id: true, displayName: true, pictureUrl: true, basicId: true },
          },
          contact: {
            select: {
              id: true,
              lineUserId: true,
              displayName: true,
              pictureUrl: true,
              avatarR2Key: true,
              isFollowing: true,
              unfollowedAt: true,
              tags: {
                select: {
                  tag: { select: { id: true, name: true, color: true, lineAccountId: true } },
                },
              },
            },
          },
          labels: {
            select: {
              label: { select: { id: true, name: true, color: true, lineAccountId: true } },
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (conversations.length > limit) {
        const next = conversations.pop();
        nextCursor = next?.id;
      }

      const items = conversations.map(c => ({
        ...c,
        contact: {
          ...c.contact,
          avatarUrl: c.contact.avatarR2Key 
            ? getPublicR2Url(c.contact.avatarR2Key) || c.contact.pictureUrl 
            : c.contact.pictureUrl,
        },
        tags: c.contact.tags.map(ct => ct.tag),
        labels: c.labels.map(cl => cl.label),
      }));

      return {
        items,
        nextCursor,
      };
    }),

  /** Get single conversation */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const conversation = await prisma.conversation.findUnique({
        where: { id: input.id },
        include: {
          lineAccount: {
            select: { id: true, displayName: true, pictureUrl: true, basicId: true },
          },
          contact: true,
          labels: {
            select: {
              label: { select: { id: true, name: true, color: true, lineAccountId: true } },
            },
          },
        },
      });

      if (!conversation) return null;

      // Verify channel access
      const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);
      if (accessibleIds && !accessibleIds.includes(conversation.lineAccountId)) {
        return null;
      }

      return {
        ...conversation,
        contact: {
          ...conversation.contact,
          avatarUrl: conversation.contact.avatarR2Key
            ? getPublicR2Url(conversation.contact.avatarR2Key) || conversation.contact.pictureUrl
            : conversation.contact.pictureUrl,
        },
        labels: conversation.labels.map(cl => cl.label),
      };
    }),

  /** Mark conversation as read */
  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.conversation.update({
        where: { id: input.id },
        data: { unreadCount: 0 },
      });

      // Send read receipt to LINE user
      try {
        // Find the latest inbound message with a markAsReadToken
        const latestMsg = await prisma.message.findFirst({
          where: {
            conversationId: input.id,
            source: 'INBOUND',
            markAsReadToken: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          select: { markAsReadToken: true, lineAccountId: true },
        });

        if (latestMsg?.markAsReadToken) {
          // Get channel access token
          const account = await prisma.lineAccount.findUnique({
            where: { id: latestMsg.lineAccountId },
            select: { channelAccessToken: true },
          });

          if (account) {
            const { markAsRead } = await import('../../line/api');
            await markAsRead(latestMsg.markAsReadToken, account.channelAccessToken);
            console.log(`[markRead] ✅ Sent LINE read receipt for conversation ${input.id}`);
          } else {
            console.log(`[markRead] ⚠️ No LINE account found for lineAccountId: ${latestMsg.lineAccountId}`);
          }
        } else {
          console.log(`[markRead] ℹ️ No markAsReadToken found for conversation ${input.id} (messages sent before feature was enabled)`);
        }
      } catch (err) {
        // Don't block the local markRead if LINE API fails
        console.error(`[markRead] ❌ Failed to send LINE read receipt:`, err);
      }

      // Broadcast to all admin tabs so unread badge clears everywhere
      const { publishSyncEvent } = await import('../../redis');
      await publishSyncEvent('CONVERSATION_UPDATED', {
        conversationId: input.id,
        action: 'markRead',
      });

      return { success: true };
    }),

  /** Pin/unpin conversation (max 10 pinned) */
  togglePin: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const conv = await prisma.conversation.findUnique({
        where: { id: input.id },
        select: { isPinned: true, lineAccountId: true },
      });
      if (!conv) return { success: false };

      // If trying to pin, check limit
      if (!conv.isPinned) {
        const pinnedCount = await prisma.conversation.count({
          where: { isPinned: true, lineAccountId: conv.lineAccountId },
        });
        if (pinnedCount >= 10) {
          return { success: false, error: 'PIN_LIMIT' as const };
        }
      }

      await prisma.conversation.update({
        where: { id: input.id },
        data: { isPinned: !conv.isPinned },
      });

      const { publishSyncEvent } = await import('../../redis');
      await publishSyncEvent('CONVERSATION_UPDATED', {
        conversationId: input.id,
        action: 'pinToggled',
      });

      return { success: true, isPinned: !conv.isPinned };
    }),

  /** Archive/unarchive conversation */
  toggleArchive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const conv = await prisma.conversation.findUnique({
        where: { id: input.id },
        select: { isArchived: true },
      });
      if (!conv) return { success: false };

      await prisma.conversation.update({
        where: { id: input.id },
        data: { isArchived: !conv.isArchived },
      });

      const { publishSyncEvent } = await import('../../redis');
      await publishSyncEvent('CONVERSATION_UPDATED', {
        conversationId: input.id,
        action: 'archiveToggled',
      });

      return { success: true, isArchived: !conv.isArchived };
    }),

  // ============================================
  // Label / Tag management with limits
  // ============================================

  /** Add a label to a conversation (max 3) */
  addLabel: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      labelId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const MAX_LABELS = 3;
      const count = await prisma.conversationLabel.count({
        where: { conversationId: input.conversationId },
      });
      if (count >= MAX_LABELS) {
        throw new Error(`ป้ายกำกับเต็มแล้ว (สูงสุด ${MAX_LABELS} ป้าย)`);
      }
      await prisma.conversationLabel.create({
        data: {
          conversationId: input.conversationId,
          labelId: input.labelId,
        },
      });

      const { publishSyncEvent } = await import('../../redis');
      await publishSyncEvent('CONVERSATION_UPDATED', {
        conversationId: input.conversationId,
        labelId: input.labelId,
        action: 'addLabel',
      });

      return { success: true };
    }),

  /** Remove a label from a conversation */
  removeLabel: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      labelId: z.string(),
    }))
    .mutation(async ({ input }) => {
      await prisma.conversationLabel.deleteMany({
        where: {
          conversationId: input.conversationId,
          labelId: input.labelId,
        },
      });

      const { publishSyncEvent } = await import('../../redis');
      await publishSyncEvent('CONVERSATION_UPDATED', {
        conversationId: input.conversationId,
        labelId: input.labelId,
        action: 'removeLabel',
      });

      return { success: true };
    }),

  /** Add a tag to a contact (max 5) */
  addTag: protectedProcedure
    .input(z.object({
      contactId: z.string(),
      tagId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const MAX_TAGS = 5;
      const count = await prisma.contactTag.count({
        where: { contactId: input.contactId },
      });
      if (count >= MAX_TAGS) {
        throw new Error(`แท็กเต็มแล้ว (สูงสุด ${MAX_TAGS} แท็ก)`);
      }
      await prisma.contactTag.create({
        data: {
          contactId: input.contactId,
          tagId: input.tagId,
        },
      });

      const { publishSyncEvent } = await import('../../redis');
      await publishSyncEvent('TAG_UPDATED', {
        action: 'assigned',
        contactId: input.contactId,
        tagId: input.tagId,
      });

      return { success: true };
    }),

  /** Remove a tag from a contact */
  removeTag: protectedProcedure
    .input(z.object({
      contactId: z.string(),
      tagId: z.string(),
    }))
    .mutation(async ({ input }) => {
      await prisma.contactTag.deleteMany({
        where: {
          contactId: input.contactId,
          tagId: input.tagId,
        },
      });

      const { publishSyncEvent } = await import('../../redis');
      await publishSyncEvent('TAG_UPDATED', {
        action: 'removed',
        contactId: input.contactId,
        tagId: input.tagId,
      });

      return { success: true };
    }),

  // ============================================
  // Delete conversation
  // ============================================

  /** Delete a conversation and all its messages */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Messages cascade-delete via Prisma schema (onDelete: Cascade)
      await prisma.conversation.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),

  // ============================================
  // Export chat history
  // ============================================

  /** Export all messages for a conversation as full objects for HTML rendering */
  exportHistory: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ input }) => {
      const conversation = await prisma.conversation.findUnique({
        where: { id: input.conversationId },
        include: {
          lineAccount: {
            select: { displayName: true, pictureUrl: true },
          },
          contact: { 
            select: { displayName: true, pictureUrl: true, avatarR2Key: true } 
          },
        },
      });
      if (!conversation) throw new Error('Conversation not found');

      const avatarUrl = conversation.contact.avatarR2Key
        ? getPublicR2Url(conversation.contact.avatarR2Key) || conversation.contact.pictureUrl
        : conversation.contact.pictureUrl;

      const messages = await prisma.message.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: 'asc' },
        include: {
          attachments: true,
        },
      });

      return {
        contactName: conversation.contact.displayName,
        contactAvatar: avatarUrl,
        oaName: conversation.lineAccount.displayName,
        oaAvatar: conversation.lineAccount.pictureUrl,
        messages: messages.map(m => ({
          id: m.id,
          source: m.source,
          type: m.type,
          textContent: m.textContent,
          metadata: m.metadata,
          stickerId: m.stickerId,
          stickerPackageId: m.stickerPackageId,
          latitude: m.latitude,
          longitude: m.longitude,
          address: m.address,
          createdAt: m.createdAt.toISOString(),
          sentByName: m.sentByName,
          sender: m.source === 'OUTBOUND' ? m.sentByName || 'LINE OA' : conversation.contact.displayName,
          attachments: m.attachments.map(att => ({
            id: att.id,
            type: att.type,
            processingStatus: att.processingStatus,
            originalUrl: att.r2KeyOriginal ? getPublicR2Url(att.r2KeyOriginal) : null,
            previewUrl: att.r2KeyPreview ? getPublicR2Url(att.r2KeyPreview) : null,
          })),
        })),
      };
    }),
});
