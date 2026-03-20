'use client';

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { useLineSync, type LineSyncStatus } from '@/hooks/useLineSync';

// ── Types ────────────────────────────────────────────────────────────────

/**
 * Visual phase of the SSE connection indicator.
 * - `idle`          — connected, nothing shown
 * - `reconnecting`  — amber shimmer bar
 * - `reconnected`   — transitions to green, then auto-fades to idle
 */
export type SyncPhase = 'idle' | 'reconnecting' | 'reconnected';

export interface LineSyncContextValue extends LineSyncStatus {
  phase: SyncPhase;
}

// ── Context ─────────────────────────────────────────────────────────────

const LineSyncContext = createContext<LineSyncContextValue>({
  isConnected: true,
  phase: 'idle',
});

/** Duration (ms) the green "reconnected" state is shown before fading */
const RECONNECTED_DISPLAY_MS = 2_000;

/**
 * Provides SSE connection status AND visual phase to the entire app tree.
 * Automatically manages the amber→green→fade lifecycle so consumers only
 * need to read `phase` and apply the matching CSS class.
 */
export function LineSyncHandler({ children }: { children?: ReactNode }) {
  const { isConnected } = useLineSync();
  const [phase, setPhase] = useState<SyncPhase>('idle');
  const wasDisconnectedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!isConnected) {
      // Mark that we went through a disconnection
      wasDisconnectedRef.current = true;
      setPhase('reconnecting');
      // Clear any pending "reconnected" timer
      if (timerRef.current) clearTimeout(timerRef.current);
    } else if (wasDisconnectedRef.current) {
      // Just reconnected after a disconnection → show green briefly
      wasDisconnectedRef.current = false;
      setPhase('reconnected');
      timerRef.current = setTimeout(() => setPhase('idle'), RECONNECTED_DISPLAY_MS);
    }
    // Initial mount with isConnected=true → phase stays 'idle'

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isConnected]);

  return (
    <LineSyncContext.Provider value={{ isConnected, phase }}>
      {children}
    </LineSyncContext.Provider>
  );
}

/**
 * Read the current SSE connection status and visual phase.
 *
 * @example
 * ```tsx
 * const { phase } = useLineSyncStatus();
 * // phase: 'idle' | 'reconnecting' | 'reconnected'
 * ```
 */
export function useLineSyncStatus(): LineSyncContextValue {
  return useContext(LineSyncContext);
}
