import { z } from 'zod';
import { prisma } from '@line-oa/db';
import { router, protectedProcedure } from '../trpc';
import { getAccessibleChannelIds, buildChannelWhere } from '../lib/channel-access';

/**
 * Overview router — aggregated stats, time-series analytics, and admin performance.
 */
export const overviewRouter = router({
  /** Get dashboard stats with channel access enforcement */
  stats: protectedProcedure
    .input(
      z.object({
        lineAccountId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);
      const channelFilter = buildChannelWhere(accessibleIds, input?.lineAccountId);

      if (channelFilter && '__denied' in channelFilter) {
        return {
          totalConversations: 0, activeConversations: 0, unreadConversations: 0,
          archivedConversations: 0, totalContacts: 0, newContactsToday: 0,
          messagesToday: 0, messagesThisWeek: 0, lineAccounts: 0,
          inboundToday: 0, outboundToday: 0, avgResponseTimeMinutes: null,
        };
      }

      const where = channelFilter || {};

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(todayStart.getTime() - 7 * 86_400_000);

      // Build contact filter — contacts are linked via conversations
      const contactWhere = channelFilter
        ? { conversations: { some: channelFilter } }
        : {};

      const [
        totalConversations,
        activeConversations,
        unreadConversations,
        archivedConversations,
        totalContacts,
        newContactsToday,
        messagesToday,
        messagesThisWeek,
        lineAccounts,
        inboundToday,
        outboundToday,
      ] = await Promise.all([
        prisma.conversation.count({ where }),
        prisma.conversation.count({ where: { ...where, status: 'ACTIVE', isArchived: false } }),
        prisma.conversation.count({ where: { ...where, unreadCount: { gt: 0 } } }),
        prisma.conversation.count({ where: { ...where, isArchived: true } }),
        prisma.contact.count({ where: contactWhere }),
        prisma.contact.count({ where: { ...contactWhere, firstSeenAt: { gte: todayStart } } }),
        prisma.message.count({ where: { ...where, createdAt: { gte: todayStart } } }),
        prisma.message.count({ where: { ...where, createdAt: { gte: weekAgo } } }),
        prisma.lineAccount.count({ 
          where: { 
            isActive: true, 
            ...(accessibleIds ? { id: { in: accessibleIds } } : {})
          } 
        }),
        prisma.message.count({ where: { ...where, source: 'INBOUND', createdAt: { gte: todayStart } } }),
        prisma.message.count({ where: { ...where, source: 'OUTBOUND', createdAt: { gte: todayStart } } }),
      ]);

      return {
        totalConversations,
        activeConversations,
        unreadConversations,
        archivedConversations,
        totalContacts,
        newContactsToday,
        messagesToday,
        messagesThisWeek,
        lineAccounts,
        inboundToday,
        outboundToday,
        avgResponseTimeMinutes: null, // calculated from messageTimeSeries for now
      };
    }),

  /** Time-series data for charts — messages per day for last N days */
  messageTimeSeries: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(14),
        lineAccountId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 14;
      const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);
      const channelFilter = buildChannelWhere(accessibleIds, input?.lineAccountId);
      if (channelFilter && '__denied' in channelFilter) return [];

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);

      const messages = await prisma.message.findMany({
        where: {
          ...(channelFilter || {}),
          createdAt: { gte: startDate },
        },
        select: { source: true, createdAt: true },
      });

      // Group by date
      const dateMap = new Map<string, { inbound: number; outbound: number }>();
      for (let i = 0; i < days; i++) {
        const d = new Date(startDate.getTime() + i * 86_400_000);
        const key = d.toISOString().split('T')[0]!;
        dateMap.set(key, { inbound: 0, outbound: 0 });
      }

      for (const msg of messages) {
        const key = msg.createdAt.toISOString().split('T')[0]!;
        const entry = dateMap.get(key);
        if (entry) {
          if (msg.source === 'INBOUND') entry.inbound++;
          else entry.outbound++;
        }
      }

      return Array.from(dateMap.entries()).map(([date, counts]) => ({
        date,
        inbound: counts.inbound,
        outbound: counts.outbound,
        total: counts.inbound + counts.outbound,
      }));
    }),

  /** Hourly activity heatmap — messages per hour for the last 7 days */
  hourlyHeatmap: protectedProcedure
    .input(
      z.object({ lineAccountId: z.string().optional() }).optional()
    )
    .query(async ({ ctx, input }) => {
      const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);
      const channelFilter = buildChannelWhere(accessibleIds, input?.lineAccountId);
      if (channelFilter && '__denied' in channelFilter) return [];

      const weekAgo = new Date(Date.now() - 7 * 86_400_000);

      const messages = await prisma.message.findMany({
        where: {
          ...(channelFilter || {}),
          createdAt: { gte: weekAgo },
        },
        select: { createdAt: true },
      });

      const hourCounts = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        count: 0,
        label: `${h.toString().padStart(2, '0')}:00`,
      }));

      for (const msg of messages) {
        const hour = msg.createdAt.getHours();
        hourCounts[hour]!.count++;
      }

      return hourCounts;
    }),

  /** Admin performance — messages sent by each admin */
  adminPerformance: protectedProcedure
    .input(
      z.object({
        lineAccountId: z.string().optional(),
        days: z.number().min(1).max(90).default(7),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 7;
      const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);
      const channelFilter = buildChannelWhere(accessibleIds, input?.lineAccountId);
      if (channelFilter && '__denied' in channelFilter) return [];

      const startDate = new Date(Date.now() - days * 86_400_000);

      const outboundMessages = await prisma.message.findMany({
        where: {
          ...(channelFilter || {}),
          source: 'OUTBOUND',
          sentByAdminId: { not: null },
          createdAt: { gte: startDate },
        },
        select: {
          sentByAdminId: true,
          sentByName: true,
        },
      });

      // Group by admin
      const adminMap = new Map<string, { name: string; count: number }>();
      for (const msg of outboundMessages) {
        if (!msg.sentByAdminId) continue;
        const existing = adminMap.get(msg.sentByAdminId);
        if (existing) {
          existing.count++;
        } else {
          adminMap.set(msg.sentByAdminId, {
            name: msg.sentByName || 'ไม่ระบุ',
            count: 1,
          });
        }
      }

      return Array.from(adminMap.entries())
        .map(([adminId, data]) => ({
          adminId,
          name: data.name,
          messagesSent: data.count,
        }))
        .sort((a, b) => b.messagesSent - a.messagesSent);
    }),

  /** Recent activity — paginated messages with cursor */
  recentActivity: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(15),
        cursor: z.string().optional(),
        lineAccountId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 15;
      const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);
      const channelFilter = buildChannelWhere(accessibleIds, input?.lineAccountId);
      if (channelFilter && '__denied' in channelFilter) {
        return { items: [], nextCursor: undefined };
      }

      const messages = await prisma.message.findMany({
        where: channelFilter || {},
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(input?.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          source: true,
          type: true,
          textContent: true,
          createdAt: true,
          sentByName: true,
          conversation: {
            select: {
              id: true,
              lineAccount: {
                select: { displayName: true },
              },
              contact: {
                select: {
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

      return { items: messages, nextCursor };
    }),

  /** Channel breakdown — message counts per LINE account */
  channelBreakdown: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(7),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 7;
      const accessibleIds = await getAccessibleChannelIds(ctx.session.adminUserId);
      const startDate = new Date(Date.now() - days * 86_400_000);

      const accounts = await prisma.lineAccount.findMany({
        where: {
          isActive: true,
          ...(accessibleIds ? { id: { in: accessibleIds } } : {}),
        },
        select: {
          id: true,
          displayName: true,
          pictureUrl: true,
          _count: {
            select: {
              conversations: true,
            },
          },
        },
      });

      // Get message counts per channel
      const messageCounts = await Promise.all(
        accounts.map(async (acc) => {
          const count = await prisma.message.count({
            where: {
              lineAccountId: acc.id,
              createdAt: { gte: startDate },
            },
          });
          return {
            lineAccountId: acc.id,
            name: acc.displayName,
            pictureUrl: acc.pictureUrl,
            totalConversations: acc._count.conversations,
            messagesInPeriod: count,
          };
        })
      );

      return messageCounts.sort((a, b) => b.messagesInPeriod - a.messagesInPeriod);
    }),
});
