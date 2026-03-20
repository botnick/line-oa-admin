import { Metadata } from 'next';
import OverviewClient from './OverviewClient';

export const metadata: Metadata = {
  title: 'ภาพรวม',
};

export default function OverviewPage() {
  return <OverviewClient />;
}
