'use client';

import { useWorkspace } from '@/hooks/useWorkspace';
import styles from './ChannelFilter.module.css';

/**
 * Reusable OA channel filter — "ทั้งหมด" + per-account buttons.
 * Uses the shared workspace context.
 */
export function ChannelFilter() {
  const { accountId, accounts, setAccountId } = useWorkspace();

  if (accounts.length <= 1) return null;

  return (
    <div className={styles.filterWrap}>
      <button
        className={`${styles.filterBtn} ${!accountId ? styles.active : ''}`}
        onClick={() => setAccountId(null)}
      >
        ทั้งหมด
      </button>
      {accounts.map((acc) => (
        <button
          key={acc.id}
          className={`${styles.filterBtn} ${accountId === acc.id ? styles.active : ''}`}
          onClick={() => setAccountId(acc.id)}
          title={acc.basicId || acc.displayName || ''}
        >
          {acc.pictureUrl ? (
            <img
              src={acc.pictureUrl}
              alt=""
              className={styles.filterAvatar}
            />
          ) : null}
          <span className={styles.filterName}>
            {acc.displayName || acc.basicId || 'LINE OA'}
          </span>
        </button>
      ))}
    </div>
  );
}
