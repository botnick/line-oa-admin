import { Metadata } from 'next';
import SearchClient from './SearchClient';

export const metadata: Metadata = {
  title: 'ค้นหา',
};

export default function SearchPage() {
  return <SearchClient />;
}
