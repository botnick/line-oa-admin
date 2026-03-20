'use client';

import { useState, useCallback } from 'react';
import {
  Users,
  Search,
  X,
  MessageCircle,
  Clock,
  Tag as TagIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { formatRelative } from '@/lib/dayjs';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ChannelFilter } from '@/components/shared/ChannelFilter';
import { NoChannelAccess } from '@/components/ui/NoChannelAccess';
import Link from 'next/link';
import styles from './page.module.css';

export default function ContactsClient() {
  const router = useRouter();
  const { accountId, hasAccess } = useWorkspace();

  if (!hasAccess) return <NoChannelAccess />;
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | undefined>();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.contacts.list.useInfiniteQuery(
      {
        limit: 30,
        search: search || undefined,
        lineAccountId: accountId || undefined,
        tagId: selectedTag,
      },
      {
        getNextPageParam: (last) => last.nextCursor,
      }
    );

  // Fetch tags for the filter
  const { data: tags } = trpc.tags.list.useQuery(
    accountId ? { lineAccountId: accountId } : undefined
  );

  const contacts = data?.pages.flatMap((p) => p.items) ?? [];
  const totalCount = data?.pages[0]?.totalCount ?? 0;

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (
        el.scrollHeight - el.scrollTop - el.clientHeight < 200 &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          <Users size={22} />
          รายชื่อผู้ติดต่อ
          {!isLoading && (
            <span className={styles.count}>{totalCount.toLocaleString()}</span>
          )}
        </h1>
        <Link
          href="/contacts/tags"
          className={styles.headerActionBtn}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'background 0.2s',
          }}
        >
          <TagIcon size={16} />
          จัดการแท็กและป้ายกำกับ
        </Link>
      </div>

      {/* Channel Filter */}
      <ChannelFilter />

      {/* Tag Filter */}
      {tags && tags.length > 0 && (
        <div className={styles.tagFilterWrap}>
          <button
            className={`${styles.tagFilterBtn} ${!selectedTag ? styles.active : ''}`}
            onClick={() => setSelectedTag(undefined)}
          >
            ทั้งหมด
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              className={`${styles.tagFilterBtn} ${selectedTag === tag.id ? styles.active : ''}`}
              onClick={() => setSelectedTag(selectedTag === tag.id ? undefined : tag.id)}
              style={{
                '--tag-color': tag.color,
              } as React.CSSProperties}
            >
              <span
                className={styles.tagDot}
                style={{ background: tag.color }}
              />
              {tag.name}
              {'_count' in tag && (tag as any)._count?.contacts > 0 && (
                <span className={styles.tagCount}>
                  {(tag as any)._count.contacts}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className={styles.searchBar}>
        <div className={styles.searchInputWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="ค้นหาชื่อผู้ติดต่อ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className={styles.searchClear}
              onClick={() => setSearch('')}
              type="button"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Contact List */}
      <div className={styles.list} onScroll={handleScroll}>
        {isLoading ? (
          <div className={styles.loading}>กำลังโหลด...</div>
        ) : contacts.length === 0 ? (
          <div className={styles.empty}>
            <Users size={48} strokeWidth={1} />
            <p>ไม่พบผู้ติดต่อ</p>
          </div>
        ) : (
          contacts.map((contact) => (
            <button
              key={contact.id}
              className={styles.contactItem}
              onClick={() => {
                // Navigate to inbox and open the conversation with this contact
                const convId = (contact as any).conversations?.[0]?.id;
                if (convId) {
                  router.push(`/inbox/${convId}`);
                }
              }}
              type="button"
            >
              {/* Avatar */}
              <div className={styles.avatar}>
                {contact.avatarUrl ? (
                  <img
                    src={contact.avatarUrl}
                    alt=""
                    className={styles.avatarImg}
                  />
                ) : (
                  <div className={styles.avatarFallback}>
                    {(contact.displayName || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className={styles.contactInfo}>
                <div className={styles.contactNameRow}>
                  <span className={styles.contactName}>
                    {contact.displayName || 'ไม่ทราบชื่อ'}
                  </span>
                  {contact.lineAccount && (
                    <span className={styles.oaBadge}>
                      {contact.lineAccount.pictureUrl && (
                        <img
                          src={contact.lineAccount.pictureUrl}
                          alt=""
                          className={styles.oaBadgeAvatar}
                        />
                      )}
                      {contact.lineAccount.displayName}
                    </span>
                  )}
                </div>
                {/* Tags */}
                {contact.tags && contact.tags.length > 0 && (
                  <div className={styles.tagRow}>
                    {contact.tags.slice(0, 3).map((tag: any) => (
                      <span
                        key={tag.id}
                        className={styles.tagPill}
                        style={{ '--tag-color': tag.color } as React.CSSProperties}
                      >
                        {tag.name}
                      </span>
                    ))}
                    {contact.tags.length > 3 && (
                      <span className={styles.tagMore}>
                        +{contact.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
                <span className={styles.contactMeta}>
                  <MessageCircle size={12} />
                  {contact._count?.conversations ?? 0} สนทนา
                  {contact.lastSeenAt && (
                    <>
                      <span className={styles.metaDivider}>·</span>
                      <Clock size={12} />
                      {formatRelative(contact.lastSeenAt)}
                    </>
                  )}
                </span>
              </div>

              {/* Right side */}
              <div className={styles.contactRight}>
                {contact.lastSeenAt && (
                  <span className={styles.lastSeen}>
                    {formatRelative(contact.lastSeenAt)}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
        {isFetchingNextPage && (
          <div className={styles.loading}>กำลังโหลดเพิ่ม...</div>
        )}
      </div>
    </div>
  );
}
