'use client';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/th';
import { Pin, ShieldAlert, UserX } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import styles from './ConversationItem.module.css';

dayjs.extend(relativeTime);
dayjs.locale('th');

export interface TagChip {
  id: string;
  name: string;
  color: string;
}

export interface ConversationItemProps {
  id: string;
  contactName: string;
  contactAvatar?: string | null;
  lastMessage: string;
  lastMessageAt: Date | string;
  lastMessageSource: 'INBOUND' | 'OUTBOUND';
  lastMessageType: string;
  unreadCount: number;
  isPinned: boolean;
  isActive?: boolean;
  tags?: TagChip[];
  lineAccount?: {
    id: string;
    displayName: string;
    pictureUrl: string | null;
  } | null;
  hideOaBadge?: boolean;
  /** Contact follow status */
  contactStatus?: 'active' | 'blocked' | 'refollow';
  onClick?: () => void;
}

/**
 * Single conversation row in the inbox list.
 */
export function ConversationItem({
  contactName,
  contactAvatar,
  lastMessage,
  lastMessageAt,
  lastMessageSource,
  lastMessageType,
  unreadCount,
  isPinned,
  isActive,
  tags = [],
  lineAccount,
  hideOaBadge,
  contactStatus = 'active',
  onClick,
}: ConversationItemProps) {
  const visibleTags = tags.slice(0, 3);
  const moreCount = tags.length - visibleTags.length;
  const time = dayjs(lastMessageAt);
  const isToday = time.isSame(dayjs(), 'day');
  const timeLabel = isToday ? time.format('HH:mm') : time.fromNow();

  const messagePrefix = lastMessageSource === 'OUTBOUND' ? 'คุณ: ' : '';
  let preview = lastMessage;
  if (lastMessageType !== 'TEXT') {
    const typeLabels: Record<string, string> = {
      IMAGE: '📷 รูปภาพ',
      VIDEO: '🎥 วิดีโอ',
      AUDIO: '🎵 เสียง',
      FILE: '📎 ไฟล์',
      STICKER: '😊 สติกเกอร์',
      LOCATION: '📍 ตำแหน่ง',
    };
    preview = typeLabels[lastMessageType] ?? lastMessage;
  }

  return (
    <button
      className={`${styles.item} ${isActive ? styles.active : ''} ${isPinned ? styles.pinned : ''} ${contactStatus === 'blocked' ? styles.blocked : ''}`}
      onClick={onClick}
      type="button"
    >
      <div className={styles.avatarWrapper}>
        <div className={styles.avatar}>
          {contactAvatar ? (
            <img src={contactAvatar} alt="" className={styles.avatarImg} />
          ) : (
            <div className={styles.avatarFallback}>
              {contactName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        {lineAccount && !hideOaBadge && (
          <Tooltip content={lineAccount.displayName} position="right">
            <img
              src={lineAccount.pictureUrl || '/images/default-avatar.png'}
              alt=""
              className={styles.oaBadge}
            />
          </Tooltip>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.name}>{contactName}</span>
            {lineAccount && !hideOaBadge && (
              <Tooltip content={`บัญชี: ${lineAccount.displayName}`} position="bottom">
                <span className={styles.oaNameTag}>
                  {lineAccount.displayName}
                </span>
              </Tooltip>
            )}
            {isPinned && <Pin size={12} className={styles.pinIcon} />}
            {contactStatus === 'blocked' && (
              <Tooltip content="ผู้ใช้เลิกติดตามบัญชีแล้ว" position="bottom">
                <span className={styles.statusBlocked}>
                  <ShieldAlert size={11} />
                </span>
              </Tooltip>
            )}
            {contactStatus === 'refollow' && (
              <Tooltip content="เคยเลิกติดตาม — กลับมาติดตามอีกครั้ง" position="bottom">
                <span className={styles.statusRefollow}>
                  <UserX size={10} />
                </span>
              </Tooltip>
            )}
          </div>
          <span className={styles.time}>{timeLabel}</span>
        </div>

        <div className={styles.preview}>
          <span className={styles.previewText}>
            {messagePrefix}{preview}
          </span>
          {unreadCount > 0 && (
            <span className={styles.badge}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        {visibleTags.length > 0 && (
          <div className={styles.chips}>
            {visibleTags.map((tag) => (
              <span
                key={tag.id}
                className={styles.chip}
                style={{
                  '--chip-color': tag.color,
                  backgroundColor: `${tag.color}14`,
                  color: tag.color,
                } as React.CSSProperties}
              >
                <span
                  className={styles.chipDot}
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </span>
            ))}
            {moreCount > 0 && (
              <span className={styles.chipMore}>+{moreCount}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
