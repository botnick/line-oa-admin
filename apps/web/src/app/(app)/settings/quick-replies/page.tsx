import { Metadata } from 'next';
import { QuickRepliesClient } from './QuickRepliesClient';

export const metadata: Metadata = {
  title: 'Quick Replies | Settings',
};

export default function QuickRepliesPage() {
  return <QuickRepliesClient />;
}
