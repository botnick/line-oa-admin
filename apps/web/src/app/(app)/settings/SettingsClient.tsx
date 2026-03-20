'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Save, RefreshCw, Copy, Check, AlertCircle, LogOut, ChevronRight, Bot, Users, Sun, Moon, MessageSquare, Bell } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import styles from './page.module.css';

interface SettingsForm {
  appName: string;
  appBaseUrl: string;
  lineLoginChannelId: string;
  lineLoginChannelSecret: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2Endpoint: string;
  r2PublicUrl: string;
}

const EMPTY_FORM: SettingsForm = {
  appName: '',
  appBaseUrl: '',
  lineLoginChannelId: '',
  lineLoginChannelSecret: '',
  r2AccountId: '',
  r2AccessKeyId: '',
  r2SecretAccessKey: '',
  r2BucketName: '',
  r2Endpoint: '',
  r2PublicUrl: '',
};

export function SettingsClient() {
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const { data: me } = trpc.auth.me.useQuery();
  const isSuperAdmin = me?.role === 'SUPER_ADMIN';

  // Only SUPER_ADMIN can access settings.get — skip for regular admins
  const { data, isPending, isError, error, refetch } = trpc.settings.get.useQuery(undefined, {
    retry: false,
    staleTime: 0,
    enabled: isSuperAdmin,
  });

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      setStatusMsg({ type: 'success', text: '✓ บันทึกสำเร็จ' });
      setTimeout(() => setStatusMsg(null), 3000);
      refetch();
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'บันทึกไม่สำเร็จ' });
    },
  });

  // Populate form when data arrives
  useEffect(() => {
    if (data) {
      setForm({
        appName: (data as any).app?.appName ?? '',
        appBaseUrl: (data as any).app?.baseUrl ?? '',
        lineLoginChannelId: data.lineLogin.channelId ?? '',
        lineLoginChannelSecret: data.lineLogin.channelSecret ?? '',
        r2AccountId: data.r2.accountId ?? '',
        r2AccessKeyId: data.r2.accessKeyId ?? '',
        r2SecretAccessKey: data.r2.secretAccessKey ?? '',
        r2BucketName: data.r2.bucketName ?? '',
        r2Endpoint: data.r2.endpoint ?? '',
        r2PublicUrl: data.r2.publicUrl ?? '',
      });
    }
  }, [data]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setTheme('dark');
      } else {
        setTheme('light');
      }
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  }, [theme]);

  const updateField = useCallback((field: keyof SettingsForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setStatusMsg(null);
  }, []);

  const handleSave = useCallback(() => {
    updateMutation.mutate({
      app: {
        appName: form.appName,
        baseUrl: form.appBaseUrl,
      },
      lineLogin: {
        channelId: form.lineLoginChannelId,
        channelSecret: form.lineLoginChannelSecret,
      },
      r2: {
        accountId: form.r2AccountId,
        accessKeyId: form.r2AccessKeyId,
        secretAccessKey: form.r2SecretAccessKey,
        bucketName: form.r2BucketName,
        endpoint: form.r2Endpoint,
        publicUrl: form.r2PublicUrl,
      },
    } as any);
  }, [form, updateMutation]);

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhook`
    : '/api/webhook';

  const handleCopyWebhook = useCallback(() => {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [webhookUrl]);

  const isSaving = updateMutation.isPending;

  // ---------- Loading (only for SUPER_ADMIN) ----------
  if (isSuperAdmin && isPending && !isError) {
    return (
      <div className={styles.loadingWrapper}>
        <RefreshCw size={24} className={styles.spinner} />
        <span className={styles.loadingText}>กำลังโหลดการตั้งค่า...</span>
      </div>
    );
  }

  // ---------- Error (only for SUPER_ADMIN) ----------
  if (isSuperAdmin && isError) {
    return (
      <div className={styles.errorWrapper}>
        <AlertCircle size={32} />
        <span className={styles.errorText}>
          {error?.message || 'ไม่สามารถโหลดการตั้งค่าได้'}
        </span>
        <button className={styles.btnSecondary} onClick={() => refetch()} type="button">
          <RefreshCw size={16} />
          ลองใหม่
        </button>
      </div>
    );
  }

  // ---------- Helpers ----------
  const isLoginConfigured = !!(form.lineLoginChannelId && form.lineLoginChannelSecret);
  const isStorageConfigured = !!(form.r2AccountId && form.r2AccessKeyId && form.r2SecretAccessKey);

  return (
    <div className={styles.settingsPage}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>การตั้งค่า{isSuperAdmin ? 'ระบบ' : ''}</h1>
          <p className={styles.subtitle}>
            {isSuperAdmin
              ? 'จัดการการเชื่อมต่อ LINE API, ระบบล็อกอิน และ Cloud Storage'
              : 'จัดการข้อความตอบกลับด่วนและลักษณะที่ปรากฏ'
            }
          </p>
        </div>

        {/* LINE Accounts Management Link (SUPER_ADMIN only) */}
        {isSuperAdmin && (
          <Link
            href="/settings/line-accounts"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 1.25rem',
              background: 'var(--color-primary-light)',
              border: '1px solid var(--color-primary-light)',
              borderRadius: 'var(--radius-xl)',
              marginBottom: 'var(--space-4)',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Bot size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                จัดการ LINE Accounts
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                เพิ่ม แก้ไข ลบบัญชี LINE OA พร้อมคู่มือตั้งค่า Webhook
              </div>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          </Link>
        )}

        {/* User Management Link (SUPER_ADMIN only) */}
        {isSuperAdmin && (
          <Link
            href="/settings/users"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 1.25rem',
              background: 'var(--color-primary-light)',
              border: '1px solid var(--color-primary-light)',
              borderRadius: 'var(--radius-xl)',
              marginBottom: 'var(--space-6)',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                จัดการผู้ใช้งานระบบ
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                กำหนดสิทธิ์และอนุมัติการเข้าถึง (เฉพาะ Super Admin)
              </div>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          </Link>
        )}

        {/* Quick Replies Management Link */}
        <Link
          href="/settings/quick-replies"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            background: 'var(--color-primary-light)',
            border: '1px solid var(--color-primary-light)',
            borderRadius: 'var(--radius-xl)',
            marginBottom: 'var(--space-4)',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <MessageSquare size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              จัดการหน้าข้อความตอบกลับด่วน (Quick Replies)
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
              สร้าง แก้ไข และลบข้อความตอบกลับด่วนสำหรับการแชท
            </div>
          </div>
          <ChevronRight size={18} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        </Link>
        
        {/* Notifications Settings Link */}
        <Link
          href="/settings/notifications"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            background: 'var(--color-primary-light)',
            border: '1px solid var(--color-primary-light)',
            borderRadius: 'var(--radius-xl)',
            marginBottom: 'var(--space-6)',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Bell size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              การแจ้งเตือนแบบพุช (Push Notifications)
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
              ตั้งค่า เปิด/ปิด การแจ้งเตือนบนเบราว์เซอร์และมือถือ
            </div>
          </div>
          <ChevronRight size={18} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        </Link>
        {/* === App Domain (SUPER_ADMIN only) === */}
        {isSuperAdmin && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                App Domain
              </h2>
              <p className={styles.sectionDesc}>โดเมนหลักของระบบสำหรับสร้าง Webhook URL (เฉพาะ Super Admin)</p>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.fieldGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>ชื่อแอปพลิเคชัน (App Name)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={form.appName}
                  onChange={(e) => updateField('appName', e.target.value)}
                  placeholder="LINE OA Admin"
                  maxLength={30}
                  autoComplete="off"
                />
              </div>
              <div className={styles.fieldGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>Base URL</label>
                <input
                  type="url"
                  className={styles.input}
                  value={form.appBaseUrl}
                  onChange={(e) => updateField('appBaseUrl', e.target.value)}
                  placeholder="https://admin.business.com"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        )}

        {/* === Appearance === */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              ลักษณะที่ปรากฏ (Appearance)
            </h2>
            <p className={styles.sectionDesc}>ปรับแต่งหน้าตาระบบ</p>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.fieldGroup} style={{ gridColumn: '1 / -1' }}>
              <button
                type="button"
                onClick={toggleTheme}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.75rem 1.25rem',
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  color: 'var(--color-text-primary)',
                  fontWeight: 500
                }}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                <span>สลับเป็นโหมด{theme === 'dark' ? 'สว่าง (Light)' : 'มืด (Dark)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* === LINE Login (SUPER_ADMIN only) === */}
        {isSuperAdmin && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                LINE Login
                <span className={`${styles.statusBadge} ${isLoginConfigured ? styles.statusConfigured : styles.statusNotConfigured}`}>
                  {isLoginConfigured ? '✓ เชื่อมต่อแล้ว' : 'ยังไม่ได้ตั้งค่า'}
                </span>
              </h2>
              <p className={styles.sectionDesc}>สำหรับให้แอดมินล็อกอินเข้าระบบด้วยบัญชี LINE</p>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Login Channel ID</label>
                <input
                  type="text"
                  className={styles.input}
                  value={form.lineLoginChannelId}
                  onChange={(e) => updateField('lineLoginChannelId', e.target.value)}
                  placeholder="เช่น 1234567890"
                  autoComplete="off"
                  data-1p-ignore
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Login Channel Secret</label>
                <input
                  type="password"
                  className={styles.input}
                  value={form.lineLoginChannelSecret}
                  onChange={(e) => updateField('lineLoginChannelSecret', e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  data-1p-ignore
                />
              </div>
            </div>
          </div>
        )}

        {/* === Cloud Storage (SUPER_ADMIN only) === */}
        {isSuperAdmin && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Cloud Storage (R2 / S3)
                <span className={`${styles.statusBadge} ${isStorageConfigured ? styles.statusConfigured : styles.statusNotConfigured}`}>
                  {isStorageConfigured ? '✓ เชื่อมต่อแล้ว' : 'ยังไม่ได้ตั้งค่า'}
                </span>
              </h2>
              <p className={styles.sectionDesc}>สำหรับเก็บรูปภาพ วิดีโอ และไฟล์จากแชท</p>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Account ID</label>
                <input
                  type="text"
                  className={styles.input}
                  value={form.r2AccountId}
                  onChange={(e) => updateField('r2AccountId', e.target.value)}
                  placeholder="Cloudflare Account ID"
                  autoComplete="off"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Bucket Name</label>
                <input
                  type="text"
                  className={styles.input}
                  value={form.r2BucketName}
                  onChange={(e) => updateField('r2BucketName', e.target.value)}
                  placeholder="line-oa-media"
                  autoComplete="off"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Access Key ID</label>
                <input
                  type="text"
                  className={styles.input}
                  value={form.r2AccessKeyId}
                  onChange={(e) => updateField('r2AccessKeyId', e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Secret Access Key</label>
                <input
                  type="password"
                  className={styles.input}
                  value={form.r2SecretAccessKey}
                  onChange={(e) => updateField('r2SecretAccessKey', e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Endpoint URL (ไม่บังคับ)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={form.r2Endpoint}
                  onChange={(e) => updateField('r2Endpoint', e.target.value)}
                  placeholder="https://..."
                  autoComplete="off"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Public URL (ไม่บังคับ)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={form.r2PublicUrl}
                  onChange={(e) => updateField('r2PublicUrl', e.target.value)}
                  placeholder="https://pub-..."
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        )}

        {/* === Bottom Actions (SUPER_ADMIN only) === */}
        {isSuperAdmin && (
          <div className={styles.actions}>
            {statusMsg && (
              <span className={`${styles.statusMsg} ${statusMsg.type === 'success' ? styles.statusSuccess : styles.statusError}`}>
                {statusMsg.text}
              </span>
            )}

            <span className={styles.spacer} />

            <button
              className={styles.btnSecondary}
              type="button"
              onClick={() => refetch()}
              disabled={isSaving}
            >
              <RefreshCw size={15} className={isSaving ? styles.spinner : ''} />
              รีเซ็ต
            </button>

            <button
              className={styles.btnPrimary}
              type="button"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save size={15} />
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
