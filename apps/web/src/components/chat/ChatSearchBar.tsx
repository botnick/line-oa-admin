'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useDebounce } from '@/hooks/useDebounce';
import { Tooltip } from '../ui/Tooltip';
import styles from './ChatSearchBar.module.css';

interface ChatSearchBarProps {
  conversationId: string;
  contactName: string;
  contactAvatar?: string | null;
  oaName?: string;
  onClose: () => void;
}

/**
 * Formats date/time for search results.
 */
function formatShortTime(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = todayStart.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayMs = 86_400_000;

  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const time = `${hh}:${mm} น.`;

  if (diff < dayMs) return time;

  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const day = d.getDate();
  const month = monthNames[d.getMonth()];

  if (d.getFullYear() === now.getFullYear()) {
    return `${day} ${month} ${time}`;
  }
  return `${day} ${month} ${d.getFullYear() + 543}`;
}

/**
 * Highlight query match within text.
 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className={styles.highlight}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/**
 * LINE-style in-chat search bar with results dropdown and navigation.
 */
export function ChatSearchBar({
  conversationId,
  contactName,
  contactAvatar,
  oaName,
  onClose,
}: ChatSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(queryParam);
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedQuery = useDebounce(query, 350);
  const prevResultsLenRef = useRef(0);
  const autoNavDoneRef = useRef(false);

  const { data: searchResults, isFetching } = trpc.search.searchInConversation.useQuery(
    { conversationId, query: debouncedQuery, limit: 50 },
    { enabled: debouncedQuery.length > 0 }
  );

  const results = useMemo(() => searchResults?.items ?? [], [searchResults]);
  const totalResults = results.length;

  // Navigate results and sync to URL
  const scrollToMessage = useCallback((msgId: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('msgId', msgId);
    sp.set('q', debouncedQuery);
    router.replace(`${pathname}?${sp.toString()}`);
  }, [router, pathname, searchParams, debouncedQuery]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset active index and auto-navigate to first result
  useEffect(() => {
    setActiveIndex(0);
    // Auto-navigate to first result when new results arrive
    if (results.length > 0 && prevResultsLenRef.current === 0 && !autoNavDoneRef.current) {
      autoNavDoneRef.current = true;
      scrollToMessage(results[0].id);
    }
    prevResultsLenRef.current = results.length;
  }, [results, scrollToMessage]);

  // Reset auto-nav tracking on query change
  useEffect(() => {
    autoNavDoneRef.current = false;
    prevResultsLenRef.current = 0;
  }, [debouncedQuery]);

  const goTo = useCallback(
    (index: number) => {
      if (totalResults === 0) return;
      const newIndex = ((index % totalResults) + totalResults) % totalResults;
      setActiveIndex(newIndex);
      scrollToMessage(results[newIndex].id);
    },
    [totalResults, results, scrollToMessage]
  );

  const handlePrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const handleNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.replace(pathname);
        onClose();
        return;
      }
      if (e.key === 'Enter' && totalResults > 0) {
        if (e.shiftKey) {
          handlePrev();
        } else {
          handleNext();
        }
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handlePrev, handleNext, totalResults]);

  const showDropdown = debouncedQuery.length > 0;

  return (
    <div className={styles.container}>
      {/* Search Bar */}
      <div className={styles.bar}>
        <div className={styles.inputWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="ค้นหาข้อความในแชท..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Result counter */}
        {debouncedQuery.length > 0 && !isFetching && (
          <span className={`${styles.counter} ${totalResults === 0 ? styles.counterEmpty : ''}`}>
            {totalResults > 0 ? `${activeIndex + 1}/${totalResults}` : '0'}
          </span>
        )}
        {isFetching && (
          <span className={`${styles.counter} ${styles.counterEmpty}`}>…</span>
        )}

        {/* Navigation arrows */}
        <Tooltip content="ผลลัพธ์ก่อนหน้า (Shift+Enter)">
          <button
            className={styles.navBtn}
            onClick={handlePrev}
            disabled={totalResults === 0}
            type="button"
          >
            <ChevronUp size={16} />
          </button>
        </Tooltip>
        <Tooltip content="ผลลัพธ์ถัดไป (Enter)">
          <button
            className={styles.navBtn}
            onClick={handleNext}
            disabled={totalResults === 0}
            type="button"
          >
            <ChevronDown size={16} />
          </button>
        </Tooltip>

        <div className={styles.divider} />

        <Tooltip content="ปิดค้นหา (Esc)">
          <button
            className={styles.closeBtn}
            onClick={() => {
              router.replace(pathname);
              onClose();
            }}
            type="button"
          >
            <X size={16} />
          </button>
        </Tooltip>
      </div>

      {/* Results Dropdown */}
      {showDropdown && (
        <div className={styles.dropdown}>
          {isFetching && (
            <div className={styles.meta}>
              <Search size={20} className={styles.metaIcon} />
              <span>กำลังค้นหา...</span>
            </div>
          )}

          {!isFetching && totalResults === 0 && (
            <div className={styles.meta}>
              <Search size={20} className={styles.metaIcon} />
              <span>ไม่พบข้อความ &quot;{debouncedQuery}&quot;</span>
            </div>
          )}

          {!isFetching && results.map((msg, idx) => {
            const isOutbound = msg.source === 'OUTBOUND';
            const senderName = isOutbound ? (msg.sentByName || oaName || 'Admin') : contactName;
            const initial = senderName.charAt(0).toUpperCase();
            const isActive = idx === activeIndex;

            return (
              <button
                key={msg.id}
                className={`${styles.resultItem} ${isActive ? styles.resultItemActive : ''}`}
                onClick={() => {
                  setActiveIndex(idx);
                  scrollToMessage(msg.id);
                }}
              >
                {/* Mini avatar */}
                <div className={styles.resultAvatar}>
                  {!isOutbound && contactAvatar ? (
                    <img src={contactAvatar} alt="" className={styles.resultAvatarImg} />
                  ) : isOutbound && (msg as any).sentByAdmin?.pictureUrl ? (
                    <img src={(msg as any).sentByAdmin.pictureUrl} alt="" className={styles.resultAvatarImg} />
                  ) : (
                    <div
                      className={`${styles.resultAvatarFallback} ${
                        isOutbound ? styles.resultAvatarAdmin : styles.resultAvatarUser
                      }`}
                    >
                      {senderName.replace(/^[^a-zA-Z0-9\u0e01-\u0e59]+/, '').charAt(0).toUpperCase() || 'A'}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className={styles.resultContent}>
                  <div className={styles.resultHeader}>
                    <span className={styles.resultName}>{senderName}</span>
                    <span className={styles.resultTime}>
                      {formatShortTime(new Date(msg.createdAt))}
                    </span>
                  </div>
                  <p className={styles.resultText}>
                    {msg.textContent
                      ? highlightText(msg.textContent, debouncedQuery)
                      : `[${msg.type}]`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
