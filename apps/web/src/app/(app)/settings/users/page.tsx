import { Metadata } from 'next';
import { th } from '@/lib/thai';
import { UsersClient } from './UsersClient';

export const metadata: Metadata = {
  title: `${th.settings.adminAccounts} | ${th.app.name}`,
  description: 'จัดการผู้ใช้งานระบบ',
};

export default function UsersSettingsPage() {
  return <UsersClient />;
}
