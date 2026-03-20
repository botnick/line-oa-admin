'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';

// ── Constants (hoisted outside component — zero per-render cost) ────────

/** Maximum SSE reconnection attempts before giving up */
const MAX_RETRIES = 10;

/** Max backoff delay in milliseconds (10 seconds) */
const MAX_DELAY_MS = 10_000;

/** Base delay in milliseconds for exponential backoff */
const BASE_DELAY_MS = 500;

/**
 * Jitter factor (0–1) added to exponential backoff delay.
 * Prevents thundering herd when many clients reconnect simultaneously.
 */
const JITTER_FACTOR = 0.3;

// ── Types ───────────────────────────────────────────────────────────────

interface SSEEventPayload {
  conversationId?: string;
  contactId?: string;
  targetAdminUserId?: string;
}

interface SSEEventData {
  type: string;
  payload?: SSEEventPayload;
}

/** Return type exposed to consumers of useLineSync */
export interface LineSyncStatus {
  /** Whether the SSE connection is currently open and receiving events */
  isConnected: boolean;
}

// ── Utilities ───────────────────────────────────────────────────────────

/**
 * Calculate reconnection delay with exponential backoff + jitter.
 * Jitter prevents the thundering herd problem when a server restarts
 * and all clients attempt to reconnect at the exact same time.
 *
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
function getBackoffDelay(attempt: number): number {
  const exponential = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
  const jitter = exponential * JITTER_FACTOR * Math.random();
  return exponential + jitter;
}

// ── Hook ────────────────────────────────────────────────────────────────

/**
 * SSE hook — subscribes to real-time sync events from Redis Pub/Sub.
 * Auto-reconnects with exponential backoff + jitter (max 10 retries, max ~39s delay).
 * Invalidates tRPC queries on relevant events so the UI stays up-to-date.
 *
 * Covers: messages, conversations, tags, labels, contacts, overview stats,
 * and channel access changes (realtime permission updates).
 *
 * @returns `LineSyncStatus` — connection state for UI indicators
 *
 * @example
 * ```tsx
 * function AppLayout({ children }) {
 *   const { isConnected } = useLineSync();
 *   return (
 *     <>
 *       {!isConnected && <ReconnectingBanner />}
 *       {children}
 *     </>
 *   );
 * }
 * ```
 */
export function useLineSync(): LineSyncStatus {
  const trpcContext = trpc.useUtils();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  // Refs for mutable values that should NOT trigger effect re-runs
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable refs — always point to the latest value without causing re-subscriptions.
  // This is the standard "useLatest" pattern to avoid stale closures in long-lived
  // event handlers while keeping the useEffect dependency array truly stable.
  const trpcRef = useRef(trpcContext);
  trpcRef.current = trpcContext;

  const qcRef = useRef(queryClient);
  qcRef.current = queryClient;

  // ── Invalidation helpers (memoized, stable identity) ───────────────

  /**
   * Invalidate ALL data queries except auth session.
   * Uses React Query's predicate-based invalidation which:
   *   1. Only marks queries as stale (preserves cache for instant display)
   *   2. Only triggers network refetch for currently mounted/active queries
   *   3. Skips `auth.*` to prevent accidental logout during permission changes
   */
  const invalidateAllDataQueries = useCallback(() => {
    qcRef.current.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey as unknown[];
        // tRPC keys → [['router','procedure'], { type: 'query', input: ... }]
        const trpcPath = Array.isArray(key[0]) ? key[0] : [];
        return trpcPath[0] !== 'auth';
      },
    });
  }, []);

  /**
   * Invalidate all overview queries using namespace-level key matching.
   * More scalable than listing each procedure individually — adding new
   * overview endpoints requires zero changes here.
   */
  const invalidateOverview = useCallback(() => {
    qcRef.current.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey as unknown[];
        const trpcPath = Array.isArray(key[0]) ? key[0] : [];
        return trpcPath[0] === 'overview';
      },
    });
  }, []);

  // ── SSE event handler (memoized, uses refs for latest context) ─────

  const handleEvent = useCallback((event: MessageEvent) => {
    let data: SSEEventData;
    try {
      data = JSON.parse(event.data);
    } catch {
      // Ignore parse errors (heartbeats, keep-alive pings)
      return;
    }

    const ctx = trpcRef.current;

    switch (data.type) {
      // ── Messages ──────────────────────────────────────────────────
      case 'NEW_MESSAGE': {
        const cid = data.payload?.conversationId;
        if (cid) {
          ctx.messages.list.invalidate({ conversationId: cid });
          ctx.conversations.get.invalidate({ id: cid });
        }
        ctx.conversations.list.invalidate();
        // Namespace-level invalidation: covers stats, timeSeries, heatmap, etc.
        invalidateOverview();
        // New messages may come from new/updated contacts
        ctx.contacts.list.invalidate();
        break;
      }

      case 'MESSAGE_UPDATED': {
        const cid = data.payload?.conversationId;
        ctx.messages.list.invalidate(cid ? { conversationId: cid } : undefined);
        break;
      }

      // ── Conversations ─────────────────────────────────────────────
      case 'CONVERSATION_UPDATED': {
        ctx.conversations.list.invalidate();
        const cid = data.payload?.conversationId;
        if (cid) {
          ctx.conversations.get.invalidate({ id: cid });
          ctx.notes.list.invalidate({ conversationId: cid });
        }
        // Only stats endpoint is affected by conversations
        ctx.overview.stats.invalidate();
        break;
      }

      // ── Tags & Labels ─────────────────────────────────────────────
      case 'TAG_UPDATED':
        ctx.tags.list.invalidate();
        ctx.contacts.get.invalidate();
        ctx.contacts.list.invalidate();
        ctx.conversations.list.invalidate();
        ctx.conversations.get.invalidate();
        break;

      case 'LABEL_UPDATED':
        ctx.labels.list.invalidate();
        ctx.conversations.list.invalidate();
        break;

      case 'CONTACT_UPDATED': {
        ctx.contacts.list.invalidate();
        const contactId = data.payload?.contactId;
        if (contactId) {
          ctx.contacts.get.invalidate({ id: contactId });
        }
        ctx.conversations.list.invalidate();
        ctx.conversations.get.invalidate();
        ctx.overview.stats.invalidate();
        break;
      }

      // ── Channel Access (permission changes) ───────────────────────
      case 'CHANNEL_ACCESS_UPDATED': {
        const me = ctx.auth.me.getData();
        const targetId = data.payload?.targetAdminUserId;

        if (!targetId || targetId === me?.id) {
          // Permissions changed for THIS admin — flush all data caches.
          // Auth is preserved to prevent accidental logout.
          invalidateAllDataQueries();
        } else {
          // Different admin's access changed — only refresh user list
          ctx.users.list.invalidate();
        }
        break;
      }

      // ── Notifications ───────────────────────────────────────────────
      case 'NEW_NOTIFICATION': {
        const adminId = data.payload?.targetAdminUserId;
        const me = ctx.auth.me.getData();
        if (!adminId || adminId === me?.id) {
          ctx.notifications.list.invalidate();
          ctx.notifications.getUnreadCount.invalidate();
        }
        break;
      }

      // ── Notification Updated (claim actions — shared state) ────────
      case 'NOTIFICATION_UPDATED': {
        // Claims are shared: all admins need to see the updated claim badge
        ctx.notifications.list.invalidate();
        ctx.notifications.getUnreadCount.invalidate();
        break;
      }

      // ── Contact Status Change (follow / unfollow / block) ──────────
      case 'CONTACT_STATUS_CHANGE': {
        const contactId = data.payload?.contactId;
        const conversationId = data.payload?.conversationId;
        ctx.contacts.list.invalidate();
        if (contactId) {
          ctx.contacts.get.invalidate({ id: contactId });
          ctx.contacts.followHistory.invalidate({ contactId });
        }
        ctx.conversations.list.invalidate();
        if (conversationId) ctx.conversations.get.invalidate({ id: conversationId });
        invalidateOverview();
        break;
      }
    }
  }, [invalidateAllDataQueries, invalidateOverview]);

  // ── SSE connection lifecycle ──────────────────────────────────────

  useEffect(() => {
    const connect = () => {
      // Tear down existing connection if any
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      const es = new EventSource('/api/sse');
      esRef.current = es;

      es.onopen = () => {
        retryRef.current = 0;
        setIsConnected(true);
        console.log('[useLineSync] SSE connected');
      };

      es.onmessage = handleEvent;

      es.onerror = () => {
        es.close();
        esRef.current = null;
        setIsConnected(false);

        if (retryRef.current < MAX_RETRIES) {
          const delay = getBackoffDelay(retryRef.current);
          retryRef.current++;
          console.warn(
            `[useLineSync] SSE disconnected, retrying in ${Math.round(delay)}ms ` +
            `(attempt ${retryRef.current}/${MAX_RETRIES})`,
          );
          timerRef.current = setTimeout(connect, delay);
        } else {
          console.error('[useLineSync] SSE max retries reached, giving up');
        }
      };
    };

    connect();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setIsConnected(false);
    };
  }, [handleEvent]);

  return { isConnected };
}
