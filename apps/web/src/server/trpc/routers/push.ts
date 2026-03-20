import { z } from 'zod';
import { prisma } from '@line-oa/db';
import { router, protectedProcedure } from '../trpc';
import { sendWebPushNotification } from '../../webpush';

export const pushRouter = router({
  subscribe: protectedProcedure
    .input(z.object({
      endpoint: z.string(),
      p256dh: z.string(),
      auth: z.string(),
      userAgent: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await prisma.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: {
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent,
          adminUserId: ctx.session.adminUserId,
        },
        update: {
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent,
          adminUserId: ctx.session.adminUserId,
        },
      });
      return { success: true };
    }),

  unsubscribe: protectedProcedure
    .input(z.object({
      endpoint: z.string(),
    }))
    .mutation(async ({ input }) => {
      await prisma.pushSubscription.delete({
        where: { endpoint: input.endpoint }
      }).catch(() => {}); // silently ignore if not found
      return { success: true };
    }),

  testNotification: protectedProcedure
    .mutation(async ({ ctx }) => {
      await sendWebPushNotification(ctx.session.adminUserId, {
        title: 'ทดสอบการแจ้งเตือน',
        body: 'การแจ้งเตือนของคุณทำงานได้อย่างสมบูรณ์แบบบนอุปกรณ์นี้',
        data: { url: '/settings/notifications' }
      });
      return { success: true };
    }),
});
