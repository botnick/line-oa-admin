'use client';

import { useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import { useSocket, useSocketEvent } from '@/hooks/useSocket';

// ── Types ───────────────────────────────────────────────────────────────

interface SyncEventPayload {
  conversationId?: string;
  contactId?: string;
  targetAdminUserId?: string;
}

interface SyncEventData {
  type: string;
  payload?: SyncEventPayload;
}

/** Return type exposed to consumers of useLineSync */
export interface LineSyncStatus {
  isConnected: boolean;
}

// ── Hook ────────────────────────────────────────────────────────────────

/**
 * Socket.IO hook — subscribes to real-time sync events from Redis Pub/Sub.
 *
 * ROOT CAUSE FIX:
 *   The QueryClient has staleTime:5000 + refetchOnWindowFocus:false.
 *   `invalidateQueries` only marks queries as stale — it does NOT force
 *   an immediate refetch when those options are set.
 *
 *   Solution: Use `refetchQueries` with `type:'active'` which FORCES
 *   an immediate network request for all currently-mounted queries,
 *   bypassing staleTime entirely. This is the correct approach for
 *   real-time socket-driven updates.
 */
export function useLineSync(): LineSyncStatus {
  const trpcCtx = trpc.useUtils();
  const queryClient = useQueryClient();
  const { isConnected } = useSocket();

  const trpcRef = useRef(trpcCtx);
  trpcRef.current = trpcCtx;

  const qcRef = useRef(queryClient);
  qcRef.current = queryClient;

  // ── Force-refetch helpers ─────────────────────────────────────────────
  // Uses refetchQueries (not invalidateQueries) so that active queries
  // always get fresh data regardless of staleTime or refetchOnWindowFocus.
  // tRPC v11 query key shape: [['router', 'procedure'], { type, input, ... }]

  /** Refetch all active queries under a given tRPC router (e.g. 'conversations') */
  const refetchByRouter = useCallback((routerName: string) => {
    qcRef.current.refetchQueries({
      type: 'active',
      predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || !Array.isArray(key[0])) return false;
        const [path] = key as [string[], ...unknown[]];
        return path[0] === routerName;
      },
    });
  }, []);

  /** Refetch all active queries under a specific tRPC router+procedure */
  const refetchByProcedure = useCallback((routerName: string, procedure: string) => {
    qcRef.current.refetchQueries({
      type: 'active',
      predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || !Array.isArray(key[0])) return false;
        const [path] = key as [string[], ...unknown[]];
        return path[0] === routerName && path[1] === procedure;
      },
    });
  }, []);

  /** Refetch ALL active queries except auth (used for permission changes) */
  const refetchAll = useCallback(() => {
    qcRef.current.refetchQueries({
      type: 'active',
      predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || !Array.isArray(key[0])) return false;
        const [path] = key as [string[], ...unknown[]];
        return path[0] !== 'auth';
      },
    });
  }, []);

  // ── Main sync event handler ──────────────────────────────────────────

  const handleSyncEvent = useCallback((data: SyncEventData) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[LineSync] event:', data.type, data.payload);
    }

    switch (data.type) {

      case 'NEW_MESSAGE': {
        // Refetch inbox list (infinite query) + chat messages (infinite query)
        refetchByRouter('conversations');
        refetchByRouter('messages');
        refetchByRouter('overview');
        refetchByRouter('contacts');
        break;
      }

      case 'MESSAGE_UPDATED': {
        refetchByRouter('messages');
        break;
      }

      case 'CONVERSATION_UPDATED': {
        refetchByRouter('conversations');
        refetchByRouter('notes');
        refetchByProcedure('overview', 'stats');
        break;
      }

      case 'TAG_UPDATED': {
        refetchByRouter('tags');
        refetchByRouter('contacts');
        refetchByRouter('conversations');
        break;
      }

      case 'LABEL_UPDATED': {
        refetchByRouter('labels');
        refetchByRouter('conversations');
        break;
      }

      case 'CONTACT_UPDATED': {
        refetchByRouter('contacts');
        refetchByRouter('conversations');
        refetchByProcedure('overview', 'stats');
        break;
      }

      case 'CHANNEL_ACCESS_UPDATED': {
        const me = trpcRef.current.auth.me.getData();
        const targetId = data.payload?.targetAdminUserId;
        if (!targetId || targetId === me?.id) {
          refetchAll();
        } else {
          refetchByRouter('users');
        }
        break;
      }

      case 'NEW_NOTIFICATION': {
        const adminId = data.payload?.targetAdminUserId;
        const me = trpcRef.current.auth.me.getData();
        if (!adminId || adminId === me?.id) {
          refetchByRouter('notifications');
        }
        break;
      }

      case 'NOTIFICATION_UPDATED': {
        refetchByRouter('notifications');
        break;
      }

      case 'CONTACT_STATUS_CHANGE': {
        refetchByRouter('contacts');
        refetchByRouter('conversations');
        refetchByRouter('overview');
        break;
      }
    }
  }, [refetchByRouter, refetchByProcedure, refetchAll]);

  useSocketEvent('sync', handleSyncEvent);

  return { isConnected };
}
