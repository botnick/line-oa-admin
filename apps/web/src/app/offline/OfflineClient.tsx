'use client';

import { WifiOff } from 'lucide-react';
import styles from './page.module.css';

export default function OfflineClient() {
  return (
    <div className={styles.offlineContainer}>
      <WifiOff size={48} className={styles.icon} />
      <h1 className={styles.title}>ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h1>
      <p className={styles.subtitle}>
        กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตของคุณแล้วลองใหม่อีกครั้ง
      </p>
      <button className={styles.retryBtn} onClick={() => location.reload()}>ลองใหม่</button>
    </div>
  );
}
