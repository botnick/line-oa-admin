import { isSetupCompleted } from '@line-oa/config/settings';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import SetupClient from './SetupClient';

export const metadata: Metadata = {
  title: 'ตั้งค่าเริ่มต้น',
};

export default async function SetupPage() {
  const completed = isSetupCompleted();
  
  if (completed) {
    redirect('/login');
  }

  return <SetupClient />;
}
