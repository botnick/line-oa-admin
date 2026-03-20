import { Metadata } from 'next';
import { SettingsClient } from './SettingsClient';

export const metadata: Metadata = {
  title: 'Settings - LINE OA Admin',
};

export default function SettingsPage() {
  return <SettingsClient />;
}
