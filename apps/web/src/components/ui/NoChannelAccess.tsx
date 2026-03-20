'use client';

import { ShieldOff, Info } from 'lucide-react';
import styles from './NoChannelAccess.module.css';

/**
 * NoChannelAccess — beautiful restricted-access view shown when an admin
 * has not been assigned any LINE channels. Replaces generic empty states
 * with a clear, helpful message.
 */
export function NoChannelAccess() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconBadge}>
          <ShieldOff size={36} strokeWidth={1.5} />
        </div>

        <h2 className={styles.title}>ยังไม่มีสิทธิ์เข้าถึงช่องทาง</h2>

        <p className={styles.description}>
          บัญชีของคุณยังไม่ได้รับมอบหมายให้เข้าถึงช่องทาง LINE OA ใดๆ
          กรุณาติดต่อผู้ดูแลระบบ (Super Admin) เพื่อขอสิทธิ์การเข้าถึง
        </p>

        <div className={styles.hint}>
          <Info size={14} />
          <span>สิทธิ์จะอัปเดตอัตโนมัติเมื่อได้รับอนุญาต</span>
        </div>
      </div>
    </div>
  );
}
