'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatSearchBar } from '@/components/chat/ChatSearchBar';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { Composer, type LineEmoji } from '@/components/chat/Composer';
import { ImageGrid } from '@/components/chat/ImageGrid';
import { RightPanel } from '@/components/chat/RightPanel';
import { EmptyState } from '@/components/ui';
import { groupMessages, type MessageItem, type GroupedItem } from '@/lib/groupMessages';
import styles from './page.module.css';

/**
 * Format date for separator labels.
 * - Today => "วันนี้"
 * - Yesterday => "เมื่อวาน"
 * - This year => "วันจันทร์ 17 มี.ค."
 * - Older => "17 มี.ค. 2568" (พ.ศ.)
 */
function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = today.getTime() - target.getTime();
  const dayMs = 86_400_000;

  if (diff < dayMs) return 'วันนี้';
  if (diff < dayMs * 2) return 'เมื่อวาน';

  const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const day = dayNames[date.getDay()];
  const d = date.getDate();
  const m = monthNames[date.getMonth()];

  if (date.getFullYear() === now.getFullYear()) {
    return `${day} ${d} ${m}`;
  }
  return `${d} ${m} ${date.getFullYear() + 543}`; // พ.ศ.
}

function getDateKey(date: Date | string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Rendered element: date separator, single message, or image group */
interface RenderElement {
  type: 'date' | 'single' | 'image-group';
  key: string;
  dateLabel?: string;
  msg?: MessageItem;
  group?: GroupedItem;
}

/**
 * Chat detail page — shows message thread for a conversation.
 */
export default function ChatPage() {
  const params = useParams<{ conversationId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationId = params.conversationId;
  const highlightMsgId = searchParams.get('msgId');
  const highlightQuery = searchParams.get('q');
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevItemCountRef = useRef(0);
  const prevLatestMsgIdRef = useRef<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { hasAccess } = useWorkspace();

  // Fetch conversation info
  const { data: conversation, isLoading: convLoading } = trpc.conversations.get.useQuery(
    { id: conversationId },
    { enabled: !!conversationId }
  );

  // Fetch messages (infinite scroll — reversed: oldest first)
  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.messages.list.useInfiniteQuery(
    { conversationId, limit: 30 },
    {
      enabled: !!conversationId,
      getNextPageParam: (last: { nextCursor?: string }) => last.nextCursor,
    }
  );

  // Mark as read only when tab is visible (admin is actively looking)
  const markReadMutation = trpc.conversations.markRead.useMutation();
  useEffect(() => {
    const shouldMarkRead = () =>
      conversationId &&
      conversation &&
      conversation.unreadCount > 0 &&
      document.visibilityState === 'visible';

    // Mark on mount / data change if tab is active
    if (shouldMarkRead()) {
      markReadMutation.mutate({ id: conversationId });
    }

    // When admin switches back to this tab, mark as read
    const onVisibilityChange = () => {
      if (shouldMarkRead()) {
        markReadMutation.mutate({ id: conversationId });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, conversation?.unreadCount]);

  const allMessages = useMemo(() => {
    if (!messagesData?.pages) return [];
    // pages[0] is the newest batch, pages[1] is older.
    // Each page comes sorted oldest-to-newest internally.
    // To make the full list oldest-to-newest overall, map pages from last to first.
    const reversedPages = [...messagesData.pages].reverse();
    return reversedPages.flatMap((p: { items: MessageItem[] }) => p.items);
  }, [messagesData]);

  // Search is handled by ChatSearchBar component

  // Group messages
  const groupedItems = useMemo(() => groupMessages(allMessages), [allMessages]);

  const renderedElements = useMemo(() => {
    const elements: RenderElement[] = [];
    let lastDateKey = '';

    for (const group of groupedItems) {
      const firstMsg = group.messages[0];
      const dk = getDateKey(firstMsg.createdAt);

      if (dk !== lastDateKey) {
        lastDateKey = dk;
        elements.push({
          type: 'date',
          key: `date-${dk}`,
          dateLabel: formatDateLabel(new Date(firstMsg.createdAt)),
        });
      }

      if (group.type === 'image-group') {
        elements.push({
          type: 'image-group',
          key: `imggrp-${group.messages.map((m) => m.id).join('-')}`,
          group,
        });
      } else {
        elements.push({
          type: 'single',
          key: firstMsg.id,
          msg: firstMsg,
        });
      }
    }

    return elements;
  }, [groupedItems]);

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'smooth') => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
        }
      }, 0);
    });
  }, []);

  // Scroll to bottom on first load / new messages at bottom
  // Skip if we have a highlight target (jump-to-message takes priority)
  useEffect(() => {
    if (allMessages.length === 0) return;
    if (highlightMsgId) {
      // Don't scroll to bottom when a message is targeted via search
      prevItemCountRef.current = allMessages.length;
      prevLatestMsgIdRef.current = allMessages[allMessages.length - 1].id;
      return;
    }

    const latestMsgId = allMessages[allMessages.length - 1].id;
    const isInitialLoad = prevItemCountRef.current === 0;
    const isNewMessageAtBottom = prevLatestMsgIdRef.current !== latestMsgId;

    if (isInitialLoad || isNewMessageAtBottom) {
      scrollToBottom(isInitialLoad ? 'auto' : 'smooth');
    }

    prevLatestMsgIdRef.current = latestMsgId;
    prevItemCountRef.current = allMessages.length;
  }, [allMessages, scrollToBottom, highlightMsgId]);

  // Handle jump-to-message and highlighting
  useEffect(() => {
    if (!highlightMsgId) return;

    // Check if element is in the DOM
    const targetEl = document.getElementById(`msg-${highlightMsgId}`);
    if (targetEl) {
      // A small delay ensures images and DOM paint have settled
      setTimeout(() => {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Force animation restart by removing class, triggering reflow, then re-adding
        targetEl.classList.remove('search-highlight-flash');
        void targetEl.offsetWidth; // Force reflow to restart CSS animation
        targetEl.classList.add('search-highlight-flash');
        setTimeout(() => targetEl.classList.remove('search-highlight-flash'), 3200);
      }, 150);
      return;
    }

    // If not found and we have more history to load, auto-fetch until we find it
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [highlightMsgId, allMessages.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Load older messages on scroll to top
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 300 && hasNextPage && !isFetchingNextPage) {
      const prevHeight = el.scrollHeight;
      fetchNextPage().then(() => {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevHeight;
        });
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const utils = trpc.useUtils();

  // Send mutators with optimistic UI updates
  const sendMutation = trpc.messages.send.useMutation({
    onMutate: async (newMsg) => {
      await utils.messages.list.cancel({ conversationId });
      const previousMessages = utils.messages.list.getInfiniteData({ conversationId, limit: 30 });
      utils.messages.list.setInfiniteData({ conversationId, limit: 30 }, (old) => {
        if (!old) return old;
        const fakeMessage = {
          id: `temp-${Date.now()}`,
          source: 'OUTBOUND' as const,
          type: 'TEXT',
          textContent: newMsg.text,
          createdAt: new Date(),
          deliveryStatus: 'PENDING',
        } as MessageItem;
        const newPages = [...old.pages];
        if (newPages.length > 0) {
          newPages[0] = {
            ...newPages[0],
            items: [...newPages[0].items, fakeMessage] as any,
          };
        }
        return { ...old, pages: newPages };
      });
      return { previousMessages };
    },
    onError: (err, newMsg, context) => {
      if (context?.previousMessages) {
        utils.messages.list.setInfiniteData({ conversationId, limit: 30 }, context.previousMessages);
      }
    },
    onSettled: () => {
      utils.messages.list.invalidate({ conversationId });
      utils.conversations.list.invalidate();
      // Claim happened on backend — refresh notification state
      utils.notifications.list.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  const sendStickerMutation = trpc.messages.sendSticker.useMutation({
    onMutate: async (newMsg) => {
      await utils.messages.list.cancel({ conversationId });
      const previousMessages = utils.messages.list.getInfiniteData({ conversationId, limit: 30 });
      utils.messages.list.setInfiniteData({ conversationId, limit: 30 }, (old) => {
        if (!old) return old;
        const fakeMessage = {
          id: `temp-${Date.now()}`,
          source: 'OUTBOUND' as const,
          type: 'STICKER',
          stickerPackageId: String(newMsg.packageId),
          stickerId: String(newMsg.stickerId),
          createdAt: new Date(),
          deliveryStatus: 'PENDING',
        } as MessageItem;
        const newPages = [...old.pages];
        if (newPages.length > 0) {
          newPages[0] = {
            ...newPages[0],
            items: [...newPages[0].items, fakeMessage] as any,
          };
        }
        return { ...old, pages: newPages };
      });
      return { previousMessages };
    },
    onError: (err, newMsg, context) => {
      if (context?.previousMessages) {
        utils.messages.list.setInfiniteData({ conversationId, limit: 30 }, context.previousMessages);
      }
    },
    onSettled: () => {
      utils.messages.list.invalidate({ conversationId });
      utils.conversations.list.invalidate();
      // Claim happened on backend — refresh notification state
      utils.notifications.list.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  const handleSend = (text: string, emojis?: LineEmoji[]) => {
    // Eager scroll as soon as user hits send (Composer shrinks)
    scrollToBottom('smooth');

    sendMutation.mutate(
      { conversationId, text, emojis },
      {
        onSuccess: () => {
          scrollToBottom('smooth');
        },
      }
    );
  };

  const handleSendSticker = (packageId: number, stickerId: number) => {
    scrollToBottom('smooth');
    sendStickerMutation.mutate(
      { conversationId, packageId, stickerId },
      {
        onSuccess: () => {
          scrollToBottom('smooth');
        },
      }
    );
  };

  const contact = conversation?.contact;

  // Access revoked → silently go back to inbox (feels like a refresh)
  const accessDenied = !hasAccess || (!convLoading && !conversation);

  useEffect(() => {
    if (accessDenied) {
      router.replace('/inbox');
    }
  }, [accessDenied, router]);

  if (accessDenied) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <EmptyState
          icon={MessageCircle}
          title="LINE OA Admin"
          description="เลือกช่องแชทซ้ายมือเพื่อเริ่มต้นการสนทนา"
        />
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
    <div className={styles.chatPage}>
      <ChatHeader
        conversationId={conversationId}
        contactName={contact?.displayName ?? 'กำลังโหลด...'}
        contactAvatar={contact?.avatarUrl}
        statusMessage={contact?.statusMessage}
        isPinned={conversation?.isPinned ?? false}
        isArchived={conversation?.isArchived ?? false}
        labels={conversation?.labels ?? []}
        onTogglePanel={() => setPanelOpen((v) => !v)}
        onToggleSearch={() => setSearchOpen((v) => !v)}
      />

      {searchOpen && (
        <ChatSearchBar
          conversationId={conversationId}
          contactName={contact?.displayName ?? 'ผู้ใช้'}
          contactAvatar={contact?.avatarUrl}
          oaName={conversation?.lineAccountId ? 'LINE OA' : undefined}
          onClose={() => setSearchOpen(false)}
        />
      )}

      <div
        ref={scrollRef}
        className={styles.messages}
        onScroll={handleScroll}
      >
        {/* Beginning of conversation indicator */}
        {!hasNextPage && allMessages.length > 0 && !isFetchingNextPage && (
          <div className={styles.beginningIndicator}>
            <MessageCircle size={28} className={styles.beginningIcon} />
            <span className={styles.beginningText}>จุดเริ่มต้นการสนทนา</span>
            <span className={styles.beginningSubtext}>
              {contact?.displayName ?? 'ผู้ใช้'} เริ่มติดต่อเข้ามา
            </span>
          </div>
        )}

        {isFetchingNextPage && (
          <div className={styles.loadingOlder}>กำลังโหลดข้อความเก่า...</div>
        )}

        {renderedElements.map((el) => {
          if (el.type === 'date') {
            return (
              <div key={el.key} className={styles.dateSeparator}>
                <span className={styles.dateSeparatorLabel}>{el.dateLabel}</span>
              </div>
            );
          }

          if (el.type === 'image-group' && el.group) {
            return (
              <motion.div
                key={el.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ImageGrid
                  messages={el.group.messages}
                  source={el.group.messages[0].source}
                />
              </motion.div>
            );
          }

          // Single message
          const msg = el.msg!;
          return (
            <motion.div 
              key={el.key} 
              id={`msg-${msg.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChatBubble
                source={msg.source}
                type={msg.type}
                textContent={msg.textContent}
                metadata={msg.metadata}
                stickerPackageId={msg.stickerPackageId}
                stickerId={msg.stickerId}
                latitude={msg.latitude}
                longitude={msg.longitude}
                address={msg.address}
                createdAt={msg.createdAt}
                sentByName={msg.sentByName}
                sentByAvatarUrl={(msg as any).sentByAdmin?.pictureUrl ?? null}
                attachments={msg.attachments}
                highlightQuery={highlightQuery}
                isHighlighted={msg.id === highlightMsgId}
              />
            </motion.div>
          );
        })}

        {allMessages.length === 0 && !isFetchingNextPage && (
          <div className={styles.emptyState}>
            <p>ยังไม่มีข้อความ</p>
            <p>ส่งข้อความแรกเลย! 👋</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <Composer
        conversationId={conversationId}
        onSend={handleSend}
        onSendSticker={handleSendSticker}
        onUploadComplete={() => scrollToBottom('smooth')}
        disabled={contact?.isFollowing === false}
        blockedMessage={
          contact?.isFollowing === false
            ? 'ไม่สามารถส่งข้อความได้ เนื่องจากผู้ใช้เลิกติดตามบัญชีของคุณ'
            : null
        }
      />
    </div>

    {/* Right Panel */}
    <RightPanel
      conversationId={conversationId}
      contactId={conversation?.contactId ?? ''}
      contactName={contact?.displayName ?? ''}
      contactAvatar={contact?.avatarUrl}
      statusMessage={contact?.statusMessage}
      language={contact?.language}
      firstSeenAt={contact?.firstSeenAt}
      lastSeenAt={contact?.lastSeenAt}
      isFollowing={contact?.isFollowing}
      unfollowedAt={contact?.unfollowedAt}
      isOpen={panelOpen}
      onClose={() => setPanelOpen(false)}
    />
    </div>
  );
}
