import { z } from 'zod';
import { getSettings, saveSettings } from '@line-oa/config/settings';
import { router, superAdminProcedure, protectedProcedure } from '../trpc';
import { withCache, invalidateCache } from '@/server/cache';

/**
 * Settings router — get and update app settings.
 * Secrets are masked in responses.
 */
export const settingsRouter = router({
  /** Get current settings (SUPER_ADMIN only — secrets masked) */
  get: superAdminProcedure.query(async () => {
    return withCache('settings:app', 86400, async () => {
      const settings = getSettings();

      return {
        app: { baseUrl: settings.app.baseUrl, appName: settings.app.appName ?? '' },
        setup: settings.setup,
        lineLogin: {
          channelId: settings.lineLogin.channelId,
          channelSecret: maskSecret(settings.lineLogin.channelSecret),
        },
        r2: {
          accountId: settings.r2.accountId,
          accessKeyId: maskSecret(settings.r2.accessKeyId),
          secretAccessKey: maskSecret(settings.r2.secretAccessKey),
          bucketName: settings.r2.bucketName,
          endpoint: settings.r2.endpoint,
          publicUrl: settings.r2.publicUrl,
        },
      };
    });
  }),

  /** Update settings (Requires SUPER_ADMIN) */
  update: superAdminProcedure
    .input(
      z.object({
        app: z
          .object({
            baseUrl: z.string().optional(),
            appName: z.string().max(30).optional(),
          })
          .optional(),
        lineLogin: z
          .object({
            channelId: z.string().optional(),
            channelSecret: z.string().optional(),
          })
          .optional(),
        r2: z
          .object({
            accountId: z.string().optional(),
            accessKeyId: z.string().optional(),
            secretAccessKey: z.string().optional(),
            bucketName: z.string().optional(),
            endpoint: z.string().optional(),
            publicUrl: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Create a deep copy to process
      const payload: any = { ...input };
      
      // Remove masked fields to avoid overwriting secrets with masked strings
      if (payload.lineLogin) {
        if (payload.lineLogin.channelSecret?.includes('•')) delete payload.lineLogin.channelSecret;
      }
      if (payload.r2) {
        if (payload.r2.accessKeyId?.includes('•')) delete payload.r2.accessKeyId;
        if (payload.r2.secretAccessKey?.includes('•')) delete payload.r2.secretAccessKey;
      }

      // saveSettings merges with existing values, partial fields are safe
      saveSettings(payload as Parameters<typeof saveSettings>[0]);
      
      // Invalidate cache
      await invalidateCache('settings:app');
      
      return { success: true };
    }),
});

/** Mask a secret string: show first 4 and last 4 chars */
function maskSecret(value: string): string {
  if (!value || value.length <= 8) return value ? '••••••••' : '';
  return `${value.slice(0, 4)}${'•'.repeat(value.length - 8)}${value.slice(-4)}`;
}
