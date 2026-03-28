import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '@line-oa/db';
import { router, protectedProcedure, superAdminProcedure } from '../trpc';
import { getBotInfo } from '../../line/api';

const createSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
  channelSecret: z.string().min(1, 'Channel Secret is required'),
  channelAccessToken: z.string().min(1, 'Channel Access Token is required'),
});

const updateSchema = createSchema.extend({
  id: z.string(),
  isActive: z.boolean().optional(),
});

function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 8) return '****';
  return `${secret.substring(0, 4)}••••${secret.substring(secret.length - 4)}`;
}

export const lineAccountsRouter = router({
  /** List LINE accounts accessible by this admin (secrets masked) */
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Resolve channel access for non-SUPER_ADMIN
      const user = await prisma.adminUser.findUnique({
        where: { id: ctx.session.adminUserId },
        select: { role: true },
      });

      let accessibleIds: string[] | null = null;

      if (user?.role !== 'SUPER_ADMIN') {
        const accessRecords = await prisma.adminChannelAccess.findMany({
          where: { adminUserId: ctx.session.adminUserId },
          select: { lineAccountId: true },
        });
        // Deny-by-default: no records = no access (empty array)
        accessibleIds = accessRecords.map((r) => r.lineAccountId);
      }

      const whereClause: Record<string, unknown> = { isActive: true };
      if (accessibleIds) {
        whereClause.id = { in: accessibleIds };
      }

      const raw = await prisma.lineAccount.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
      });
      return raw.map(acc => ({
        ...acc,
        channelSecret: maskSecret(acc.channelSecret),
        channelAccessToken: maskSecret(acc.channelAccessToken),
      }));
    } catch (err) {
      // NOTE: table may not exist if DB hasn't been migrated yet — return empty
      console.warn('[lineAccounts.list] DB error, returning empty list:', (err as Error).message);
      return [];
    }
  }),

  /** List all accounts (including inactive) — SUPER_ADMIN only */
  listAll: superAdminProcedure.query(async () => {
    const raw = await prisma.lineAccount.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { conversations: true, messages: true } },
      },
    });
    return raw.map(acc => ({
      ...acc,
      channelSecret: maskSecret(acc.channelSecret),
      channelAccessToken: maskSecret(acc.channelAccessToken),
    }));
  }),

  /** Get single account by ID (secrets masked) */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const acc = await prisma.lineAccount.findUnique({
        where: { id: input.id },
      });
      if (!acc) return null;
      return {
        ...acc,
        channelSecret: maskSecret(acc.channelSecret),
        channelAccessToken: maskSecret(acc.channelAccessToken),
      };
    }),

  /** Test LINE API connection with a token */
  testConnection: protectedProcedure
    .input(z.object({ channelAccessToken: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        const info = await getBotInfo(input.channelAccessToken);
        return { success: true as const, botInfo: info };
      } catch (err: any) {
        return { success: false as const, error: err?.message || 'Connection failed' };
      }
    }),

  /** Create new LINE account — SUPER_ADMIN only */
  create: superAdminProcedure
    .input(createSchema)
    .mutation(async ({ input }) => {
      const info = await getBotInfo(input.channelAccessToken).catch(() => null);
      if (!info?.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Channel Access Token ไม่ถูกต้อง: ไม่สามารถดึงข้อมูล Bot ได้',
        });
      }

      const existing = await prisma.lineAccount.findUnique({
        where: { botUserId: info.userId },
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'LINE Account นี้ถูกเพิ่มในระบบแล้ว',
        });
      }

      const created = await prisma.lineAccount.create({
        data: {
          channelId: input.channelId,
          channelSecret: input.channelSecret,
          channelAccessToken: input.channelAccessToken,
          botUserId: info.userId,
          basicId: info.basicId,
          displayName: info.displayName,
          pictureUrl: info.pictureUrl,
        },
      });

      return {
        ...created,
        channelSecret: maskSecret(created.channelSecret),
        channelAccessToken: maskSecret(created.channelAccessToken),
      };
    }),

  /** Update LINE account — SUPER_ADMIN only */
  update: superAdminProcedure
    .input(updateSchema)
    .mutation(async ({ input }) => {
      const info = await getBotInfo(input.channelAccessToken).catch(() => null);
      if (!info?.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Channel Access Token ไม่ถูกต้อง: ไม่สามารถดึงข้อมูล Bot ได้',
        });
      }

      const existing = await prisma.lineAccount.findUnique({
        where: { botUserId: info.userId },
      });
      if (existing && existing.id !== input.id) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Bot User ID นี้ถูกใช้โดย LINE Account อื่นแล้ว',
        });
      }

      const updated = await prisma.lineAccount.update({
        where: { id: input.id },
        data: {
          channelId: input.channelId,
          channelSecret: input.channelSecret,
          channelAccessToken: input.channelAccessToken,
          botUserId: info.userId,
          basicId: info.basicId,
          displayName: info.displayName,
          pictureUrl: info.pictureUrl,
          isActive: input.isActive ?? true,
        },
      });

      return {
        ...updated,
        channelSecret: maskSecret(updated.channelSecret),
        channelAccessToken: maskSecret(updated.channelAccessToken),
      };
    }),

  /** Toggle active status — SUPER_ADMIN only */
  toggleActive: superAdminProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      await prisma.lineAccount.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
      return { success: true };
    }),

  /** Soft-delete LINE account (set isActive=false) — SUPER_ADMIN only */
  delete: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.lineAccount.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      return { success: true };
    }),

  /** Hard-delete LINE account — SUPER_ADMIN only */
  hardDelete: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Permanently remove from database (cascades to conversations, messages, etc.)
      await prisma.lineAccount.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
