import { Metadata } from 'next';
import TagsClient from './TagsClient';

export const metadata: Metadata = {
  title: 'จัดการแท็กและป้ายกำกับ',
};

export default function TagsPage() {
  return <TagsClient />;
}
