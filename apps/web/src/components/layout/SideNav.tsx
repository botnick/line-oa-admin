'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageCircle,
  Search,
  Users,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import { th } from '@/lib/thai';
import { useLineSyncStatus } from './LineSyncHandler';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { NotificationBell } from './NotificationBell';
import { Tooltip } from '../ui/Tooltip';
import styles from './SideNav.module.css';

const navItems = [
  { href: '/inbox', label: th.nav.inbox, icon: MessageCircle },
  { href: '/search', label: th.nav.search, icon: Search },
  { href: '/contacts', label: th.nav.contacts, icon: Users },
  { href: '/overview', label: th.nav.overview, icon: BarChart3 },
  { href: '/settings', label: th.nav.settings, icon: Settings },
] as const;

interface SideNavProps {
  className?: string;
}

export function SideNav({ className = '' }: SideNavProps) {
  const pathname = usePathname();
  const { phase } = useLineSyncStatus();

  return (
    <nav className={`${styles.sideNav} ${className}`} aria-label="เมนูหลัก (Desktop)">
      <WorkspaceSwitcher variant="icon" />
      
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Tooltip key={href} content={label} position="right">
            <Link
              href={href}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.iconWrap}>
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </span>
            </Link>
          </Tooltip>
        );
      })}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
        <NotificationBell />
        <hr style={{ width: '40px', border: 'none', borderTop: '1px solid rgba(0,0,0,0.08)', margin: 'var(--space-2) 0' }} />
        <Tooltip content="ออกจากระบบ" position="right">
          <a
            href="/api/auth/logout"
            className={styles.navItem}
            style={{ cursor: 'pointer', color: '#ff4d4f' }}
          >
            <span className={styles.iconWrap}>
              <LogOut size={24} strokeWidth={2} />
            </span>
          </a>
        </Tooltip>
      </div>

      {/* Dynamic shimmer bar: amber while reconnecting → green on success → fade out */}
      {phase !== 'idle' && (
        <div
          className={`${styles.shimmerBar} ${phase === 'reconnected' ? styles.shimmerSuccess : ''}`}
          aria-hidden="true"
        />
      )}
    </nav>
  );
}
