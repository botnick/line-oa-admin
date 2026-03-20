'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Check, ArrowRight, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { th } from '@/lib/thai';
import styles from './page.module.css';

/**
 * First-run setup wizard.
 * Guides the operator through 3 steps:
 *   1. App Info (name)
 *   2. LINE Login credentials
 *   3. Cloud storage (Cloudflare R2) credentials
 *
 * LINE Messaging API credentials are managed in Settings > LINE Accounts.
 * After saving, redirects to /inbox.
 */

type SetupStep = 'app_info' | 'line_login' | 'storage' | 'done';

const STEPS: SetupStep[] = ['app_info', 'line_login', 'storage', 'done'];

interface FormData {
  appName: string;
  lineLoginChannelId: string;
  lineLoginChannelSecret: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
}

const INITIAL_FORM: FormData = {
  appName: 'LINE OA Admin',
  lineLoginChannelId: '',
  lineLoginChannelSecret: '',
  r2AccountId: '',
  r2AccessKeyId: '',
  r2SecretAccessKey: '',
  r2BucketName: 'line-oa-media',
  r2PublicUrl: '',
};

/** Collapsible guide */
function Guide({ show, onToggle, children }: {
  show: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <button className={styles.guideToggle} onClick={onToggle} type="button">
        <BookOpen size={14} />
        <span>{show ? 'ซ่อน' : 'หาค่าจากไหน?'}</span>
        {show ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {show && <div className={styles.guideBox}>{children}</div>}
    </>
  );
}

function Step({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <div className={styles.guideStep}>
      <span className={styles.guideNum}>{num}</span>
      <div className={styles.guideText}>{children}</div>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return <div className={styles.guideWarning}>{children}</div>;
}

export default function SetupClient() {
  const router = useRouter();
  const [step, setStep] = useState<SetupStep>('app_info');
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const currentIndex = STEPS.indexOf(step);

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const goNext = () => {
    const next = currentIndex + 1;
    if (next < STEPS.length) {
      setStep(STEPS[next]);
      setShowGuide(false);
    }
  };

  const goBack = () => {
    const prev = currentIndex - 1;
    if (prev >= 0) {
      setStep(STEPS[prev]);
      setShowGuide(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Setup failed');
      setStep('done');
    } catch (err) {
      console.error('[setup] Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.setupPage}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logoIcon}>
            <MessageCircle size={24} />
          </div>
          <h1 className={styles.title}>{th.setup.title}</h1>
          <p className={styles.subtitle}>{th.setup.subtitle}</p>
        </div>

        {/* Step dots */}
        {step !== 'done' && (
          <div className={styles.steps}>
            {STEPS.slice(0, -1).map((s, i) => (
              <div
                key={s}
                className={`${styles.stepDot} ${
                  i === currentIndex ? styles.stepDotActive : ''
                } ${i < currentIndex ? styles.stepDotDone : ''}`}
              />
            ))}
          </div>
        )}

        {/* Step 0: App Info */}
        {step === 'app_info' && (
          <div className={styles.form}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>ข้อมูลระบบ</p>
              <p className={styles.sectionHint}>ระบุชื่อแอปพลิเคชันสำหรับแสดงผล</p>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>ชื่อแอปพลิเคชัน</label>
              <input
                className={styles.input}
                type="text"
                placeholder="LINE OA Admin"
                value={form.appName}
                onChange={(e) => updateField('appName', e.target.value)}
                maxLength={30}
              />
              <p className={styles.fieldHint}>
                จะแสดงบน title bar, PWA, และหน้า login — ตั้งชื่อตามใจเลย เช่น <code>LINE OA ร้านดอกไม้</code>
              </p>
            </div>

            <div className={styles.actions}>
              <button className={styles.btnPrimary} onClick={goNext} type="button">
                <span>{th.setup.next}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 1: LINE Login */}
        {step === 'line_login' && (
          <div className={styles.form}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>LINE Login</p>
              <p className={styles.sectionHint}>ใช้สำหรับล็อกอินเข้าระบบ Admin</p>
              <Guide show={showGuide} onToggle={() => setShowGuide(!showGuide)}>
                <Step num={1}>
                  เปิด{' '}
                  <a href="https://developers.line.biz" target="_blank" rel="noopener noreferrer">
                    LINE Developers Console
                  </a>{' '}
                  → สร้าง Channel ประเภท <strong>LINE Login</strong>
                </Step>
                <Step num={2}>
                  แท็บ <strong>Basic settings</strong> → ก็อปค่ามาใส่ด้านล่าง<br />
                  <strong>Channel ID</strong> = ตัวเลข 10 หลัก &nbsp;|&nbsp; <strong>Channel Secret</strong> = ตัวอักษร 32 ตัว
                </Step>
                <Step num={3}>
                  แท็บ <strong>LINE Login</strong> → ตั้ง <strong>Callback URL</strong>:<br />
                  <code>https://&lt;โดเมน&gt;/api/auth/callback/line</code>
                </Step>
                <Warning>
                  ⚠️ Callback URL ต้องเป็น <strong>HTTPS</strong> เท่านั้น<br />
                  ถ้า dev บน localhost → ใช้ <strong>ngrok</strong> หรือ <strong>Cloudflare Tunnel</strong> ทำ HTTPS ให้
                </Warning>
              </Guide>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Login Channel ID</label>
              <input
                className={styles.input}
                type="text"
                placeholder="1234567890"
                value={form.lineLoginChannelId}
                onChange={(e) => updateField('lineLoginChannelId', e.target.value)}
                autoComplete="one-time-code"
                data-1p-ignore
                data-lpignore="true"
              />
              <p className={styles.fieldHint}>
                Basic settings → Channel ID — เป็นตัวเลข 10 หลัก เช่น <code>2006123456</code>
              </p>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Login Channel Secret</label>
              <input
                className={styles.input}
                type="password"
                placeholder="••••••••••••"
                value={form.lineLoginChannelSecret}
                onChange={(e) => updateField('lineLoginChannelSecret', e.target.value)}
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
              <p className={styles.fieldHint}>
                Basic settings → Channel secret — ตัวอักษร 32 ตัว เช่น <code>a1b2c3d4e5f6...</code>
              </p>
            </div>

            <div className={styles.actions}>
              <div className={styles.buttonRow}>
                <button className={styles.btnSecondary} onClick={goBack} type="button">
                  {th.setup.back}
                </button>
                <button
                  className={styles.btnPrimary}
                  onClick={goNext}
                  type="button"
                  disabled={!form.lineLoginChannelId || !form.lineLoginChannelSecret}
                >
                  <span>{th.setup.next}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Storage */}
        {step === 'storage' && (
          <div className={styles.form}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>Cloud Storage</p>
              <p className={styles.sectionHint}>ใช้เก็บรูป, วิดีโอ, ไฟล์ที่ลูกค้าส่งมา (Cloudflare R2)</p>
              <Guide show={showGuide} onToggle={() => setShowGuide(!showGuide)}>
                <Step num={1}>
                  เปิด{' '}
                  <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer">
                    Cloudflare Dashboard
                  </a>{' '}
                  → <strong>R2 Object Storage</strong> → สร้าง Bucket ใหม่
                </Step>
                <Step num={2}>
                  <strong>Account ID</strong> → ดูมุมขวาบนของ Dashboard<br />
                  หน้าตาเป็นตัวอักษร 32 ตัว
                </Step>
                <Step num={3}>
                  กด <strong>Manage R2 API Tokens</strong> → สร้าง token ใหม่<br />
                  เลือก permission: <strong>Object Read &amp; Write</strong>
                </Step>
                <Step num={4}>
                  ก็อปค่าที่ได้มาใส่ด้านล่าง:<br />
                  <strong>Access Key ID</strong> &nbsp;|&nbsp; <strong>Secret Access Key</strong><br />
                  ⚠️ Secret โชว์แค่ครั้งเดียว ก็อปเก็บไว้เลย!
                </Step>
                <Warning>
                  💡 แนะนำเปิด <strong>Public URL</strong> เพื่อโหลดรูป/ไฟล์ได้ถาวร<br />
                  Bucket → Settings → Public access → เปิด <strong>R2.dev subdomain</strong><br />
                  ถ้าไม่เปิด → ระบบจะใช้ Presigned URL แทน (หมดอายุ 1 ชม.)
                </Warning>
              </Guide>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>R2 Account ID</label>
              <input
                className={styles.input}
                type="text"
                placeholder="a1b2c3d4e5f6g7h8..."
                value={form.r2AccountId}
                onChange={(e) => updateField('r2AccountId', e.target.value)}
                autoComplete="off"
              />
              <p className={styles.fieldHint}>
                Cloudflare Dashboard → มุมขวาบน → Account ID — เช่น <code>1a2b3c4d5e6f...</code>
              </p>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Access Key ID</label>
              <input
                className={styles.input}
                type="text"
                placeholder="abc123def456..."
                value={form.r2AccessKeyId}
                onChange={(e) => updateField('r2AccessKeyId', e.target.value)}
                autoComplete="off"
              />
              <p className={styles.fieldHint}>
                สร้าง R2 API Token → Access Key ID
              </p>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Secret Access Key</label>
              <input
                className={styles.input}
                type="password"
                placeholder="••••••••••••"
                value={form.r2SecretAccessKey}
                onChange={(e) => updateField('r2SecretAccessKey', e.target.value)}
                autoComplete="off"
              />
              <p className={styles.fieldHint}>
                สร้าง R2 API Token → Secret Access Key — ⚠️ โชว์ครั้งเดียว ถ้าหายต้องสร้างใหม่
              </p>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Bucket Name</label>
              <input
                className={styles.input}
                type="text"
                placeholder="line-oa-media"
                value={form.r2BucketName}
                onChange={(e) => updateField('r2BucketName', e.target.value)}
                autoComplete="off"
              />
              <p className={styles.fieldHint}>
                ชื่อ Bucket ที่สร้างไว้ — เช่น <code>line-oa-media</code>
              </p>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Public URL <span style={{ color: '#999', fontWeight: 400 }}>(แนะนำ)</span></label>
              <input
                className={styles.input}
                type="text"
                placeholder="https://pub-abc123.r2.dev"
                value={form.r2PublicUrl}
                onChange={(e) => updateField('r2PublicUrl', e.target.value)}
                autoComplete="off"
              />
              <p className={styles.fieldHint}>
                R2 Bucket → Settings → Public access → คัดลอก URL มาใส่ เช่น <code>https://pub-abc123.r2.dev</code> หรือ custom domain
              </p>
            </div>

            <div className={styles.actions}>
              <div className={styles.buttonRow}>
                <button className={styles.btnSecondary} onClick={goBack} type="button">
                  {th.setup.back}
                </button>
                <button
                  className={styles.btnPrimary}
                  onClick={handleSave}
                  disabled={saving || !form.r2AccountId || !form.r2AccessKeyId || !form.r2SecretAccessKey || !form.r2BucketName}
                  title={(!form.r2AccountId || !form.r2AccessKeyId || !form.r2SecretAccessKey || !form.r2BucketName) ? 'กรุณากรอกข้อมูลให้ครบ' : ''}
                  type="button"
                >
                  {saving ? th.setup.saving : th.setup.saveAndFinish}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className={styles.form}>
            <div className={styles.successIcon}>
              <Check size={28} strokeWidth={3} />
            </div>
            <p className={styles.successTitle}>{th.setup.completeTitle}</p>
            <p className={styles.successMessage}>{th.setup.completeDescription}</p>
            <button
              className={styles.btnPrimary}
              onClick={() => router.push('/inbox')}
              type="button"
            >
              {th.setup.goToInbox}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
