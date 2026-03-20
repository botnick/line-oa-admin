import webpush from 'web-push';
import { prisma } from '@line-oa/db';

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@localhost.com';

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(subject, publicVapidKey, privateVapidKey);
} else {
  console.warn('VAPID keys not configured, Web Push will not work.');
}

export { webpush };

/**
 * Send a web push notification to an admin user's active subscriptions
 */
export async function sendWebPushNotification(adminUserId: string, payload: { title: string; body: string; data?: any }) {
  if (!publicVapidKey || !privateVapidKey) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { adminUserId },
  });

  if (subscriptions.length === 0) return;

  const payloadString = JSON.stringify(payload);

  const pushPromises = subscriptions.map(async (sub: any) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payloadString
      );
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription has expired or is no longer valid
        console.log('Subscription expired. Deleting...', sub.endpoint);
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error('Failed to send web push:', err);
      }
    }
  });

  await Promise.allSettled(pushPromises);
}
