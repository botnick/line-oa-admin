'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { InboxSidebar } from '@/components/inbox/InboxSidebar';
import { useWorkspace } from '@/hooks/useWorkspace';
import { NoChannelAccess } from '@/components/ui/NoChannelAccess';
import styles from './layout.module.css';

/** Sidebar width constraints */
const MIN_WIDTH = 260;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 360;
const STORAGE_KEY = 'inbox-sidebar-width';

/**
 * Inbox split-view layout.
 * Desktop: Sidebar (list) + Main (detail) are both visible.
 * Mobile: Toggles between Sidebar and Main based on the current URL.
 * Sidebar width is resizable via a drag handle.
 */
export default function InboxLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hasAccess } = useWorkspace();
  const isDetailView = pathname.startsWith('/inbox/') && pathname !== '/inbox';

  // ─── Resizable sidebar ───
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const w = parseInt(saved, 10);
        if (!isNaN(w) && w >= MIN_WIDTH && w <= MAX_WIDTH) {
          setSidebarWidth(w);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const onDragStart = useCallback(
    (clientX: number) => {
      dragRef.current = { startX: clientX, startW: sidebarWidth };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [sidebarWidth]
  );

  useEffect(() => {
    const onMove = (clientX: number) => {
      if (!dragRef.current) return;
      const delta = clientX - dragRef.current.startX;
      const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startW + delta));
      setSidebarWidth(newW);
    };
    const onEnd = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Persist
      try {
        localStorage.setItem(STORAGE_KEY, String(sidebarWidth));
      } catch { /* ignore */ }
    };

    const handleMouseMove = (e: MouseEvent) => onMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) onMove(e.touches[0].clientX);
    };
    const handleMouseUp = () => onEnd();
    const handleTouchEnd = () => onEnd();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [sidebarWidth]);

  if (!hasAccess) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <NoChannelAccess />
      </div>
    );
  }

  return (
    <div className={`${styles.layout} ${isDetailView ? styles.isDetail : styles.isList}`}>
      <div
        className={styles.sidebar}
        style={{ width: sidebarWidth }}
      >
        <InboxSidebar />
      </div>

      {/* Resize handle */}
      <div
        className={styles.resizeHandle}
        onMouseDown={(e) => {
          e.preventDefault();
          onDragStart(e.clientX);
        }}
        onTouchStart={(e) => {
          if (e.touches[0]) onDragStart(e.touches[0].clientX);
        }}
      />

      <div className={styles.main}>
        {children}
      </div>
    </div>
  );
}
