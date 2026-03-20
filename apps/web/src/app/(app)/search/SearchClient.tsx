'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search as SearchIcon,
  MessageCircle,
  User,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useDebounce } from '@/hooks/useDebounce';
import { EmptyState } from '@/components/ui';
import { useWorkspace } from '@/hooks/useWorkspace';
import { NoChannelAccess } from '@/components/ui/NoChannelAccess';
import styles from './page.module.css';

type Scope = 'all' | 'contacts' | 'messages';

/**
 * Formats timestamp for display.
 */
function formatRelativeTime(isoStr: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'เมื่อสักครู่';
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  if (diffHour < 24) return `${diffHour} ชม.ที่แล้ว`;
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;

  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d.getDate()} ${monthNames[d.getMonth()]} ${hh}:${mm}`;
}

/**
 * Highlight matched text with <mark>.
 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className={styles.highlight}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const SCOPE_TABS: { key: Scope; label: string; icon: typeof Layers }[] = [
  { key: 'all', label: 'ทั้งหมด', icon: Layers },
  { key: 'contacts', label: 'ผู้ติดต่อ', icon: User },
  { key: 'messages', label: 'ข้อความ', icon: MessageCircle },
];

export default function SearchClient() {
  const router = useRouter();
  const { accountId, hasAccess } = useWorkspace();

  if (!hasAccess) return <NoChannelAccess />;
  const [searchText, setSearchText] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const debouncedSearch = useDebounce(searchText, 400);

  const { data, isLoading } = trpc.search.unifiedSearch.useQuery(
    {
      query: debouncedSearch,
      limit: 40,
      lineAccountId: accountId || undefined,
      scope,
    },
    { enabled: debouncedSearch.length >= 1 }
  );

  const results = useMemo(() => data?.items ?? [], [data]);

  // Separate contacts and messages for section headers
  const contacts = useMemo(() => results.filter((r) => r.type === 'contact'), [results]);
  const messages = useMemo(() => results.filter((r) => r.type === 'message'), [results]);

  const handleClickResult = useCallback(
    (item: (typeof results)[0]) => {
      if (item.conversationId) {
        // For messages, jump directly to the message with highlight
        if (item.type === 'message') {
          router.push(`/inbox/${item.conversationId}?highlight=${item.id}&q=${encodeURIComponent(debouncedSearch)}`);
        } else {
          router.push(`/inbox/${item.conversationId}`);
        }
      } else if (item.contactId) {
        router.push(`/contacts?id=${item.contactId}`);
      }
    },
    [router, debouncedSearch]
  );

  const totalContacts = contacts.length;
  const totalMessages = messages.length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <SearchIcon size={22} />
          ค้นหา
        </h1>
      </div>

      {/* Search */}
      <div className={styles.searchBar}>
        <div className={styles.searchInputWrap}>
          <SearchIcon className={styles.searchIcon} size={18} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="ค้นหาผู้ติดต่อ หรือข้อความ..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            autoFocus
          />
          {searchText && (
            <button
              className={styles.searchClear}
              onClick={() => setSearchText('')}
              type="button"
            >
              ×
            </button>
          )}
        </div>

        {/* Scope Tabs */}
        <div className={styles.scopeTabs}>
          {SCOPE_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.scopeTab} ${scope === tab.key ? styles.scopeTabActive : ''}`}
              onClick={() => setScope(tab.key)}
              type="button"
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className={styles.resultList}>
        {!debouncedSearch ? (
          <div className={styles.emptySearch}>
            <SearchIcon size={40} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>ค้นหาทุกอย่าง</p>
            <p className={styles.emptyDesc}>ค้นหาผู้ติดต่อหรือข้อความในทุกการสนทนา</p>
          </div>
        ) : isLoading ? (
          <div className={styles.loading}>กำลังค้นหา...</div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={SearchIcon}
            title="ไม่พบผลลัพธ์"
            description={`ไม่พบผลลัพธ์ที่ตรงกับ "${debouncedSearch}"`}
          />
        ) : (
          <>
            {/* Stats */}
            <div className={styles.resultCount}>
              พบ {results.length} ผลลัพธ์
              {scope === 'all' && totalContacts > 0 && totalMessages > 0 && (
                <span className={styles.resultCountDetail}>
                  {' '}— {totalContacts} ผู้ติดต่อ, {totalMessages} ข้อความ
                </span>
              )}
            </div>

            {/* Contacts Section */}
            {(scope === 'all' || scope === 'contacts') && contacts.length > 0 && (
              <>
                {scope === 'all' && (
                  <div className={styles.sectionHeader}>
                    <User size={14} />
                    ผู้ติดต่อ
                    <span className={styles.sectionCount}>{totalContacts}</span>
                  </div>
                )}
                {contacts.map((item) => (
                  <button
                    key={`c-${item.id}`}
                    className={styles.resultItem}
                    onClick={() => handleClickResult(item)}
                    type="button"
                  >
                    <div className={styles.resultAvatar}>
                      {item.pictureUrl ? (
                        <img src={item.pictureUrl} alt="" className={styles.resultAvatarImg} />
                      ) : (
                        <div className={`${styles.resultAvatarFallback} ${styles.resultAvatarContact}`}>
                          {item.title.replace(/^[^a-zA-Z0-9\u0e01-\u0e59]+/, '').charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div className={styles.resultInfo}>
                      <div className={styles.resultTop}>
                        <span className={styles.resultName}>
                          {highlightText(item.title, debouncedSearch)}
                        </span>
                        {item.timestamp && (
                          <span className={styles.resultTime}>
                            {formatRelativeTime(item.timestamp)}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <div className={styles.resultText}>
                          <MessageCircle size={12} className={styles.resultMsgIcon} />
                          <span className={styles.resultSnippet}>{item.subtitle}</span>
                        </div>
                      )}
                    </div>
                    <ArrowRight size={14} className={styles.resultArrow} />
                  </button>
                ))}
              </>
            )}

            {/* Messages Section */}
            {(scope === 'all' || scope === 'messages') && messages.length > 0 && (
              <>
                {scope === 'all' && (
                  <div className={styles.sectionHeader}>
                    <MessageCircle size={14} />
                    ข้อความ
                    <span className={styles.sectionCount}>{totalMessages}</span>
                  </div>
                )}
                {messages.map((item) => {
                  const isOutbound = item.snippet && item.title !== item.snippet;
                  return (
                    <button
                      key={`m-${item.id}`}
                      className={styles.resultItem}
                      onClick={() => handleClickResult(item)}
                      type="button"
                    >
                      <div className={styles.resultAvatar}>
                        {item.pictureUrl ? (
                          <img src={item.pictureUrl} alt="" className={styles.resultAvatarImg} />
                        ) : (
                          <div className={`${styles.resultAvatarFallback} ${styles.resultAvatarMessage}`}>
                            {item.title.replace(/^[^a-zA-Z0-9\u0e01-\u0e59]+/, '').charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      <div className={styles.resultInfo}>
                        <div className={styles.resultTop}>
                          <span className={styles.resultName}>
                            {item.title}
                          </span>
                          {item.timestamp && (
                            <span className={styles.resultTime}>
                              {formatRelativeTime(item.timestamp)}
                            </span>
                          )}
                        </div>
                        <div className={styles.resultText}>
                          <MessageCircle size={12} className={styles.resultMsgIcon} />
                          <span className={styles.resultSnippet}>
                            {highlightText(item.snippet || '', debouncedSearch)}
                          </span>
                        </div>
                        {item.matchedField && (
                          <span className={styles.resultBadge}>{item.matchedField}</span>
                        )}
                      </div>
                      <ArrowRight size={14} className={styles.resultArrow} />
                    </button>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
