import { isSetupCompleted } from '@line-oa/config/settings';
import { getSession } from '@/server/auth/session';
import { redirect } from 'next/navigation';

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  if (!isSetupCompleted()) {
    redirect('/setup');
  }
  
  const session = await getSession();
  if (session) {
    redirect('/inbox');
  }
  
  return <>{children}</>;
}
