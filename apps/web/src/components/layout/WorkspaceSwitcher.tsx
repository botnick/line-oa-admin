'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Building2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import styles from './WorkspaceSwitcher.module.css';

export interface WorkspaceSwitcherProps {
  variant?: 'full' | 'icon';
}

/**
 * WorkspaceSwitcher — dropdown to switch between LINE accounts.
 */
export function WorkspaceSwitcher({ variant = 'full' }: WorkspaceSwitcherProps = {}) {
  const { accountId, account, accounts, setAccountId, isLoading } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Don't show switcher if only 1 account or loading
  if (isLoading || accounts.length <= 1) return null;

  const displayName = account?.displayName ?? 'ทุกบัญชี';

  return (
    <div className={styles.switcher} ref={ref}>
      <button
        className={`${styles.trigger} ${variant === 'icon' ? styles.triggerIconOnly : ''}`}
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {account?.pictureUrl ? (
          <img
            src={account.pictureUrl}
            alt=""
            className={styles.triggerAvatar}
          />
        ) : (
          <Building2 size={16} />
        )}
        
        {variant === 'full' && (
          <>
            <span className={styles.triggerName}>{displayName}</span>
            <ChevronDown
              size={14}
              className={`${styles.triggerChevron} ${open ? styles.open : ''}`}
            />
          </>
        )}
      </button>

      {open && (
        <div className={styles.dropdown} role="listbox">
          <div className={styles.dropdownLabel}>LINE Accounts</div>

          {/* "All accounts" option */}
          <button
            className={`${styles.dropdownItem} ${accountId === null ? styles.active : ''}`}
            role="option"
            aria-selected={accountId === null}
            onClick={() => { setAccountId(null); setOpen(false); }}
          >
            <span className={styles.avatarPlaceholder}>
              <Building2 size={14} />
            </span>
            <span className={styles.dropdownName}>ทุกบัญชี</span>
            {accountId === null && <Check size={14} className={styles.checkIcon} />}
          </button>

          {accounts.map(acc => (
            <button
              key={acc.id}
              className={`${styles.dropdownItem} ${accountId === acc.id ? styles.active : ''}`}
              role="option"
              aria-selected={accountId === acc.id}
              onClick={() => { setAccountId(acc.id); setOpen(false); }}
            >
              {acc.pictureUrl ? (
                <img src={acc.pictureUrl} alt="" className={styles.dropdownAvatar} />
              ) : (
                <span className={styles.avatarPlaceholder}>
                  <Building2 size={14} />
                </span>
              )}
              <span className={styles.dropdownName}>
                {acc.displayName ?? acc.basicId ?? acc.id.slice(0, 8)}
              </span>
              {accountId === acc.id && <Check size={14} className={styles.checkIcon} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
