import { Metadata } from 'next';
import InboxLayoutClient from './InboxLayoutClient';

export const metadata: Metadata = {
  title: 'แชท',
};

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return <InboxLayoutClient>{children}</InboxLayoutClient>;
}
