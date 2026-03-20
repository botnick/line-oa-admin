import styles from './AppShell.module.css';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { LineSyncHandler } from './LineSyncHandler';
import { WorkspaceProvider } from '@/hooks/useWorkspace';

interface AppShellProps {
  children: React.ReactNode;
  /** Page title shown in TopBar */
  title?: string;
  /** Hide TopBar (e.g., for chat detail with custom header) */
  hideTopBar?: boolean;
  /** Hide BottomNav (e.g., for chat detail on mobile) */
  hideBottomNav?: boolean;
}

export function AppShell({
  children,
  title,
  hideTopBar = false,
  hideBottomNav = false,
}: AppShellProps) {
  return (
    <WorkspaceProvider>
      <LineSyncHandler>
        <div className={styles.shell}>
          <SideNav className={styles.sideNav} />
          <div className={styles.contentWrapper}>
            {!hideTopBar && <TopBar title={title} />}
            <main className={styles.main}>
              {children}
            </main>
            {!hideBottomNav && <BottomNav />}
          </div>
        </div>
      </LineSyncHandler>
    </WorkspaceProvider>
  );
}
