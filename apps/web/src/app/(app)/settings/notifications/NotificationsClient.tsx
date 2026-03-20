'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Smartphone, CheckCircle, AlertCircle, RefreshCw, Volume2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import styles from './page.module.css';

export function NotificationsClient() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const subscribeMutation = trpc.push.subscribe.useMutation();
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation();
  const testNotificationMutation = trpc.push.testNotification.useMutation({
    onSuccess: () => {
      setStatusMsg({ type: 'success', text: 'ส่งทดสอบการแจ้งเตือนสำเร็จ กรุณารอสักครู่' });
      setTimeout(() => setStatusMsg(null), 3000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: `เกิดข้อผิดพลาด: ${err.message}` });
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      if (!('serviceWorker' in navigator)) return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleSubscribe = async () => {
    setIsProcessing(true);
    setStatusMsg(null);
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('เบราว์เซอร์ของคุณไม่รองรับ Service Worker');
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        throw new Error('คุณไม่อนุญาตให้แสดงการแจ้งเตือน (กรุณาไปเปิดสิทธิ์ในตั้งค่าของระบบอนุญาตแจ้งเตือน)');
      }

      const registration = await navigator.serviceWorker.ready;
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicVapidKey) {
        throw new Error('ไม่พบ VAPID_PUBLIC_KEY ในระบบ โปรดติดต่อแอดมิน');
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });

      const subJson = subscription.toJSON();
      await subscribeMutation.mutateAsync({
        endpoint: subscription.endpoint,
        p256dh: subJson.keys?.p256dh ?? '',
        auth: subJson.keys?.auth ?? '',
      });

      setIsSubscribed(true);
      setStatusMsg({ type: 'success', text: 'เปิดใช้การแจ้งเตือนสำเร็จ!' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.message || 'เปิดการแจ้งเตือนไม่สำเร็จ' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsProcessing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await unsubscribeMutation.mutateAsync({
          endpoint: subscription.endpoint,
        });
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
      setStatusMsg({ type: 'success', text: 'ปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'ปิดการแจ้งเตือนไม่สำเร็จ' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTestNotification = () => {
    testNotificationMutation.mutate();
  };

  const playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Two-tone chime (C6 → E6)
      [0, 0.15].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = i === 0 ? 1047 : 1319; // C6, E6
        gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.3);
      });
    } catch (err) {
      console.error('Audio error:', err);
    }
  };

  /** Determine which CSS class the permission dot should use */
  const permDotClass = permission === 'granted'
    ? styles.statusDotGranted
    : permission === 'denied'
      ? styles.statusDotDenied
      : styles.statusDotDefault;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ---- Header (matches line-accounts pattern) ---- */}
        <div className={styles.header}>
          <Link href="/settings" className={styles.backBtn}>
            <ArrowLeft size={20} />
          </Link>
          <div className={styles.headerText}>
            <h1 className={styles.title}>การแจ้งเตือน (Notifications)</h1>
            <p className={styles.subtitle}>ตั้งค่าและทดสอบเพื่อให้แน่ใจว่าคุณจะได้รับข้อความลูกค้าทันที</p>
          </div>
        </div>

        {/* ---- Section 1: Enable Push ---- */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>1. เปิดใช้งานการแจ้งเตือน (Push Notifications)</h2>
            <p className={styles.sectionDesc}>ขอสิทธิ์และเปิดใช้งานการแจ้งเตือนบนเบราว์เซอร์นี้</p>
          </div>

          <div className={styles.statusPanel}>
            {/* Permission status */}
            <div className={styles.statusRow}>
              <div className={`${styles.statusDot} ${permDotClass}`}>
                <Bell size={18} />
              </div>
              <div className={styles.statusInfo}>
                <div className={styles.statusLabel}>สถานะสิทธิ์การแจ้งเตือน</div>
                <div className={styles.statusValue}>
                  {permission === 'granted' ? 'อนุญาตแล้ว (Granted)' : (permission === 'denied' ? 'ถูกบล็อค (Denied)' : 'ยังไม่ได้ถาม (Default)')}
                </div>
              </div>
            </div>

            {/* Subscription status */}
            <div className={styles.statusRow}>
              <div className={`${styles.statusDot} ${isSubscribed ? styles.statusDotActive : styles.statusDotInactive}`}>
                <CheckCircle size={18} />
              </div>
              <div className={styles.statusInfo}>
                <div className={styles.statusLabel}>สถานะการเชื่อมต่อ (Subscription)</div>
                <div className={styles.statusValue}>
                  {isSubscribed ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้เชื่อมต่ออุปกรณ์นี้'}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className={styles.statusActions}>
              {!isSubscribed ? (
                <button
                  className={styles.btnPrimary}
                  onClick={handleSubscribe}
                  disabled={isProcessing || permission === 'denied'}
                  type="button"
                >
                  {isProcessing ? <RefreshCw className={styles.spinner} size={16} /> : <Bell size={16} />}
                  เปิดใช้งานการแจ้งเตือน
                </button>
              ) : (
                <button
                  className={styles.btnSecondary}
                  onClick={handleUnsubscribe}
                  disabled={isProcessing}
                  type="button"
                >
                  {isProcessing ? <RefreshCw className={styles.spinner} size={16} /> : <AlertCircle size={16} />}
                  ยกเลิกการแจ้งเตือน
                </button>
              )}
            </div>

            {permission === 'denied' && (
              <div className={styles.deniedMsg}>
                * เบราว์เซอร์ของคุณบล็อกการแจ้งเตือน กรุณาไปที่รูปแม่กุญแจ 🔒 บน URL Bar แล้วเปลี่ยนสิทธิ์ Notifications เป็น Allow
              </div>
            )}

            {statusMsg && (
              <span className={`${styles.statusMsg} ${statusMsg.type === 'success' ? styles.statusSuccess : styles.statusError}`}>
                {statusMsg.text}
              </span>
            )}
          </div>
        </div>

        {/* ---- Section 2: Test ---- */}
        <div className={styles.section} style={{ opacity: isSubscribed ? 1 : 0.5, pointerEvents: isSubscribed ? 'auto' : 'none' }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>2. ทดสอบระบบ (Test Notification)</h2>
            <p className={styles.sectionDesc}>ลองส่งข้อความจำลองเพื่อยืนยันว่าการแจ้งเตือนทำงานได้ทุกแพลตฟอร์ม</p>
          </div>

          <div className={styles.statusPanel}>
            <div className={styles.testGrid}>
              <div className={styles.testCard}>
                <h3 className={styles.testCardTitle}>ส่งโดยตรงถึงเครื่องนี้</h3>
                <p className={styles.testCardDesc}>
                  กดเพื่อส่งพุชโนติเข้าเครื่องนี้ (Desktop / Android / iOS Chrome / iOS Safari Webapp)
                </p>
                <button
                  className={styles.btnPrimary}
                  onClick={handleTestNotification}
                  disabled={testNotificationMutation.isPending}
                  type="button"
                >
                  {testNotificationMutation.isPending ? <RefreshCw className={styles.spinner} size={16} /> : <Smartphone size={16} />}
                  ลองส่งแจ้งเตือนเดี๋ยวนี้
                </button>
              </div>

              <div className={styles.testDivider} />

              <div className={styles.testCard}>
                <h3 className={styles.testCardTitle}>ทดสอบเสียงแจ้งเตือน</h3>
                <p className={styles.testCardDesc}>
                  ตรวจสอบว่าเบราว์เซอร์สามารถเล่นเสียงได้หรือไม่เมื่อมีข้อความใหม่ (จำเป็นสำหรับเสียงตอนเปิดหน้าเว็บค้างไว้)
                </p>
                <button
                  className={styles.btnSecondary}
                  onClick={playNotificationSound}
                  type="button"
                >
                  <Volume2 size={16} />
                  เล่นเสียงแจ้งเตือน
                </button>
              </div>
            </div>

            <div className={styles.infoBox}>
              <strong>เคล็ดลับ iOS:</strong> สำหรับผู้ใช้ iPhone / iPad ต้องกด &quot;เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)&quot; ก่อน ถึงจะรับแบบ Push Notification ที่หน้าจอล็อคได้สมบูรณ์แบบ
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
