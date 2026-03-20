import { prisma } from '@line-oa/db';
import { normalizeText } from '../search/normalize';
import { getProfile } from './api';
import type { Prisma } from '@line-oa/db';
import { publishSyncEvent } from '../redis';
import { archiveAvatarToR2 } from '../avatar-archiver';

/**
 * Process LINE webhook events into database records.
 * Creates/updates Contact, Conversation, and Message records.
 */

/** LINE webhook event types */
interface LineEvent {
  type: string;
  timestamp: number;
  source?: {
    type: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
  message?: {
    id: string;
    type: string;
    text?: string;
    emojis?: { index: number; length: number; productId: string; emojiId: string }[];
    contentProvider?: {
      type: string;
    };
    duration?: number;
    fileName?: string;
    fileSize?: number;
    latitude?: number;
    longitude?: number;
    address?: string;
    packageId?: string;
    stickerId?: string;
  };
  webhookEventId?: string;
  follow?: { isUnblocked: boolean };
  postback?: { data: string };
}

type MsgType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'STICKER' | 'LOCATION' | 'FLEX' | 'TEMPLATE' | 'UNKNOWN';

/** Map LINE message type to our MessageType enum */
function mapMessageType(lineType: string): MsgType {
  const map: Record<string, MsgType> = {
    text: 'TEXT',
    image: 'IMAGE',
    video: 'VIDEO',
    audio: 'AUDIO',
    file: 'FILE',
    sticker: 'STICKER',
    location: 'LOCATION',
  };
  return map[lineType] ?? 'UNKNOWN';
}

/**
 * Process a batch of LINE webhook events.
 */
export async function processEvents(events: LineEvent[], lineAccountId: string, channelAccessToken: string) {
  for (const event of events) {
    try {
      // Store raw event
      if (event.webhookEventId) {
        const exists = await prisma.rawEvent.findUnique({
          where: { webhookEventId: event.webhookEventId },
        });
        if (exists) {
          console.log(`[webhook] Skipping duplicate event: ${event.webhookEventId}`);
          continue;
        }

        await prisma.rawEvent.create({
          data: {
            webhookEventId: event.webhookEventId,
            eventType: event.type,
            payload: event as unknown as Prisma.InputJsonValue,
          },
        });
      }

      // Only process user-sourced events
      const userId = event.source?.userId;
      if (!userId) {
        // We only support user interactions
        continue;
      }

      switch (event.type) {
        case 'message':
          await processMessageEvent(event, userId, lineAccountId, channelAccessToken);
          break;

        case 'follow':
          await processFollowEvent(userId, lineAccountId, channelAccessToken, event.follow?.isUnblocked ?? false);
          break;

        case 'unfollow':
          await processUnfollowEvent(userId, lineAccountId);
          break;

        default:
          console.log(`[webhook] Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`[webhook] Error processing event:`, error);
    }
  }
}

/** Process an incoming message event */
async function processMessageEvent(event: LineEvent, userId: string, lineAccountId: string, channelAccessToken: string) {
  if (!event.message) return;

  // 1. Upsert contact
  const contact = await ensureContact(userId, channelAccessToken);

  // 2. Find or create conversation
  const conversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id, lineAccountId },
  });

  const conv = conversation ?? await prisma.conversation.create({
    data: {
      lineAccountId,
      contactId: contact.id,
      status: 'ACTIVE',
      lastMessageAt: new Date(),
    },
  });

  // If conversation was BLOCKED, reset to ACTIVE on new message
  if (conversation && conversation.status === 'BLOCKED') {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { status: 'ACTIVE' },
    });
  }

  // 3. Create message
  const msgType = mapMessageType(event.message.type);
  const lineMessageId = event.message.id;

  const message = await prisma.message.create({
    data: {
      lineAccountId,
      conversationId: conv.id,
      lineMessageId,
      source: 'INBOUND',
      type: msgType,
      textContent: event.message.text ?? null,
      metadata: event.message.emojis && event.message.emojis.length > 0 ? ({ lineEmojis: event.message.emojis } as any) : undefined,
      stickerPackageId: event.message.packageId ?? null,
      stickerId: event.message.stickerId ?? null,
      latitude: event.message.latitude ?? null,
      longitude: event.message.longitude ?? null,
      address: event.message.address ?? null,
      deliveryStatus: 'DELIVERED',
      lineTimestamp: new Date(event.timestamp),
    },
  });

  // 4. Create media attachment if needed and enqueue download job
  if (['IMAGE', 'VIDEO', 'AUDIO', 'FILE'].includes(msgType)) {
    const attachment = await prisma.messageAttachment.create({
      data: {
        messageId: message.id,
        type: msgType as 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE',
        processingStatus: 'PENDING',
        originalMimeType: getMimeType(event.message.type),
        originalFilename: event.message.fileName ?? null,
        originalSize: event.message.fileSize ?? null,
        durationMs: event.message.duration ?? null,
      },
    });

    // Enqueue media download + R2 upload job
    try {
      const { mediaQueue } = await import('../jobs/queue');
      const { startMediaWorker } = await import('../jobs/media.worker');
      startMediaWorker();

      await mediaQueue.add('process-media', {
        attachmentId: attachment.id,
        lineMessageId: lineMessageId,
        channelAccessToken,
        type: msgType,
      });
    } catch (err) {
      console.error(`[webhook] Failed to enqueue media job:`, err);
    }
  }

  // 5. Update conversation with last message info
  const previewText = event.message.text?.substring(0, 100) ?? `[${msgType}]`;
  await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      lastMessageId: message.id,
      lastMessageText: previewText,
      lastMessageAt: message.createdAt,
      lastMessageType: msgType,
      lastMessageSource: 'INBOUND',
      unreadCount: { increment: 1 },
    },
  });

  // 6. Broadcast SSE event to frontend
  await publishSyncEvent('NEW_MESSAGE', {
    conversationId: conv.id,
    messageId: message.id,
    contactId: contact.id
  });

  // 7. Notify admins of new message with Web Push
  await notifyAdminsNewMessage(lineAccountId, conv.id, contact.displayName || 'Unknown', previewText);
}

/** Follow event — ensure contact exists, unblock conversation, and notify admins */
async function processFollowEvent(userId: string, lineAccountId: string, channelAccessToken: string, isUnblocked: boolean) {
  const contact = await ensureContact(userId, channelAccessToken);

  // Find conversation
  let conversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id, lineAccountId },
  });

  if (conversation) {
    if (conversation.status === 'BLOCKED') {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: 'ACTIVE' },
      });
    }
  } else {
    // Create new conversation explicitly because they followed
    conversation = await prisma.conversation.create({
      data: {
        lineAccountId,
        contactId: contact.id,
        status: 'ACTIVE',
        lastMessageAt: new Date(),
      },
    });
  }

  // Record follow log
  await prisma.contactFollowLog.create({
    data: { contactId: contact.id, action: 'FOLLOW' },
  });

  // Broadcast SSE for real-time UI update (contact list + conversation list)
  await publishSyncEvent('CONTACT_STATUS_CHANGE', {
    contactId: contact.id,
    conversationId: conversation.id,
    action: 'follow',
    isUnblocked,
  });

  // Notify admins via notification bell + Web Push
  const contactName = contact.displayName || `User ${userId.slice(-4)}`;
  const message = isUnblocked
    ? `${contactName} ติดตาม`
    : `${contactName} ติดตาม`;

  await notifyAdminsContactStatusChange(
    lineAccountId,
    conversation.id,
    contact,
    'FOLLOW',
    message,
    isUnblocked,
  );
}

/** Unfollow event — block conversation and notify admins */
async function processUnfollowEvent(userId: string, lineAccountId: string) {
  console.log(`[webhook] User unfollowed/blocked: ${userId}`);

  const contact = await prisma.contact.findUnique({
    where: { lineUserId: userId },
  });

  if (!contact) return;

  // Mark contact as unfollowed
  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      isFollowing: false,
      unfollowedAt: new Date(),
    },
  });

  // Record unfollow log
  await prisma.contactFollowLog.create({
    data: { contactId: contact.id, action: 'UNFOLLOW' },
  });

  const conversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id, lineAccountId },
  });

  if (conversation) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: 'BLOCKED' },
    });
  }

  // Broadcast SSE for real-time UI update
  await publishSyncEvent('CONTACT_STATUS_CHANGE', {
    contactId: contact.id,
    conversationId: conversation?.id,
    action: 'unfollow',
  });

  // Notify admins via notification bell + Web Push
  const contactName = contact.displayName || `User ${userId.slice(-4)}`;
  await notifyAdminsContactStatusChange(
    lineAccountId,
    conversation?.id || null,
    contact,
    'UNFOLLOW',
    `${contactName} เลิกติดตาม`,
    false,
  );
}

/** Ensure a contact record exists, creating from LINE Profile API if needed */
async function ensureContact(userId: string, channelAccessToken: string) {
  let contact = await prisma.contact.findUnique({
    where: { lineUserId: userId },
  });

  if (!contact) {
    try {
      const profile = await getProfile(userId, channelAccessToken);

      let avatarR2Key = null;
      if (profile.pictureUrl) {
        // Archive avatar asynchronously (don't block creation, but in this case we'll await it to save it immediately)
        avatarR2Key = await archiveAvatarToR2(userId, profile.pictureUrl);
      }

      contact = await prisma.contact.create({
        data: {
          lineUserId: userId,
          displayName: profile.displayName,
          displayNameNormalized: normalizeText(profile.displayName),
          pictureUrl: profile.pictureUrl ?? null,
          avatarR2Key,
          statusMessage: profile.statusMessage ?? null,
          isFollowing: true,
          lastSeenAt: new Date(),
        },
      });
    } catch {
      contact = await prisma.contact.create({
        data: {
          lineUserId: userId,
          displayName: `User ${userId.slice(-4)}`,
          displayNameNormalized: normalizeText(`User ${userId.slice(-4)}`),
          isFollowing: true,
          lastSeenAt: new Date(),
        },
      });
    }
  } else {
    // Also try to update their latest profile info if possible, assuming they might have changed it
    // But to save API calls, we just update lastSeenAt and isFollowing for now
    let dataToUpdate: any = {
      lastSeenAt: new Date(),
      isFollowing: true,
      // NOTE: Do NOT reset unfollowedAt to null — we preserve it so admin
      // can see the contact previously unfollowed (refollow indicator).
    };

    // Note: We could fetch new profile here and update avatarR2Key, but to avoid Rate Limits
    // we only do this on fresh follows or periodically outside of message webhooks.
    // For now we just update lastSeenAt.

    await prisma.contact.update({
      where: { id: contact.id },
      data: dataToUpdate,
    });
  }

  return contact;
}

/** Map LINE type to MIME type */
function getMimeType(type: string): string {
  const map: Record<string, string> = {
    image: 'image/jpeg',
    video: 'video/mp4',
    audio: 'audio/m4a',
    file: 'application/octet-stream',
  };
  return map[type] ?? 'application/octet-stream';
}

/** Time window for coalescing notifications from the same conversation (ms) */
const NOTIFICATION_COALESCE_WINDOW_MS = 15_000;

/** Helper to notify admins having access to the line account when a new message arrives.
 *  Includes flood protection: if an unclaimed+unread notification for the same conversation
 *  exists within the coalesce window, we update it instead of creating a new one.
 */
async function notifyAdminsNewMessage(lineAccountId: string, conversationId: string, contactName: string, textPreview: string) {
  // Fetch LINE account info (name + avatar)
  const lineAccount = await prisma.lineAccount.findUnique({
    where: { id: lineAccountId },
    select: { displayName: true, pictureUrl: true },
  });
  const accountName = lineAccount?.displayName || 'LINE OA';

  // Fetch contact avatar
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { contact: { select: { pictureUrl: true } } },
  });

  const admins = await prisma.adminUser.findMany({
    where: {
      isActive: true,
      OR: [
        { role: 'SUPER_ADMIN' },
        { channelAccess: { some: { lineAccountId } } }
      ]
    }
  });

  const { sendWebPushNotification } = await import('../webpush');

  const notifTitle = accountName;
  const debounceWindow = new Date(Date.now() - NOTIFICATION_COALESCE_WINDOW_MS);

  for (const admin of admins) {
    // Flood protection: find recent unclaimed notification for same conversation
    const existing = await prisma.notification.findFirst({
      where: {
        adminUserId: admin.id,
        referenceId: conversationId,
        claimedByAdminId: null,
        isRead: false,
        createdAt: { gte: debounceWindow },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      // Coalesce: update existing notification with latest message
      const prevMeta = (existing.metadata as Record<string, unknown>) ?? {};
      const msgCount = ((prevMeta.messageCount as number) ?? 1) + 1;
      const coalesceMessage = msgCount > 1
        ? `${contactName} ส่ง ${msgCount} ข้อความ`
        : `${contactName}: ${textPreview}`;

      await prisma.notification.update({
        where: { id: existing.id },
        data: {
          message: coalesceMessage,
          createdAt: new Date(), // Bump to top
          metadata: {
            channelPictureUrl: lineAccount?.pictureUrl ?? null,
            contactPictureUrl: conversation?.contact?.pictureUrl ?? null,
            messageCount: msgCount,
          },
        },
      });
    } else {
      // Create new notification
      await prisma.notification.create({
        data: {
          adminUserId: admin.id,
          type: 'NEW_MESSAGE',
          title: notifTitle,
          message: `${contactName}: ${textPreview}`,
          referenceId: conversationId,
          metadata: {
            channelPictureUrl: lineAccount?.pictureUrl ?? null,
            contactPictureUrl: conversation?.contact?.pictureUrl ?? null,
            messageCount: 1,
          },
        },
      });
    }

    // Publish SSE for live UI update
    await publishSyncEvent('NEW_NOTIFICATION', { targetAdminUserId: admin.id });

    // Send Web Push only for first message (not coalesced updates) to avoid push spam
    if (!existing) {
      await sendWebPushNotification(admin.id, {
        title: `${accountName} — ${contactName}`,
        body: textPreview,
        data: { url: `/inbox/${conversationId}` }
      }).catch(err => console.error('[webhook] Failed to send web push:', err));
    }
  }
}

/** Notify all admins when a contact's follow status changes (follow / unfollow / block) */
async function notifyAdminsContactStatusChange(
  lineAccountId: string,
  conversationId: string | null,
  contact: { id: string; displayName: string | null; pictureUrl: string | null },
  notifType: 'FOLLOW' | 'UNFOLLOW',
  message: string,
  isUnblocked: boolean,
) {
  const lineAccount = await prisma.lineAccount.findUnique({
    where: { id: lineAccountId },
    select: { displayName: true, pictureUrl: true },
  });
  const accountName = lineAccount?.displayName || 'LINE OA';

  const admins = await prisma.adminUser.findMany({
    where: {
      isActive: true,
      OR: [
        { role: 'SUPER_ADMIN' },
        { channelAccess: { some: { lineAccountId } } },
      ],
    },
  });

  const { sendWebPushNotification } = await import('../webpush');

  const notifTitle = notifType === 'FOLLOW'
    ? `✅ ${accountName} — ผู้ติดตามใหม่`
    : `❌ ${accountName} — เลิกติดตาม`;

  for (const admin of admins) {
    await prisma.notification.create({
      data: {
        adminUserId: admin.id,
        type: notifType,
        title: notifTitle,
        message,
        referenceId: conversationId,
        metadata: {
          channelPictureUrl: lineAccount?.pictureUrl ?? null,
          contactPictureUrl: contact.pictureUrl ?? null,
          contactId: contact.id,
          action: notifType === 'FOLLOW' ? 'follow' : 'unfollow',
          isUnblocked,
        },
      },
    });

    // Publish SSE for live notification bell update
    await publishSyncEvent('NEW_NOTIFICATION', { targetAdminUserId: admin.id });

    // Send Web Push
    const pushIcon = notifType === 'FOLLOW' ? '✅' : '❌';
    await sendWebPushNotification(admin.id, {
      title: `${pushIcon} ${accountName}`,
      body: message,
      data: conversationId ? { url: `/inbox/${conversationId}` } : {},
    }).catch(err => console.error('[webhook] Failed to send web push for contact status change:', err));
  }
}

