import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

/**
 * Custom hook to handle Web Push Notification subscriptions.
 */
export function useWebPush() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  
  const subscribeMutation = trpc.push.subscribe.useMutation();
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation();

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // Check if already subscribed
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = async () => {
    if (!isSupported) {
      toast.error('เบราว์เซอร์นี้ไม่รองรับ Push Notifications');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      
      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // Find public Key from Env via window or build (Next.js config)
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        
        if (!vapidPublicKey) {
          throw new Error('VAPID public key not found');
        }

        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });

        const subJson = subscription.toJSON();
        
        if (!subJson.endpoint || !subJson.keys) {
          throw new Error('Invalid subscription');
        }

        await subscribeMutation.mutateAsync({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh!,
          auth: subJson.keys.auth!,
          userAgent: navigator.userAgent,
        });

        setIsSubscribed(true);
        toast.success('เปิดรับการแจ้งเตือนสำเร็จ');
      } else {
        toast.error('ผู้ใช้ปฏิเสธการแจ้งเตือน');
      }
    } catch (error) {
      console.error('Failed to subscribe to web push:', error);
      toast.error('เกิดข้อผิดพลาดในการเปิดแจ้งเตือน');
    }
  };

  const unsubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        await unsubscribeMutation.mutateAsync({ endpoint: subscription.endpoint });
      }
      
      setIsSubscribed(false);
      toast.success('ปิดการแจ้งเตือนสำเร็จ');
    } catch (error) {
      console.error('Failed to unsubscribe from web push:', error);
    }
  };

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    isLoading: subscribeMutation.isPending || unsubscribeMutation.isPending,
  };
}
