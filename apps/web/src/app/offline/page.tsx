import { Metadata } from 'next';
import OfflineClient from './OfflineClient';

export const metadata: Metadata = {
  title: 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต',
};

export default function OfflinePage() {
  return <OfflineClient />;
}
