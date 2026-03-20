'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageCircle,
  Search,
  Users,
  BarChart3,
  Settings,
} from 'lucide-react';
import { th } from '@/lib/thai';
import styles from './BottomNav.module.css';

const navItems = [
  { href: '/inbox', label: th.nav.inbox, icon: MessageCircle },
  { href: '/contacts', label: th.nav.contacts, icon: Users },
  { href: '/overview', label: th.nav.overview, icon: BarChart3 },
  { href: '/settings', label: th.nav.settings, icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.bottomNav} aria-label="เมนูหลัก">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className={styles.iconWrap}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
