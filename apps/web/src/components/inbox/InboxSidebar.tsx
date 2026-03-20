'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Inbox as InboxIcon, Tag, Bookmark, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Tooltip } from '@/components/ui/Tooltip';
import { th } from '@/lib/thai';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useDebounce } from '@/hooks/useDebounce';
import { EmptyState } from '@/components/ui';
import { ConversationItem } from '@/components/inbox/ConversationItem';
import styles from './InboxSidebar.module.css';

export function InboxSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { accountId } = useWorkspace();
  const [filter, setFilter] = useState<'all' | 'unread' | 'archived'>('all');
  const [searchText, setSearchText] = useState('');
  const [groupByOa, setGroupByOa] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const debouncedSearch = useDebounce(searchText, 300);

  // Fetch available tags & labels for filter dropdown
  const { data: tags } = trpc.tags.list.useQuery(
    { lineAccountId: accountId ?? undefined },
    { staleTime: 60000 }
  );
  const { data: labels } = trpc.labels.list.useQuery(
    { lineAccountId: accountId ?? undefined },
    { staleTime: 60000 }
  );

  const hasActiveFilter = !!selectedTagId || !!selectedLabelId;

  const { data, isLoading, fetchNextPage, hasNextPage } =
    trpc.conversations.list.useInfiniteQuery(
      {
        limit: 20,
        filter,
        lineAccountId: accountId ?? undefined,
        tagId: selectedTagId ?? undefined,
        labelId: selectedLabelId ?? undefined,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const allConversations = data?.pages.flatMap((p) => p.items) ?? [];

  // Server-side search logic
  const { data: searchData, isFetching: isSearching } = trpc.search.unifiedSearch.useQuery(
    { query: debouncedSearch, limit: 30, lineAccountId: accountId ?? undefined },
    { enabled: debouncedSearch.trim().length > 0, staleTime: 30000 }
  );

  const searchResults = searchData?.items ?? [];

  const conversations = useMemo(() => {
    return allConversations;
  }, [allConversations]);

  const groupedConversations = useMemo(() => {
    if (!groupByOa || accountId) return null;
    
    const groups: Map<string, { account: { id: string; name: string; pic: string | null }; items: typeof conversations }> = new Map();
    const unknownGroup = { account: { id: 'unknown', name: 'ระบบ', pic: null }, items: [] as typeof conversations };

    conversations.forEach((conv) => {
      if (!conv.lineAccount) {
        unknownGroup.items.push(conv);
        return;
      }
      const accId = conv.lineAccount.id;
      if (!groups.has(accId)) {
        groups.set(accId, {
          account: {
            id: accId,
            name: conv.lineAccount.displayName || 'LINE OA',
            pic: conv.lineAccount.pictureUrl,
          },
          items: [],
        });
      }
      groups.get(accId)!.items.push(conv);
    });

    const result = Array.from(groups.values());
    if (unknownGroup.items.length > 0) result.push(unknownGroup);
    return result;
  }, [conversations, groupByOa, accountId]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop - clientHeight < 200 && hasNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage]
  );

  const handleConversationClick = (id: string, paramsStr?: string) => {
    router.push(`/inbox/${id}${paramsStr ? `?${paramsStr}` : ''}`);
  };

  // Get selected tag/label details for display
  const selectedTag = selectedTagId ? tags?.find(t => t.id === selectedTagId) : null;
  const selectedLabel = selectedLabelId ? labels?.find(l => l.id === selectedLabelId) : null;

  return (
    <div className={styles.sidebar}>
      {/* Search Bar */}
      <div className={styles.searchBar}>
        <div className={styles.searchInputWrap}>
          <Search className={styles.searchIcon} size={16} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder={th.search.placeholder}
            aria-label={th.search.placeholder}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          {searchText && (
            <button
              className={styles.searchClear}
              onClick={() => setSearchText('')}
              type="button"
              aria-label="ล้างการค้นหา"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterTabs}>
        {(['all', 'unread', 'archived'] as const).map((f) => (
          <button
            key={f}
            className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ''}`}
            onClick={() => setFilter(f)}
            type="button"
          >
            {f === 'all' ? 'ทั้งหมด' : f === 'unread' ? 'ยังไม่อ่าน' : 'จัดเก็บ'}
          </button>
        ))}

        {/* Tag/Label Filter Toggle */}
        <div style={{ marginLeft: 'auto' }}>
          <Tooltip content="กรองด้วยแท็ก / ป้ายกำกับ">
            <button
              className={`${styles.filterToggleBtn} ${hasActiveFilter ? styles.filterToggleBtnActive : ''}`}
              onClick={() => setShowFilters(!showFilters)}
              type="button"
            >
              <Tag size={13} />
              {hasActiveFilter && <span className={styles.filterDot} />}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Tag/Label Filter Row */}
      {showFilters && (
        <div className={styles.tagFilterRow}>
          {/* Active filters display */}
          {hasActiveFilter && (
            <div className={styles.activeFilters}>
              {selectedTag && (
                <span
                  className={styles.activeFilterChip}
                  style={{ '--chip-color': selectedTag.color } as React.CSSProperties}
                >
                  <span className={styles.activeFilterDot} style={{ backgroundColor: selectedTag.color }} />
                  {selectedTag.name}
                  <button
                    className={styles.activeFilterClear}
                    onClick={() => setSelectedTagId(null)}
                    type="button"
                  >
                    <X size={11} />
                  </button>
                </span>
              )}
              {selectedLabel && (
                <span
                  className={styles.activeFilterChip}
                  style={{ '--chip-color': selectedLabel.color } as React.CSSProperties}
                >
                  <Bookmark size={11} />
                  {selectedLabel.name}
                  <button
                    className={styles.activeFilterClear}
                    onClick={() => setSelectedLabelId(null)}
                    type="button"
                  >
                    <X size={11} />
                  </button>
                </span>
              )}
              <button
                className={styles.clearAllFilters}
                onClick={() => { setSelectedTagId(null); setSelectedLabelId(null); }}
                type="button"
              >
                ล้างทั้งหมด
              </button>
            </div>
          )}

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className={styles.filterSection}>
              <span className={styles.filterSectionLabel}>
                <Tag size={12} /> แท็ก
              </span>
              <div className={styles.filterPills}>
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    className={`${styles.filterPill} ${selectedTagId === tag.id ? styles.filterPillActive : ''}`}
                    style={{ '--pill-color': tag.color } as React.CSSProperties}
                    onClick={() => setSelectedTagId(selectedTagId === tag.id ? null : tag.id)}
                    type="button"
                  >
                    <span className={styles.filterPillDot} style={{ backgroundColor: tag.color }} />
                    {tag.name}
                    {'_count' in tag && (
                      <span className={styles.filterPillCount}>{(tag._count as { contacts: number }).contacts}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Labels */}
          {labels && labels.length > 0 && (
            <div className={styles.filterSection}>
              <span className={styles.filterSectionLabel}>
                <Bookmark size={12} /> ป้ายกำกับ
              </span>
              <div className={styles.filterPills}>
                {labels.map((label) => (
                  <button
                    key={label.id}
                    className={`${styles.filterPill} ${selectedLabelId === label.id ? styles.filterPillActive : ''}`}
                    style={{ '--pill-color': label.color } as React.CSSProperties}
                    onClick={() => setSelectedLabelId(selectedLabelId === label.id ? null : label.id)}
                    type="button"
                  >
                    <Bookmark size={11} style={{ color: label.color }} />
                    {label.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Modes (Only when no specific account is selected) */}
      {!accountId && conversations.length > 0 && (
        <div className={styles.viewModes}>
          <button
            className={`${styles.viewModeBtn} ${!groupByOa ? styles.viewModeBtnActive : ''}`}
            onClick={() => setGroupByOa(false)}
            type="button"
          >
            รวมแชททั้งหมด
          </button>
          <button
            className={`${styles.viewModeBtn} ${groupByOa ? styles.viewModeBtnActive : ''}`}
            onClick={() => setGroupByOa(true)}
            type="button"
          >
            แยกตามบัญชี OA
          </button>
        </div>
      )}

      {/* Conversation List / Search Results */}
      <div className={styles.conversationList} onScroll={handleScroll}>
        {(isLoading || isSearching) ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--color-border-light)' }}>
                <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div className="skeleton" style={{ width: '40%', height: '16px' }} />
                    <div className="skeleton" style={{ width: '30px', height: '12px' }} />
                  </div>
                  <div className="skeleton" style={{ width: '70%', height: '14px' }} />
                </div>
              </div>
            ))}
          </div>
        ) : debouncedSearch.trim() ? (
          searchResults.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title="ไม่พบผลลัพธ์"
              description={`ไม่พบข้อความหรือผู้ติดต่อสำหรับคำว่า "${debouncedSearch}"`}
            />
          ) : (
            searchResults.map((result) => {
              if (!result.conversationId) return null;
              const typeBadge = result.type === 'message' ? '💬 ' : '👤 ';
              const displayText = result.type === 'message' 
                ? (result.snippet || result.subtitle || '')
                : (result.subtitle || result.snippet || '');
              return (
                <ConversationItem
                  key={result.id + result.type}
                  id={result.conversationId}
                  contactName={result.title}
                  contactAvatar={result.pictureUrl || result.avatarR2Key}
                  lastMessage={typeBadge + displayText}
                  lastMessageAt={result.timestamp ? new Date(result.timestamp) : new Date()}
                  lastMessageSource="INBOUND"
                  lastMessageType="TEXT"
                  unreadCount={0}
                  isPinned={false}
                  isActive={pathname === `/inbox/${result.conversationId}`}
                  tags={[]}
                  onClick={() => {
                    const sp = new URLSearchParams();
                    if (result.type === 'message') {
                      sp.set('msgId', String(result.id));
                      sp.set('q', debouncedSearch);
                    } else if (result.type === 'contact') {
                      sp.set('q', debouncedSearch);
                    }
                    handleConversationClick(result.conversationId!, sp.toString());
                  }}
                />
              );
            })
          )
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            title={hasActiveFilter ? 'ไม่พบแชทที่ตรงกับตัวกรอง' : th.inbox.emptyTitle}
            description={hasActiveFilter ? 'ลองเปลี่ยนแท็กหรือป้ายกำกับที่กรอง' : th.inbox.emptyDescription}
          />
        ) : groupedConversations ? (
          groupedConversations.map((group) => (
            <div key={group.account.id} className={styles.groupContainer}>
              <div className={styles.groupHeader}>
                {group.account.pic && (
                  <img src={group.account.pic} alt="" className={styles.groupHeaderAvatar} />
                )}
                <span className={styles.groupHeaderName}>{group.account.name}</span>
                <span className={styles.groupHeaderBadge}>{group.items.length}</span>
              </div>
              <div className={styles.groupList}>
                {group.items.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    id={conv.id}
                    contactName={conv.contact?.displayName ?? 'Unknown'}
                    contactAvatar={conv.contact?.avatarUrl}
                    lastMessage={conv.lastMessageText ?? ''}
                    lastMessageAt={conv.lastMessageAt ?? new Date()}
                    lastMessageSource={conv.lastMessageSource ?? 'INBOUND'}
                    lastMessageType={conv.lastMessageType ?? 'TEXT'}
                    unreadCount={conv.unreadCount}
                    isPinned={conv.isPinned}
                    isActive={pathname === `/inbox/${conv.id}`}
                    tags={conv.tags}
                    hideOaBadge={true}
                    contactStatus={
                      !conv.contact?.isFollowing ? 'blocked'
                      : conv.contact?.unfollowedAt ? 'refollow'
                      : 'active'
                    }
                    onClick={() => handleConversationClick(conv.id)}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              id={conv.id}
              contactName={conv.contact?.displayName ?? 'Unknown'}
              contactAvatar={conv.contact?.avatarUrl}
              lastMessage={conv.lastMessageText ?? ''}
              lastMessageAt={conv.lastMessageAt ?? new Date()}
              lastMessageSource={conv.lastMessageSource ?? 'INBOUND'}
              lastMessageType={conv.lastMessageType ?? 'TEXT'}
              unreadCount={conv.unreadCount}
              isPinned={conv.isPinned}
              isActive={pathname === `/inbox/${conv.id}`}
              tags={conv.tags}
              lineAccount={!accountId && conv.lineAccount ? {
                id: conv.lineAccount.id,
                displayName: conv.lineAccount.displayName ?? 'LINE OA',
                pictureUrl: conv.lineAccount.pictureUrl
              } : undefined}
              contactStatus={
                !conv.contact?.isFollowing ? 'blocked'
                : conv.contact?.unfollowedAt ? 'refollow'
                : 'active'
              }
              onClick={() => handleConversationClick(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
