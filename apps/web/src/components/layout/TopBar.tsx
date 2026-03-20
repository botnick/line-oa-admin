'use client';

import { useLineSyncStatus } from './LineSyncHandler';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { NotificationBell } from './NotificationBell';
import styles from './TopBar.module.css';

interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  const { phase } = useLineSyncStatus();

  return (
    <header className={styles.topbar}>
      <h1 className={styles.title}>{title ?? 'LINE OA Admin'}</h1>
      <div className={styles.actions}>
        <WorkspaceSwitcher />
        <NotificationBell />
      </div>

      {/* Dynamic shimmer bar: amber while reconnecting → green on success → fade out */}
      {phase !== 'idle' && (
        <div
          className={`${styles.shimmerBar} ${phase === 'reconnected' ? styles.shimmerSuccess : ''}`}
          aria-hidden="true"
        />
      )}
    </header>
  );
}
