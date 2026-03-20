'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { MessageSquare, X, Search, Zap, ExternalLink } from 'lucide-react';
import styles from './QuickReplyPicker.module.css';

interface QuickReplyPickerProps {
  onSelect: (content: string) => void;
  onClose: () => void;
}

export function QuickReplyPicker({ onSelect, onClose }: QuickReplyPickerProps) {
  const { data: replies, isPending } = trpc.quickReplies.list.useQuery();
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Auto-focus search on open
  useEffect(() => {
    const timer = setTimeout(() => searchRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    if (!replies) return [];
    if (!search.trim()) return replies;
    const q = search.toLowerCase();
    return replies.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q) ||
        (r.shortcut && r.shortcut.toLowerCase().includes(q))
    );
  }, [replies, search]);

  return (
    <div className={styles.picker}>
      {/* ─── Header bar (matches StickerEmojiPicker modeBar) ─── */}
      <div className={styles.headerBar}>
        <div className={styles.headerTitle}>
          <Zap size={14} />
          <span>ข้อความตอบกลับด่วน</span>
        </div>
        {replies && replies.length > 0 && (
          <span className={styles.headerCount}>{filtered.length} รายการ</span>
        )}
        <button
          className={styles.closeBtn}
          onClick={onClose}
          type="button"
          aria-label="ปิด"
        >
          <X size={16} />
        </button>
      </div>

      {/* ─── Search bar ─── */}
      {replies && replies.length > 0 && (
        <div className={styles.searchBar}>
          <Search size={14} className={styles.searchIcon} />
          <input
            ref={searchRef}
            className={styles.searchInput}
            type="text"
            placeholder="ค้นหาข้อความ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className={styles.searchClear}
              onClick={() => setSearch('')}
              type="button"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* ─── Reply list ─── */}
      <div className={styles.list}>
        {isPending ? (
          <div className={styles.empty}>
            <div className={styles.loadingDots}>
              <span /><span /><span />
            </div>
            <span>กำลังโหลด...</span>
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((reply) => (
            <button
              key={reply.id}
              className={styles.replyCard}
              onClick={() => onSelect(reply.content)}
              type="button"
            >
              <div className={styles.replyHeader}>
                <span className={styles.replyTitle}>{reply.title}</span>
                {reply.shortcut && (
                  <kbd className={styles.shortcutBadge}>{reply.shortcut}</kbd>
                )}
              </div>
              <p className={styles.replyContent}>{reply.content}</p>
            </button>
          ))
        ) : search ? (
          <div className={styles.empty}>
            <Search size={28} strokeWidth={1.5} />
            <span>ไม่พบ "{search}"</span>
          </div>
        ) : (
          <div className={styles.empty}>
            <MessageSquare size={28} strokeWidth={1.5} />
            <span>ยังไม่มีข้อความตอบกลับด่วน</span>
            <Link
              href="/settings/quick-replies"
              className={styles.settingsLink}
              onClick={onClose}
            >
              <ExternalLink size={13} />
              เพิ่มในหน้าตั้งค่า
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
