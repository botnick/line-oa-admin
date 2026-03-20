'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Pin, Archive, PanelRight, Download, Trash2, X, Search, MoreVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Tooltip } from '../ui/Tooltip';
import styles from './ChatHeader.module.css';

export interface ChatHeaderProps {
  conversationId: string;
  contactName: string;
  contactAvatar?: string | null;
  statusMessage?: string | null;
  isPinned?: boolean;
  isArchived?: boolean;
  labels?: { id: string; name: string; color: string }[];
  onTogglePanel?: () => void;
  onToggleSearch?: () => void;
}

/**
 * Chat detail header with back button, contact info, and action buttons.
 */
export function ChatHeader({
  conversationId,
  contactName,
  contactAvatar,
  statusMessage,
  isPinned = false,
  isArchived = false,
  labels = [],
  onTogglePanel,
  onToggleSearch,
}: ChatHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPinLimitModal, setShowPinLimitModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const togglePinMutation = trpc.conversations.togglePin.useMutation({
    onSuccess: () => {
      utils.conversations.list.invalidate();
      utils.conversations.get.invalidate({ id: conversationId });
    },
    onError: (error) => {
      if (error.message === 'PIN_LIMIT') {
        setShowPinLimitModal(true);
      }
    },
  });

  const toggleArchiveMutation = trpc.conversations.toggleArchive.useMutation({
    onSuccess: () => {
      utils.conversations.list.invalidate();
      utils.conversations.get.invalidate({ id: conversationId });
    },
  });

  const deleteMutation = trpc.conversations.delete.useMutation({
    onSuccess: () => {
      utils.conversations.list.invalidate();
      router.push('/inbox');
    },
  });

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handlePin = useCallback(() => {
    togglePinMutation.mutate({ id: conversationId });
    setMenuOpen(false);
  }, [conversationId, togglePinMutation]);

  const handleArchive = useCallback(() => {
    toggleArchiveMutation.mutate({ id: conversationId });
    setMenuOpen(false);
  }, [conversationId, toggleArchiveMutation]);

  /** Download chat history as .txt matching actual LINE format */
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const data = await utils.client.conversations.exportHistory.query({
        conversationId,
      });
      if (!data) throw new Error('No data');

      const thDays = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

      // Group messages by Date string: YYYY.MM.DD
      const grouped: Record<string, { dateObj: Date; messages: any[] }> = {};

      data.messages.forEach((m: any) => {
        const d = new Date(m.createdAt);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateKey = `${yyyy}.${mm}.${dd}`;

        if (!grouped[dateKey]) {
          grouped[dateKey] = { dateObj: d, messages: [] };
        }
        grouped[dateKey].messages.push(m);
      });

      let txtOutput = '';

      for (const dateKey of Object.keys(grouped).sort()) {
        const group = grouped[dateKey];
        const dayName = thDays[group.dateObj.getDay()];
        
        // Add date header
        txtOutput += `${dateKey} ${dayName}\n`;

        // Add messages
        for (const m of group.messages) {
          const d = new Date(m.createdAt);
          const hh = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          const timeStr = `${hh}:${min}`;
          
          let senderDisplay = '';
          if (m.source === 'OUTBOUND') {
            const adminName = m.sentByName || data.oaName || 'System';
            senderDisplay = `[Admin: ${adminName}]`;
          } else {
            senderDisplay = `[User: ${data.contactName}]`;
          }

          let content = '';
          if (m.type === 'TEXT') {
            content = m.textContent || '';
          } else if (m.type === 'IMAGE') {
            content = 'รูป';
          } else if (m.type === 'VIDEO') {
            content = 'วิดีโอ';
          } else if (m.type === 'AUDIO') {
            content = 'ข้อความเสียง';
          } else if (m.type === 'STICKER') {
            content = 'สติกเกอร์';
          } else if (m.type === 'LOCATION') {
            content = 'ตำแหน่งที่ตั้ง';
          } else if (m.type === 'FILE') {
            content = m.metadata?.originalFileName || m.metadata?.originalName || m.metadata?.fileName || 'ไฟล์';
          } else {
            content = `[${m.type}]`;
          }

          txtOutput += `${timeStr} ${senderDisplay} ${content}\n`;
        }
      }

      const blob = new Blob([txtOutput], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Typical LINE format filename: [LINE] Chat history with {Name}.txt
      a.download = `[LINE] Chat history with ${data.contactName}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download TXT failed', err);
    } finally {
      setIsDownloading(false);
    }
  }, [conversationId, utils.client.conversations]);

  /** Delete conversation with confirmation */
  const handleDelete = useCallback(() => {
    deleteMutation.mutate({ id: conversationId });
    setShowDeleteModal(false);
  }, [conversationId, deleteMutation]);

  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <button
          className={styles.backButton}
          onClick={() => router.push('/inbox')}
          type="button"
          aria-label="กลับ"
        >
          <ArrowLeft size={20} />
        </button>

        <div className={styles.avatar}>
          {contactAvatar ? (
            <img src={contactAvatar} alt="" className={styles.avatarImg} />
          ) : (
            <div className={styles.avatarFallback}>
              {contactName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className={styles.info}>
          <div className={styles.nameRow}>
            <span className={styles.name}>{contactName}</span>
            {labels.length > 0 && (
              <div className={styles.labels}>
                {labels.slice(0, 3).map((label) => (
                  <Tooltip key={label.id} content={label.name}>
                    <span
                      className={styles.labelChip}
                      style={{
                        backgroundColor: `${label.color}18`,
                        color: label.color,
                        borderColor: `${label.color}30`,
                      }}
                    >
                      <span
                        className={styles.labelDot}
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </span>
                  </Tooltip>
                ))}
                {labels.length > 3 && (
                  <span className={styles.labelMore}>+{labels.length - 3}</span>
                )}
              </div>
            )}
          </div>
          {statusMessage && (
            <span className={styles.status}>{statusMessage}</span>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <div className={styles.desktopActions}>
          <Tooltip content={isPinned ? 'เลิกปักหมุด' : 'ปักหมุด'}>
            <button
              className={`${styles.actionBtn} ${isPinned ? styles.actionBtnActive : ''}`}
              onClick={handlePin}
              type="button"
              disabled={togglePinMutation.isPending}
            >
              <Pin size={18} />
            </button>
          </Tooltip>

          <Tooltip content={isArchived ? 'เลิกจัดเก็บ' : 'จัดเก็บ'}>
            <button
              className={`${styles.actionBtn} ${isArchived ? styles.actionBtnActive : ''}`}
              onClick={handleArchive}
              type="button"
              disabled={toggleArchiveMutation.isPending}
            >
              <Archive size={18} />
            </button>
          </Tooltip>

          <Tooltip content="ดาวน์โหลดประวัติแชท">
            <button
              className={styles.actionBtn}
              onClick={handleDownload}
              type="button"
              disabled={isDownloading}
            >
              <Download size={18} />
            </button>
          </Tooltip>

          <Tooltip content="ลบแชท">
            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => setShowDeleteModal(true)}
              type="button"
            >
              <Trash2 size={18} />
            </button>
          </Tooltip>
        </div>

        {onToggleSearch && (
          <Tooltip content="ค้นหาในแชท">
            <button
              className={styles.actionBtn}
              onClick={onToggleSearch}
              type="button"
            >
              <Search size={18} />
            </button>
          </Tooltip>
        )}

        {onTogglePanel && (
          <Tooltip content="แสดงรายละเอียด">
            <button
              className={styles.actionBtn}
              onClick={onTogglePanel}
              type="button"
            >
              <PanelRight size={18} />
            </button>
          </Tooltip>
        )}

        <div className={styles.mobileMore}>
          <button
            className={`${styles.actionBtn} ${showMobileMenu ? styles.actionBtnActive : ''}`}
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            type="button"
          >
            <MoreVertical size={18} />
          </button>

          {showMobileMenu && (
            <>
              <div className={styles.mobileMenuOverlay} onClick={() => setShowMobileMenu(false)} />
              <div className={styles.mobileMenuDropdown}>
                <button
                  className={`${styles.menuItem} ${isPinned ? styles.menuItemActive : ''}`}
                  onClick={() => { handlePin(); setShowMobileMenu(false); }}
                  disabled={togglePinMutation.isPending}
                >
                  <Pin size={16} /> <span>{isPinned ? 'เลิกปักหมุด' : 'ปักหมุด'}</span>
                </button>
                <button
                  className={`${styles.menuItem} ${isArchived ? styles.menuItemActive : ''}`}
                  onClick={() => { handleArchive(); setShowMobileMenu(false); }}
                  disabled={toggleArchiveMutation.isPending}
                >
                  <Archive size={16} /> <span>{isArchived ? 'เลิกจัดเก็บ' : 'จัดเก็บ'}</span>
                </button>
                <button
                  className={styles.menuItem}
                  onClick={() => { handleDownload(); setShowMobileMenu(false); }}
                  disabled={isDownloading}
                >
                  <Download size={16} /> <span>ดาวน์โหลดแชท</span>
                </button>
                <div className={styles.menuSeparator} />
                <button
                  className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  onClick={() => { setShowDeleteModal(true); setShowMobileMenu(false); }}
                >
                  <Trash2 size={16} /> <span>ลบแชท</span>
                </button>
              </div>
            </>
          )}
        </div>

        <Tooltip content="ปิดการสนทนา">
          <button
            className={styles.actionBtn}
            onClick={() => router.push('/inbox')}
            type="button"
          >
            <X size={18} />
          </button>
        </Tooltip>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <Trash2 size={28} />
            </div>
            <h3 className={styles.modalTitle}>ลบบทสนทนา</h3>
            <p className={styles.modalDesc}>
              คุณแน่ใจหรือไม่ว่าต้องการลบแชทกับ <strong>{contactName}</strong>?
              <br />ข้อความทั้งหมดจะถูกลบถาวร
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancel}
                onClick={() => setShowDeleteModal(false)}
                type="button"
              >
                ยกเลิก
              </button>
              <button
                className={styles.modalConfirm}
                onClick={handleDelete}
                type="button"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'กำลังลบ...' : 'ลบแชท'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pin Limit Modal */}
      {showPinLimitModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPinLimitModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <Pin size={28} />
            </div>
            <h3 className={styles.modalTitle}>ปักหมุดเต็มจำนวน</h3>
            <p className={styles.modalDesc}>
              คุณปักหมุดครบ <strong>10 แชท</strong> แล้ว
              <br />กรุณาเลิกปักหมุดแชทอื่นก่อน
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancel}
                onClick={() => setShowPinLimitModal(false)}
                type="button"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
