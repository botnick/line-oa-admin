import { Metadata } from 'next';
import InboxClient from './InboxClient';

export const metadata: Metadata = {
  title: 'แชท',
};

export default function InboxPage() {
  return <InboxClient />;
}
