'use client';

import { useEffect, useRef } from 'react';
import { useSocketContext } from '@/components/providers/SocketProvider';

export function useSocket() {
  const { socket, status } = useSocketContext();
  return { socket, status, isConnected: status === 'connected' };
}

/**
 * Subscribe to a Socket.IO event — safe and auto-cleanup.
 * Uses a stable ref so the listener is only registered once per (socket, eventName),
 * even if the callback function identity changes every render.
 *
 * @param eventName  e.g. 'sync'
 * @param callback   handler function — no need to memoize
 */
export function useSocketEvent<T = any>(
  eventName: string,
  callback: (data: T) => void
) {
  const { socket } = useSocketContext();

  // Always keep the latest callback without re-registering the listener
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!socket) return;

    const stableHandler = (data: T) => callbackRef.current(data);
    socket.on(eventName, stableHandler);

    return () => {
      socket.off(eventName, stableHandler);
    };
    // Re-register only when the socket instance or event name changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, eventName]);
}

/**
 * Subscribe to a specific Redis Pub/Sub sync event type.
 * e.g. useSyncEvent('NEW_MESSAGE', (payload) => ...)
 */
export function useSyncEvent<T = any>(
  syncType: string,
  callback: (payload: T) => void
) {
  // Keep latest callback stable
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useSocketEvent('sync', (data: { type: string; timestamp: number; payload: any }) => {
    if (data && data.type === syncType) {
      callbackRef.current(data.payload as T);
    }
  });
}
