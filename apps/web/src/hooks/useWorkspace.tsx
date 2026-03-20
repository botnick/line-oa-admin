'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { trpc } from '@/lib/trpc';

const STORAGE_KEY = 'line-oa-workspace-id';

interface WorkspaceAccount {
  id: string;
  displayName: string | null;
  basicId: string | null;
  pictureUrl: string | null;
  isActive: boolean;
}

interface WorkspaceCtx {
  /** Currently selected account ID (null = "all") */
  accountId: string | null;
  /** Currently selected account object */
  account: WorkspaceAccount | null;
  /** All available accounts */
  accounts: WorkspaceAccount[];
  /** Switch to a specific account (null = all) */
  setAccountId: (id: string | null) => void;
  /** Loading state */
  isLoading: boolean;
  /** Whether the admin has access to at least one channel */
  hasAccess: boolean;
}

const WorkspaceContext = createContext<WorkspaceCtx>({
  accountId: null,
  account: null,
  accounts: [],
  setAccountId: () => {},
  isLoading: true,
  hasAccess: true, // default true to avoid flash
});

/**
 * WorkspaceProvider — wraps app to provide LINE account scope.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [accountId, setAccountIdState] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: accounts = [], isLoading, isError } = trpc.lineAccounts.list.useQuery(undefined, {
    staleTime: 0, // Must be 0 for instant SSE-driven access revocation
    retry: 1,
  });

  // If the query fails (e.g., table doesn't exist yet), treat as empty
  const safeAccounts = isError ? [] : accounts;

  // Load saved workspace from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setAccountIdState(saved);
    }
    setInitialized(true);
  }, []);

  // Auto-select first account if none saved or saved account no longer exists
  useEffect(() => {
    if (!initialized || isLoading || safeAccounts.length === 0) return;

    const savedExists = accountId && safeAccounts.some(a => a.id === accountId);
    if (!savedExists) {
      // If only 1 account, auto-select it; otherwise keep null (= all)
      const auto = safeAccounts.length === 1 ? safeAccounts[0].id : null;
      setAccountIdState(auto);
      if (auto) {
        localStorage.setItem(STORAGE_KEY, auto);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [initialized, isLoading, safeAccounts, accountId]);

  const setAccountId = useCallback((id: string | null) => {
    setAccountIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const account = accountId
    ? (safeAccounts.find(a => a.id === accountId) ?? null)
    : null;

  // Loading is false when we've errored (graceful degradation)
  const effectiveLoading = isError ? false : isLoading;

  // hasAccess: true while loading (prevent flash), then based on accounts
  const hasAccess = effectiveLoading || safeAccounts.length > 0;

  return (
    <WorkspaceContext.Provider
      value={{
        accountId,
        account,
        accounts: safeAccounts as WorkspaceAccount[],
        setAccountId,
        isLoading: effectiveLoading,
        hasAccess,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Hook to access workspace context.
 */
export function useWorkspace() {
  return useContext(WorkspaceContext);
}
