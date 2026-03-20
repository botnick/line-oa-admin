import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '@line-oa/db';
import { router, protectedProcedure } from '../trpc';
import { getAccessibleChannelIds } from '../lib/channel-access';
import { getPublicR2Url, getPresignedR2Url } from '../../r2-client';

/** Resolve an R2 key to a URL (public domain preferred, presigned fallback). */
async function resolveR2Url(key: string | null): Promise<string | null> {
  if (!key) return null;
  const publicUrl = getPublicR2Url(key);
  if (publicUrl) return publicUrl;
  // Fallback: generate a 1-hour presigned URL
  try {
    return await getPresignedR2Url(key, 3600);
  } catch {
    return null;
  }
}

/**
 * Messages router — list messages and send outbound messages.
 */
export const messagesRouter = router({
  /** List messages for a conversation (cursor-based, newest first) */
  list: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const { conversationId, cursor, limit } = input;

      // Verify channel access for this conversation
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { lineAccountId: true },
      });
      if (conv) {
        const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);
        if (accessibleIds && !accessibleIds.includes(conv.lineAccountId)) {
          return { items: [], nextCursor: undefined };
        }
      }

      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          attachments: {
            select: {
              id: true,
              type: true,
              processingStatus: true,
              originalMimeType: true,
              r2KeyThumbnail: true,
              r2KeyPreview: true,
              r2KeyOriginal: true,
              originalWidth: true,
              originalHeight: true,
              durationMs: true,
              originalFilename: true,
              originalSize: true,
            },
          },
          sentByAdmin: {
            select: { pictureUrl: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (messages.length > limit) {
        const next = messages.pop();
        nextCursor = next?.id;
      }

      // Resolve R2 keys → URLs (public or presigned)
      const resolved = await Promise.all(
        messages.map(async (msg) => ({
          ...msg,
          attachments: await Promise.all(
            msg.attachments.map(async (att) => ({
              ...att,
              thumbnailUrl: await resolveR2Url(att.r2KeyThumbnail),
              previewUrl: await resolveR2Url(att.r2KeyPreview),
              originalUrl: await resolveR2Url(att.r2KeyOriginal),
            }))
          ),
        }))
      );

      // Reverse so messages appear oldest→newest in UI
      return {
        items: resolved.reverse(),
        nextCursor,
      };
    }),

  /** Send a text message (outbound), optionally with inline LINE emojis */
  send: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        text: z.string().min(1).max(2000),
        emojis: z
          .array(
            z.object({
              index: z.number(),
              productId: z.string(),
              emojiId: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { conversationId, text, emojis } = input;

      // Get conversation with contact info
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { contact: true },
      });

      if (!conversation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบการสนทนา' });
      }

      // Guard: reject if contact has unfollowed
      if (conversation.contact.isFollowing === false) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'ไม่สามารถส่งข้อความได้ เนื่องจากผู้ใช้เลิกติดตามบัญชีของคุณ',
        });
      }

      // Verify channel access
      const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);
      if (accessibleIds && !accessibleIds.includes(conversation.lineAccountId)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์เข้าถึงช่องทางนี้' });
      }

      // Get admin sender info
      const admin = await prisma.adminUser.findUnique({
        where: { id: ctx.session.adminUserId },
        select: { id: true, displayName: true },
      });

      // Create message record
      const message = await prisma.message.create({
        data: {
          conversationId,
          source: 'OUTBOUND',
          type: 'TEXT',
          textContent: text,
          metadata: emojis && emojis.length > 0 ? { lineEmojis: emojis } : undefined,
          deliveryStatus: 'PENDING',
          lineAccountId: conversation.lineAccountId,
          sentByAdminId: admin?.id ?? null,
          sentByName: admin?.displayName ?? 'Admin',
        },
      });

      // Update conversation last message
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageId: message.id,
          lastMessageText: text.substring(0, 100),
          lastMessageAt: message.createdAt,
          lastMessageType: 'TEXT',
          lastMessageSource: 'OUTBOUND',
        },
      });

      // Build LINE API payload
      const payload: any = {
        type: 'text',
        text,
      };

      // Include emojis array if present (LINE emoji syntax)
      if (emojis && emojis.length > 0) {
        payload.emojis = emojis.map((e) => ({
          index: e.index,
          productId: e.productId,
          emojiId: e.emojiId,
        }));
      }

      // Create outbound request for worker to send via LINE API
      const request = await prisma.outboundRequest.create({
        data: {
          messageId: message.id,
          lineUserId: conversation.contact.lineUserId,
          requestType: 'PUSH',
          payload,
          lineAccountId: conversation.lineAccountId,
        },
      });

      // Start worker if not started (lazy init for Next.js dev environment)
      const { startReplyWorker } = await import('../../jobs/reply.worker');
      const { replyQueue } = await import('../../jobs/queue');
      const { publishSyncEvent } = await import('../../redis');
      
      startReplyWorker();

      // Enqueue job specifying the request ID
      await replyQueue.add('send-reply', { outboundRequestId: request.id }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      });

      // Notify UI
      await publishSyncEvent('NEW_MESSAGE', { 
        conversationId: conversation.id,
        messageId: message.id,
        contactId: conversation.contactId
      });

      // Claim: mark unclaimed notifications for this conversation as claimed by this admin
      const claimResult = await prisma.notification.updateMany({
        where: {
          referenceId: conversationId,
          claimedByAdminId: null,
        },
        data: {
          claimedByAdminId: ctx.session.adminUserId,
          claimedByName: admin?.displayName ?? 'Admin',
          claimedAt: new Date(),
        },
      });

      // Broadcast claim update so other admins see it in realtime
      if (claimResult.count > 0) {
        await publishSyncEvent('NOTIFICATION_UPDATED', {
          conversationId,
          action: 'claimed',
        });
      }

      return message;
    }),

  /** Send a sticker message (outbound) */
  sendSticker: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        packageId: z.number(),
        stickerId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { conversationId, packageId, stickerId } = input;

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { contact: true },
      });

      if (!conversation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบการสนทนา' });
      }

      // Guard: reject if contact has unfollowed
      if (conversation.contact.isFollowing === false) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'ไม่สามารถส่งข้อความได้ เนื่องจากผู้ใช้เลิกติดตามบัญชีของคุณ',
        });
      }

      // Verify channel access
      const accessibleIds2 = await getAccessibleChannelIds(ctx.session.adminUserId);
      if (accessibleIds2 && !accessibleIds2.includes(conversation.lineAccountId)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์เข้าถึงช่องทางนี้' });
      }

      // Get admin sender info
      const admin = await prisma.adminUser.findUnique({
        where: { id: ctx.session.adminUserId },
        select: { id: true, displayName: true },
      });

      // Create sticker message record
      const message = await prisma.message.create({
        data: {
          conversationId,
          source: 'OUTBOUND',
          type: 'STICKER',
          stickerPackageId: String(packageId),
          stickerId: String(stickerId),
          deliveryStatus: 'PENDING',
          lineAccountId: conversation.lineAccountId,
          sentByAdminId: admin?.id ?? null,
          sentByName: admin?.displayName ?? 'Admin',
        },
      });

      // Update conversation last message
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageId: message.id,
          lastMessageText: '[สติ๊กเกอร์]',
          lastMessageAt: message.createdAt,
          lastMessageType: 'STICKER',
          lastMessageSource: 'OUTBOUND',
        },
      });

      // Create outbound request with sticker payload
      const request = await prisma.outboundRequest.create({
        data: {
          messageId: message.id,
          lineUserId: conversation.contact.lineUserId,
          requestType: 'PUSH',
          payload: {
            type: 'sticker',
            packageId: String(packageId),
            stickerId: String(stickerId),
          },
          lineAccountId: conversation.lineAccountId,
        },
      });

      const { startReplyWorker } = await import('../../jobs/reply.worker');
      const { replyQueue } = await import('../../jobs/queue');
      const { publishSyncEvent } = await import('../../redis');

      startReplyWorker();
      await replyQueue.add('send-reply', { outboundRequestId: request.id }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      });

      await publishSyncEvent('NEW_MESSAGE', {
        conversationId: conversation.id,
        messageId: message.id,
        contactId: conversation.contactId,
      });

      // Claim: mark unclaimed notifications for this conversation as claimed by this admin
      const stickerAdmin = await prisma.adminUser.findUnique({
        where: { id: ctx.session.adminUserId },
        select: { displayName: true },
      });
      const stickerClaimResult = await prisma.notification.updateMany({
        where: {
          referenceId: conversationId,
          claimedByAdminId: null,
        },
        data: {
          claimedByAdminId: ctx.session.adminUserId,
          claimedByName: stickerAdmin?.displayName ?? 'Admin',
          claimedAt: new Date(),
        },
      });

      if (stickerClaimResult.count > 0) {
        await publishSyncEvent('NOTIFICATION_UPDATED', {
          conversationId,
          action: 'claimed',
        });
      }

      return message;
    }),

  /** Send a media message (image/video/file) via R2 URL */
  sendMedia: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        r2Key: z.string(),
        url: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
        size: z.number().optional(),
        type: z.enum(['IMAGE', 'VIDEO', 'FILE']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { conversationId, r2Key, url, mimeType, fileName, type } = input;

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { contact: true },
      });

      if (!conversation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบการสนทนา' });
      }

      // Guard: reject if contact has unfollowed
      if (conversation.contact.isFollowing === false) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'ไม่สามารถส่งข้อความได้ เนื่องจากผู้ใช้เลิกติดตามบัญชีของคุณ',
        });
      }

      // Verify channel access
      const accessibleIds3 = await getAccessibleChannelIds(ctx.session.adminUserId);
      if (accessibleIds3 && !accessibleIds3.includes(conversation.lineAccountId)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์เข้าถึงช่องทางนี้' });
      }

      // Get admin sender info
      const admin = await prisma.adminUser.findUnique({
        where: { id: ctx.session.adminUserId },
        select: { id: true, displayName: true },
      });

      // Create message with attachment
      const message = await prisma.message.create({
        data: {
          conversationId,
          source: 'OUTBOUND',
          type,
          deliveryStatus: 'PENDING',
          lineAccountId: conversation.lineAccountId,
          sentByAdminId: admin?.id ?? null,
          sentByName: admin?.displayName ?? 'Admin',
          attachments: {
            create: {
              type: type === 'IMAGE' ? 'IMAGE' : type === 'VIDEO' ? 'VIDEO' : 'FILE',
              processingStatus: 'COMPLETED',
              originalMimeType: mimeType,
              r2KeyOriginal: r2Key,
              originalFilename: fileName,
              originalSize: input.size,
            },
          },
        },
      });

      // Label for conversation list
      const labelMap: Record<string, string> = {
        IMAGE: '[รูปภาพ]',
        VIDEO: '[วิดีโอ]',
        FILE: `[ไฟล์] ${fileName}`,
      };

      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageId: message.id,
          lastMessageText: labelMap[type] ?? '[ไฟล์]',
          lastMessageAt: message.createdAt,
          lastMessageType: type,
          lastMessageSource: 'OUTBOUND',
        },
      });

      // Build LINE payload based on type
      let linePayload: any;
      if (type === 'IMAGE') {
        linePayload = { type: 'image', originalContentUrl: url, previewImageUrl: url };
      } else if (type === 'VIDEO') {
        linePayload = { type: 'video', originalContentUrl: url, previewImageUrl: url };
      } else {
        const kb = input.size ? Math.round(input.size / 1024) : 0;
        const sizeDisplay = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : kb > 0 ? `${kb} KB` : 'ไม่ทราบขนาด';
        
        linePayload = {
          type: 'flex',
          altText: `ไฟล์: ${fileName}`,
          contents: {
            type: "bubble",
            size: "kilo",
            body: {
              type: "box",
              layout: "vertical",
              paddingAll: "16px",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  alignItems: "center",
                  contents: [
                    {
                      type: "box",
                      layout: "vertical",
                      flex: 0,
                      width: "48px",
                      height: "48px",
                      backgroundColor: "#f0f4f8",
                      cornerRadius: "8px",
                      justifyContent: "center",
                      alignItems: "center",
                      contents: [
                        {
                          type: "text",
                          text: "📄",
                          size: "xl"
                        }
                      ],
                      borderColor: "#d1dae6",
                      borderWidth: "1px"
                    },
                    {
                      type: "box",
                      layout: "vertical",
                      margin: "md",
                      contents: [
                        {
                          type: "text",
                          text: fileName,
                          weight: "bold",
                          size: "sm",
                          color: "#1e293b",
                          wrap: true,
                          maxLines: 2
                        },
                        {
                          type: "text",
                          text: `ขนาด: ${sizeDisplay}`,
                          size: "xs",
                          color: "#94a3b8",
                          margin: "sm"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            footer: {
              type: "box",
              layout: "vertical",
              paddingAll: "0px",
              contents: [
                {
                  type: "separator",
                  color: "#f1f5f9"
                },
                {
                  type: "box",
                  layout: "vertical",
                  paddingAll: "12px",
                  contents: [
                    {
                      type: "button",
                      style: "link",
                      height: "sm",
                      color: "#0891b2",
                      action: {
                        type: "uri",
                        label: "ดาวน์โหลดไฟล์",
                        uri: url
                      }
                    }
                  ]
                }
              ]
            }
          }
        };
      }

      const request = await prisma.outboundRequest.create({
        data: {
          messageId: message.id,
          lineUserId: conversation.contact.lineUserId,
          requestType: 'PUSH',
          payload: linePayload,
          lineAccountId: conversation.lineAccountId,
        },
      });

      const { startReplyWorker } = await import('../../jobs/reply.worker');
      const { replyQueue } = await import('../../jobs/queue');
      const { publishSyncEvent } = await import('../../redis');

      startReplyWorker();
      await replyQueue.add('send-reply', { outboundRequestId: request.id }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      });

      await publishSyncEvent('NEW_MESSAGE', {
        conversationId: conversation.id,
        messageId: message.id,
        contactId: conversation.contactId,
      });

      // Claim: mark unclaimed notifications for this conversation as claimed by this admin
      const mediaAdmin = await prisma.adminUser.findUnique({
        where: { id: ctx.session.adminUserId },
        select: { displayName: true },
      });
      const mediaClaimResult = await prisma.notification.updateMany({
        where: {
          referenceId: conversationId,
          claimedByAdminId: null,
        },
        data: {
          claimedByAdminId: ctx.session.adminUserId,
          claimedByName: mediaAdmin?.displayName ?? 'Admin',
          claimedAt: new Date(),
        },
      });

      if (mediaClaimResult.count > 0) {
        await publishSyncEvent('NOTIFICATION_UPDATED', {
          conversationId,
          action: 'claimed',
        });
      }

      return message;
    }),
});
