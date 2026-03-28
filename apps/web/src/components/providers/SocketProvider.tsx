'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface SocketContextValue {
  socket: Socket | null;
  status: ConnectionStatus;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, status: 'disconnected' });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  useEffect(() => {
    console.log('[SocketProvider] Initializing socket connection...');

    const socketInstance = io({
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    setStatus('connecting');

    socketInstance.on('connect', () => {
      console.log('[SocketProvider] ✅ Connected! id:', socketInstance.id);
      setStatus('connected');
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[SocketProvider] ❌ Disconnected:', reason);
      if (reason === 'io server disconnect') {
        setStatus('disconnected');
      } else {
        setStatus('reconnecting');
      }
    });

    socketInstance.on('connect_error', (err) => {
      console.error('[SocketProvider] ⚠️ Connection error:', err.message);
      setStatus('reconnecting');
    });

    // Debug: log ALL events received from server
    socketInstance.onAny((eventName, ...args) => {
      console.log(`[SocketProvider] 📨 Event received: "${eventName}"`, args);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const value = useMemo(() => ({ socket, status }), [socket, status]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocketContext() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}
