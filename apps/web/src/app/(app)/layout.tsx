import { AppShell } from '@/components/layout';
import { isSetupCompleted } from '@line-oa/config/settings';
import { getSession } from '@/server/auth/session';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSetupCompleted()) {
    redirect('/setup');
  }
  
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return <AppShell>{children}</AppShell>;
}
