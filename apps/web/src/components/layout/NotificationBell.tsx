'use client';

import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Bell, CheckCheck, BellRing, BellOff,
  MoreHorizontal, Trash2, Eye, EyeOff, X, Check, Settings,
  UserPlus, UserMinus,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { formatRelative } from '@/lib/dayjs';
import { useWebPush } from '@/hooks/useWebPush';
import { Tooltip } from '../ui/Tooltip';
import styles from './NotificationBell.module.css';

type TabFilter = 'all' | 'unread';

interface NotifMetadata {
  channelPictureUrl?: string | null;
  contactPictureUrl?: string | null;
  messageCount?: number;
  contactId?: string;
  action?: 'follow' | 'unfollow';
  isUnblocked?: boolean;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  referenceId: string | null;
  metadata: NotifMetadata | null;
  claimedByAdminId: string | null;
  claimedByName: string | null;
  claimedAt: Date | string | null;
  createdAt: Date | string;
}

/* ── Time-based grouping ─────────────────── */
function groupByTime(items: NotificationItem[]) {
  const now = Date.now();
  const oneHour = 3_600_000;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const buckets: Record<string, NotificationItem[]> = {
    new: [], today: [], earlier: [],
  };

  for (const item of items) {
    const t = new Date(item.createdAt).getTime();
    if (now - t < oneHour) buckets.new.push(item);
    else if (t >= todayMs) buckets.today.push(item);
    else buckets.earlier.push(item);
  }

  const result: { label: string; items: NotificationItem[] }[] = [];
  if (buckets.new.length) result.push({ label: 'ใหม่', items: buckets.new });
  if (buckets.today.length) result.push({ label: 'วันนี้', items: buckets.today });
  if (buckets.earlier.length) result.push({ label: 'ก่อนหน้านี้', items: buckets.earlier });
  return result;
}

/* ── Parse notification text ──────────────── */
function parseNotif(notif: NotificationItem) {
  const accountName = notif.title || 'LINE OA';
  const raw = notif.message || '';
  const isFollowType = notif.type === 'FOLLOW' || notif.type === 'UNFOLLOW';

  // Follow/Unfollow notifications: use full message as preview, no colon split
  if (isFollowType) {
    return { accountName, senderName: '', preview: raw };
  }

  const colonIdx = raw.indexOf(':');
  let senderName = '';
  let preview = raw;
  if (colonIdx > 0 && colonIdx < 40) {
    senderName = raw.slice(0, colonIdx).trim();
    preview = raw.slice(colonIdx + 1).trim();
  }
  if (preview.length > 60) preview = preview.slice(0, 57) + '...';
  return { accountName, senderName, preview };
}

/* ── Component ────────────────────────────── */
export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<TabFilter>('all');
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [isShaking, setIsShaking] = useState(false);

  const { isSupported, isSubscribed, permission, subscribe, unsubscribe, isLoading: pushLoading } = useWebPush();
  const utils = trpc.useUtils();

  const { data: unreadCount = 0 } = trpc.notifications.getUnreadCount.useQuery(undefined, {
    refetchInterval: false,
  });

  // ── In-app notification sound via Web Audio API ──────────────────
  const prevCountRef = useRef(unreadCount);
  const playNotifSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);      // A5
      osc.frequency.setValueAtTime(1175, audioCtx.currentTime + 0.1); // D6
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch { /* Audio not available */ }
  }, []);

  useEffect(() => {
    if (unreadCount > prevCountRef.current && prevCountRef.current >= 0) {
      playNotifSound();
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 1000);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount, playNotifSound]);

  const {
    data: notifPages,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = trpc.notifications.list.useInfiniteQuery(
    { limit: 15, filter: tab },
    {
      enabled: isOpen,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  const toggleReadMutation = trpc.notifications.toggleRead.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  const deleteMutation = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  /* ── Positioning (desktop only — mobile uses CSS inset: 0) ── */
  const updatePosition = useCallback(() => {
    if (!buttonRef.current || !dropdownRef.current) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) return; // CSS handles full-screen on mobile

    const rect = buttonRef.current.getBoundingClientRect();
    const dd = dropdownRef.current;

    dd.style.top = `${rect.top}px`;
    dd.style.left = `${rect.right + 12}px`;
    dd.style.right = 'auto';
    dd.style.bottom = 'auto';

    const ddRect = dd.getBoundingClientRect();
    if (ddRect.right > window.innerWidth - 12) {
      dd.style.left = 'auto';
      dd.style.right = '12px';
    }
    if (ddRect.bottom > window.innerHeight - 12) {
      dd.style.top = 'auto';
      dd.style.bottom = '12px';
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => updatePosition());
      if (window.innerWidth < 768) {
        document.body.style.overflow = 'hidden';
      }
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!contextMenuId) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenuId]);

  const toggleOpen = () => { setIsOpen((p) => !p); setContextMenuId(null); };
  const close = () => { setIsOpen(false); setContextMenuId(null); };

  // Auto-close panel on route change (e.g. BottomNav tap)
  const pathname = usePathname();
  useEffect(() => { close(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkAllRead = () => markAsReadMutation.mutate({});

  const handleNotificationClick = (notif: NotificationItem) => {
    if (!notif.isRead) markAsReadMutation.mutate({ id: notif.id });
    close();
    if (notif.referenceId) router.push(`/inbox/${notif.referenceId}`);
  };

  const handleToggleRead = (id: string) => { toggleReadMutation.mutate({ id }); setContextMenuId(null); };
  const handleDelete = (id: string) => { deleteMutation.mutate({ id }); setContextMenuId(null); };

  const allItems: NotificationItem[] = (notifPages?.pages.flatMap((p) => p.items) ?? []) as NotificationItem[];
  const grouped = groupByTime(allItems);

  // Get current admin ID to detect self-claim
  const { data: session } = trpc.auth.me.useQuery(undefined, { retry: false });
  const myAdminId = session?.id;

  return (
    <>
      <div className={styles.container}>
        <button
          ref={buttonRef}
          className={`${styles.bellBtn} ${isOpen ? styles.bellBtnActive : ''} ${isShaking ? styles.bellShaking : ''}`}
          onClick={toggleOpen}
          aria-label="Notifications"
          aria-expanded={isOpen}
        >
          <Bell size={20} strokeWidth={2} />
          {unreadCount > 0 && (
            <span className={styles.badge}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              onClick={close}
            />

            <motion.div
              ref={dropdownRef}
              className={styles.panel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.15 }}
            >
              {/* Header */}
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>การแจ้งเตือน</h3>
                <div className={styles.panelActions}>
                  {unreadCount > 0 && (
                    <Tooltip content="อ่านทั้งหมด">
                      <button
                        className={styles.iconBtn}
                        onClick={handleMarkAllRead}
                        disabled={markAsReadMutation.isPending}
                      >
                        <CheckCheck size={16} />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip content="ปิด">
                    <button className={styles.iconBtn} onClick={close}>
                      <X size={16} />
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Tabs */}
              <div className={styles.tabBar}>
                <button
                  className={`${styles.tabBtn} ${tab === 'all' ? styles.tabBtnActive : ''}`}
                  onClick={() => setTab('all')}
                >
                  ทั้งหมด
                </button>
                <button
                  className={`${styles.tabBtn} ${tab === 'unread' ? styles.tabBtnActive : ''}`}
                  onClick={() => setTab('unread')}
                >
                  ยังไม่อ่าน
                </button>
              </div>

              {/* List */}
              <div className={styles.scrollArea}>
                {isLoading ? (
                  <div className={styles.empty}>
                    <div className={styles.dots}><span /><span /><span /></div>
                  </div>
                ) : allItems.length === 0 ? (
                  <div className={styles.empty}>
                    <Bell size={32} strokeWidth={1.2} style={{ opacity: 0.25 }} />
                    <span>{tab === 'unread' ? 'ไม่มีแจ้งเตือนที่ยังไม่อ่าน' : 'ไม่มีการแจ้งเตือน'}</span>
                  </div>
                ) : (
                  <>
                    {grouped.map((group) => (
                      <Fragment key={group.label}>
                        <div className={styles.groupLabel}>{group.label}</div>
                        {group.items.map((notif) => {
                          const { accountName, senderName, preview } = parseNotif(notif);
                          const meta = (notif.metadata ?? {}) as NotifMetadata;
                          const channelPic = meta.channelPictureUrl;
                          const contactPic = meta.contactPictureUrl;
                          const initial = (senderName || accountName).charAt(0).toUpperCase();

                          // Claim status
                          const isClaimed = !!notif.claimedByAdminId;
                          const isMyClam = notif.claimedByAdminId === myAdminId;

                          return (
                            <div
                              key={notif.id}
                              className={`${styles.row} ${!notif.isRead ? styles.rowUnread : ''}`}
                            >
                              <button
                                className={styles.rowMain}
                                onClick={() => handleNotificationClick(notif)}
                              >
                                {/* Dual Avatar — fallback always rendered, img overlays on top */}
                                <div className={styles.avatarWrap}>
                                  <div className={styles.avatarBigFallback}>
                                    <span>{accountName.charAt(0).toUpperCase()}</span>
                                  </div>
                                  {channelPic && (
                                    <img
                                      src={channelPic}
                                      alt=""
                                      className={styles.avatarBig}
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  )}
                                  <div className={styles.avatarSmallFallback}>
                                    <span>{initial}</span>
                                  </div>
                                  {contactPic && (
                                    <img
                                      src={contactPic}
                                      alt=""
                                      className={styles.avatarSmall}
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  )}
                                  {/* Follow/Unfollow type badge */}
                                  {notif.type === 'FOLLOW' && (
                                    <div className={`${styles.typeBadge} ${styles.typeBadgeFollow}`}>
                                      <UserPlus size={10} />
                                    </div>
                                  )}
                                  {notif.type === 'UNFOLLOW' && (
                                    <div className={`${styles.typeBadge} ${styles.typeBadgeUnfollow}`}>
                                      <UserMinus size={10} />
                                    </div>
                                  )}
                                </div>

                                {/* Content */}
                                <div className={styles.rowBody}>
                                  <p className={styles.rowText}>
                                    <strong>{accountName}</strong>
                                    {senderName && <> · <span className={styles.sender}>{senderName}</span></>}
                                  </p>
                                  {preview && (
                                    <p className={styles.rowPreview}>{preview}</p>
                                  )}
                                  <div className={styles.rowMeta}>
                                    <span className={`${styles.rowTime} ${!notif.isRead ? styles.rowTimeUnread : ''}`}>
                                      {formatRelative(notif.createdAt)}
                                    </span>
                                    {isClaimed && (
                                      <span className={`${styles.claimBadge} ${isMyClam ? styles.claimSelf : ''}`}>
                                        <Check size={10} />
                                        {isMyClam ? 'คุณตอบแล้ว' : `${notif.claimedByName} ตอบแล้ว`}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {!notif.isRead && !isClaimed && <div className={styles.dot} />}
                              </button>

                              {/* Context menu */}
                              <div className={styles.menuWrap}>
                                <Tooltip content="ตัวเลือก">
                                  <button
                                    className={styles.menuBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setContextMenuId(contextMenuId === notif.id ? null : notif.id);
                                    }}
                                    aria-label="ตัวเลือก"
                                  >
                                    <MoreHorizontal size={16} />
                                  </button>
                                </Tooltip>

                                <AnimatePresence>
                                  {contextMenuId === notif.id && (
                                    <motion.div
                                      ref={contextMenuRef}
                                      className={styles.ctxMenu}
                                      initial={{ opacity: 0, scale: 0.92, y: -4 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.92 }}
                                      transition={{ duration: 0.1 }}
                                    >
                                      <button
                                        className={styles.ctxItem}
                                        onClick={(e) => { e.stopPropagation(); handleToggleRead(notif.id); }}
                                      >
                                        {notif.isRead ? <EyeOff size={14} /> : <Eye size={14} />}
                                        {notif.isRead ? 'ยังไม่อ่าน' : 'อ่านแล้ว'}
                                      </button>
                                      <button
                                        className={`${styles.ctxItem} ${styles.ctxDanger}`}
                                        onClick={(e) => { e.stopPropagation(); handleDelete(notif.id); }}
                                      >
                                        <Trash2 size={14} />
                                        ลบ
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}

                    {hasNextPage && (
                      <button
                        className={styles.loadMore}
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                      >
                        {isFetchingNextPage ? 'กำลังโหลด...' : 'ดูการแจ้งเตือนก่อนหน้า'}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className={styles.footer}>
                {isSupported && permission !== 'denied' && (
                  <button
                    className={`${styles.pushBtn} ${isSubscribed ? styles.pushBtnActive : ''}`}
                    onClick={isSubscribed ? unsubscribe : subscribe}
                    disabled={pushLoading}
                  >
                    {isSubscribed ? (
                      <><BellOff size={14} /> ปิดแจ้งเตือน</>
                    ) : (
                      <><BellRing size={14} /> เปิดรับแจ้งเตือน</>
                    )}
                  </button>
                )}
                <button
                  className={styles.settingsLink}
                  onClick={() => { close(); router.push('/settings/notifications'); }}
                >
                  <Settings size={14} /> ตั้งค่าการแจ้งเตือน
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
