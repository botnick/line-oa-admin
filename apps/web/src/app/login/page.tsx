import { Metadata } from 'next';
import { MessageCircle, LogIn } from 'lucide-react';
import { th } from '@/lib/thai';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ',
};

const ERROR_MESSAGES: Record<string, string> = {
  line_denied: 'คุณปฏิเสธการเข้าสู่ระบบ',
  unauthorized: th.auth.unauthorized,
  auth_failed: th.auth.loginFailed,
  invalid_state: 'เซสชันหมดอายุ กรุณาลองใหม่',
  missing_params: 'ข้อมูลไม่ครบ กรุณาลองใหม่',
  session_expired: th.auth.sessionExpired,
  pending_approval: 'บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className={styles.loginPage}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <MessageCircle size={28} strokeWidth={2} />
          </div>
          <h1 className={styles.logoTitle}>{th.app.name}</h1>
          <p className={styles.logoSubtitle}>{th.app.tagline}</p>
        </div>

        {error && (
          <div className={styles.errorBox}>
            {ERROR_MESSAGES[error] ?? th.auth.loginFailed}
          </div>
        )}

        <a
          className={styles.loginButton}
          href="/api/auth/line/login"
        >
          <LogIn size={18} />
          {th.auth.loginWithLine}
        </a>

        <p className={styles.footer}>
          {th.auth.loginHint}
        </p>
      </div>
    </div>
  );
}
