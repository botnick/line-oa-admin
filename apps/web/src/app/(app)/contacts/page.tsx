import { Metadata } from 'next';
import ContactsClient from './ContactsClient';

export const metadata: Metadata = {
  title: 'รายชื่อผู้ติดต่อ',
};

export default function ContactsPage() {
  return <ContactsClient />;
}
