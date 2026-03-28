'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Copy,
  Check,
  X,
  Edit2,
  Trash2,
  RefreshCw,
  MessageCircle,
  Users as UsersIcon,
  Wifi,
  WifiOff,
  ExternalLink,
  Bot,
  BookOpen,
  Power,
  PowerOff,
  AlertTriangle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Tooltip } from '@/components/ui/Tooltip';
import styles from './page.module.css';

type ModalMode = 'create' | 'edit' | null;

interface AccountForm {
  channelId: string;
  channelSecret: string;
  channelAccessToken: string;
}

const EMPTY_FORM: AccountForm = {
  channelId: '',
  channelSecret: '',
  channelAccessToken: '',
};

export function LineAccountsClient() {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: accounts, isPending: isAccountsPending } = trpc.lineAccounts.listAll.useQuery(undefined, {
    retry: false,
    staleTime: 5000,
  });

  const { data: settingsData, isPending: isSettingsPending } = trpc.settings.get.useQuery(undefined, {
    staleTime: 60000,
  });

  const createMutation = trpc.lineAccounts.create.useMutation({
    onSuccess: () => {
      setStatusMsg({ type: 'success', text: '✓ เพิ่ม LINE Account สำเร็จ' });
      setModalMode(null);
      setForm(EMPTY_FORM);
      utils.lineAccounts.listAll.invalidate();
      utils.lineAccounts.list.invalidate();
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'ไม่สามารถเพิ่ม LINE Account ได้' });
    },
  });

  const updateMutation = trpc.lineAccounts.update.useMutation({
    onSuccess: () => {
      setStatusMsg({ type: 'success', text: '✓ อัปเดต LINE Account สำเร็จ' });
      setModalMode(null);
      setEditId(null);
      setForm(EMPTY_FORM);
      utils.lineAccounts.listAll.invalidate();
      utils.lineAccounts.list.invalidate();
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'ไม่สามารถอัปเดตได้' });
    },
  });

  const toggleActiveMutation = trpc.lineAccounts.toggleActive.useMutation({
    onSuccess: (_data, variables) => {
      setStatusMsg({ type: 'success', text: variables.isActive ? '✓ เปิดใช้งาน LINE Account สำเร็จ' : '✓ ปิดใช้งาน LINE Account สำเร็จ' });
      utils.lineAccounts.listAll.invalidate();
      utils.lineAccounts.list.invalidate();
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'ไม่สามารถเปลี่ยนสถานะได้' });
    },
  });

  const hardDeleteMutation = trpc.lineAccounts.hardDelete.useMutation({
    onSuccess: () => {
      setStatusMsg({ type: 'success', text: '✓ ลบ LINE Account ถาวรสำเร็จ' });
      setDeleteConfirmId(null);
      utils.lineAccounts.listAll.invalidate();
      utils.lineAccounts.list.invalidate();
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'ไม่สามารถลบได้' });
    },
  });

  const updateField = useCallback((field: keyof AccountForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setStatusMsg(null);
  }, []);

  const handleOpenCreate = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModalMode('create');
    setStatusMsg(null);
  }, []);

  const handleOpenEdit = useCallback((acc: { id: string; channelId: string }) => {
    setForm({
      channelId: acc.channelId,
      channelSecret: '',
      channelAccessToken: '',
    });
    setEditId(acc.id);
    setModalMode('edit');
    setStatusMsg(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.channelId || !form.channelSecret || !form.channelAccessToken) {
      setStatusMsg({ type: 'error', text: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' });
      return;
    }

    if (modalMode === 'create') {
      createMutation.mutate(form);
    } else if (modalMode === 'edit' && editId) {
      updateMutation.mutate({ ...form, id: editId });
    }
  }, [form, modalMode, editId, createMutation, updateMutation]);

  const handleToggleActive = useCallback((id: string, isActive: boolean) => {
    toggleActiveMutation.mutate({ id, isActive });
  }, [toggleActiveMutation]);

  const handleHardDelete = useCallback((id: string) => {
    hardDeleteMutation.mutate({ id });
  }, [hardDeleteMutation]);

  const appBaseUrl = (settingsData as any)?.app?.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const webhookUrl = `${appBaseUrl}/api/webhook/line`;

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const isMutating = createMutation.isPending || updateMutation.isPending;

  // ---------- Loading ----------
  if (isAccountsPending || isSettingsPending) {
    return (
      <div className={styles.loadingWrapper}>
        <RefreshCw size={24} className={styles.spinner} />
        <span className={styles.loadingText}>กำลังโหลด LINE Accounts...</span>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <Tooltip content="กลับ">
            <Link href="/settings" className={styles.backBtn}>
              <ArrowLeft size={18} />
            </Link>
          </Tooltip>
          <div className={styles.headerText}>
            <h1 className={styles.title}>LINE Accounts</h1>
            <p className={styles.subtitle}>จัดการบัญชี LINE OA ทั้งหมดที่เชื่อมต่อกับระบบ</p>
          </div>
          <button className={styles.addBtn} onClick={handleOpenCreate} type="button">
            <Plus size={16} />
            เพิ่ม
          </button>
        </div>

        {/* Status message */}
        {statusMsg && !modalMode && !deleteConfirmId && (
          <div className={`${styles.statusMsg} ${statusMsg.type === 'success' ? styles.statusSuccess : styles.statusError}`}>
            {statusMsg.text}
          </div>
        )}

        {/* Webhook URL — shared for all accounts */}
        <div className={styles.webhookBox}>
          <span className={styles.webhookLabel}>Webhook URL:</span>
          <span className={styles.webhookUrl}>{webhookUrl}</span>
          <Tooltip content="คัดลอก">
            <button
              className={styles.copyBtn}
              onClick={() => handleCopy(webhookUrl, 'webhook')}
              type="button"
            >
              {copiedId === 'webhook' ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </Tooltip>
        </div>

        {/* Account List */}
        {(!accounts || accounts.length === 0) ? (
          <div className={styles.emptyState}>
            <Bot size={48} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>ยังไม่มี LINE Account</p>
            <p className={styles.emptyText}>กดปุ่ม "เพิ่ม" เพื่อเชื่อมต่อ LINE OA ของคุณ</p>
            <button className={styles.btnPrimary} onClick={handleOpenCreate} type="button">
              <Plus size={16} />
              เพิ่ม LINE Account
            </button>
          </div>
        ) : (
          <div className={styles.accountList}>
            {accounts.map((acc) => (
              <div key={acc.id} className={styles.accountCard}>
                <div className={styles.cardHeader}>
                  {acc.pictureUrl ? (
                    <img src={acc.pictureUrl} alt={acc.displayName || ''} className={styles.botAvatar} />
                  ) : (
                    <div className={styles.botAvatarPlaceholder}>
                      {(acc.displayName || 'B').charAt(0)}
                    </div>
                  )}
                  <div className={styles.botInfo}>
                    <p className={styles.botName}>{acc.displayName || 'ไม่มีชื่อ'}</p>
                    <p className={styles.botId}>{acc.basicId || acc.channelId}</p>
                  </div>
                  <span className={acc.isActive ? styles.statusActive : styles.statusInactive}>
                    {acc.isActive ? (
                      <><Wifi size={12} /> เชื่อมต่อ</>
                    ) : (
                      <><WifiOff size={12} /> ปิดใช้งาน</>
                    )}
                  </span>
                </div>

                <div className={styles.cardMeta}>
                  <span className={styles.metaItem}>
                    <MessageCircle size={12} />
                    {acc._count?.conversations || 0} แชท
                  </span>
                  <span className={styles.metaItem}>
                    <UsersIcon size={12} />
                    {acc._count?.messages || 0} ข้อความ
                  </span>
                  <span className={styles.metaItem}>
                    Channel: {acc.channelId}
                  </span>
                </div>

                <div className={styles.cardActions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleOpenEdit(acc)}
                    type="button"
                  >
                    <Edit2 size={14} />
                    แก้ไข
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleCopy(`${webhookUrl}`, `wh-${acc.id}`)}
                    type="button"
                  >
                    {copiedId === `wh-${acc.id}` ? <Check size={14} /> : <Copy size={14} />}
                    Webhook
                  </button>
                  <span className={styles.actionSpacer} />
                  <button
                    className={acc.isActive ? styles.actionBtnWarning : styles.actionBtnSuccess}
                    onClick={() => handleToggleActive(acc.id, !acc.isActive)}
                    type="button"
                    disabled={toggleActiveMutation.isPending}
                  >
                    {acc.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                    {acc.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                  <button
                    className={styles.actionBtnDanger}
                    onClick={() => setDeleteConfirmId(acc.id)}
                    type="button"
                  >
                    <Trash2 size={14} />
                    ลบบัญชี
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========== Setup Guide / Manual ========== */}
        <div className={styles.guideSection}>
          <div className={styles.guideHeader}>
            <h2 className={styles.guideTitle}>
              <BookOpen size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              คู่มือตั้งค่า LINE Messaging API
            </h2>
            <p className={styles.guideDesc}>ทำตามขั้นตอนด้านล่างเพื่อเชื่อมต่อ LINE OA กับระบบ</p>
          </div>

          <div className={styles.stepList}>
            <div className={styles.step}>
              <span className={styles.stepNumber}>1</span>
              <div className={styles.stepContent}>
                <p className={styles.stepTitle}>สร้าง LINE Official Account</p>
                <p className={styles.stepText}>
                  ไปที่{' '}
                  <a href="https://manager.line.biz/" target="_blank" rel="noopener noreferrer" className={styles.stepLink}>
                    LINE Official Account Manager <ExternalLink size={12} style={{ verticalAlign: 'middle' }} />
                  </a>{' '}
                  แล้วสร้างบัญชี LINE OA ใหม่ หรือเลือกบัญชีที่มีอยู่แล้ว
                </p>
              </div>
            </div>

            <div className={styles.step}>
              <span className={styles.stepNumber}>2</span>
              <div className={styles.stepContent}>
                <p className={styles.stepTitle}>เปิดใช้งาน Messaging API</p>
                <p className={styles.stepText}>
                  ไปที่{' '}
                  <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className={styles.stepLink}>
                    LINE Developers Console <ExternalLink size={12} style={{ verticalAlign: 'middle' }} />
                  </a>{' '}
                  → เลือก Provider → เลือก Channel → เปิดใช้งาน Messaging API
                </p>
              </div>
            </div>

            <div className={styles.step}>
              <span className={styles.stepNumber}>3</span>
              <div className={styles.stepContent}>
                <p className={styles.stepTitle}>คัดลอก Channel ID &amp; Channel Secret</p>
                <p className={styles.stepText}>
                  ในหน้า <strong>Basic settings</strong> ของ LINE Developers Console ให้คัดลอก <strong>Channel ID</strong> และ <strong>Channel secret</strong>
                </p>
              </div>
            </div>

            <div className={styles.step}>
              <span className={styles.stepNumber}>4</span>
              <div className={styles.stepContent}>
                <p className={styles.stepTitle}>สร้าง Channel Access Token (Long-lived)</p>
                <p className={styles.stepText}>
                  ไปที่แท็บ <strong>Messaging API</strong> → เลื่อนลงไปที่ส่วน <strong>Channel access token</strong> → กด <strong>Issue</strong> เพื่อสร้าง token
                </p>
              </div>
            </div>

            <div className={styles.step}>
              <span className={styles.stepNumber}>5</span>
              <div className={styles.stepContent}>
                <p className={styles.stepTitle}>ตั้งค่า Webhook URL</p>
                <p className={styles.stepText}>
                  ในแท็บ <strong>Messaging API</strong> → ส่วน <strong>Webhook settings</strong> → วาง URL ด้านล่างนี้ แล้วเปิดใช้งาน <strong>Use webhook</strong>
                </p>
                <div className={styles.webhookBox} style={{ marginTop: '0.5rem' }}>
                  <span className={styles.webhookUrl}>{webhookUrl}</span>
                  <Tooltip content="คัดลอก">
                    <button
                      className={styles.copyBtn}
                      onClick={() => handleCopy(webhookUrl, 'guide-webhook')}
                      type="button"
                    >
                      {copiedId === 'guide-webhook' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>

            <div className={styles.step}>
              <span className={styles.stepNumber}>6</span>
              <div className={styles.stepContent}>
                <p className={styles.stepTitle}>ปิด Auto-reply &amp; Greeting Messages</p>
                <p className={styles.stepText}>
                  ไปที่ <strong>LINE Official Account Manager</strong> → <strong>ตั้งค่า (Settings)</strong> → <strong>การตอบกลับ (Response settings)</strong> → ปิด <strong>ข้อความตอบรับอัตโนมัติ (Auto-reply messages)</strong> และ <strong>ข้อความทักทาย (Greeting messages)</strong> เพื่อให้ระบบจัดการข้อความแทน
                </p>
              </div>
            </div>

            <div className={styles.step}>
              <span className={styles.stepNumber}>7</span>
              <div className={styles.stepContent}>
                <p className={styles.stepTitle}>เพิ่ม LINE Account ในระบบ</p>
                <p className={styles.stepText}>
                  กดปุ่ม <strong>"เพิ่ม"</strong> ด้านบน แล้วกรอก Channel ID, Channel Secret และ Channel Access Token ที่คัดลอกมา ระบบจะตรวจสอบข้อมูลอัตโนมัติ
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========== Create / Edit Modal ========== */}
      {modalMode && (
        <div className={styles.modalOverlay} onClick={() => { setModalMode(null); setForm(EMPTY_FORM); }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {modalMode === 'create' ? 'เพิ่ม LINE Account' : 'แก้ไข LINE Account'}
              </h3>
              <button
                className={styles.modalCloseBtn}
                onClick={() => { setModalMode(null); setForm(EMPTY_FORM); }}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {statusMsg && statusMsg.type === 'error' && (
                <div className={`${styles.statusMsg} ${styles.statusError}`}>{statusMsg.text}</div>
              )}

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Channel ID</label>
                <input
                  type="text"
                  className={styles.input}
                  value={form.channelId}
                  onChange={(e) => updateField('channelId', e.target.value)}
                  placeholder="เช่น 1234567890"
                  autoComplete="off"
                  data-1p-ignore
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Channel Secret</label>
                <input
                  type="password"
                  className={styles.input}
                  value={form.channelSecret}
                  onChange={(e) => updateField('channelSecret', e.target.value)}
                  placeholder={modalMode === 'edit' ? 'ใส่ใหม่เพื่ออัปเดต' : '••••••••'}
                  autoComplete="new-password"
                  data-1p-ignore
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Channel Access Token (Long-lived)</label>
                <input
                  type="password"
                  className={styles.input}
                  value={form.channelAccessToken}
                  onChange={(e) => updateField('channelAccessToken', e.target.value)}
                  placeholder={modalMode === 'edit' ? 'ใส่ใหม่เพื่ออัปเดต' : '••••••••'}
                  autoComplete="new-password"
                  data-1p-ignore
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.btnSecondary}
                onClick={() => { setModalMode(null); setForm(EMPTY_FORM); }}
                type="button"
                disabled={isMutating}
              >
                ยกเลิก
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleSubmit}
                type="button"
                disabled={isMutating}
              >
                {isMutating ? (
                  <><RefreshCw size={14} className={styles.spinner} /> กำลังบันทึก...</>
                ) : modalMode === 'create' ? (
                  <><Plus size={14} /> เพิ่ม LINE Account</>
                ) : (
                  'บันทึกการแก้ไข'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Hard Delete Confirmation Modal ========== */}
      {deleteConfirmId && (() => {
        const acc = accounts?.find((a) => a.id === deleteConfirmId);
        return (
          <div className={styles.modalOverlay} onClick={() => setDeleteConfirmId(null)}>
            <div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>

              {/* Close button */}
              <button className={styles.deleteModalClose} onClick={() => setDeleteConfirmId(null)} type="button">
                <X size={15} />
              </button>

              {/* Hero */}
              <div className={styles.deleteHero}>
                <div className={styles.deleteHeroGlow} />
                <div className={styles.deleteHeroIcon}>
                  <Trash2 size={26} />
                </div>
                <h3 className={styles.deleteHeroTitle}>ลบบัญชีถาวร</h3>
                <p className={styles.deleteHeroSub}>การดำเนินการนี้<strong>ไม่สามารถย้อนกลับ</strong>ได้</p>
              </div>

              <div className={styles.deleteModalBody}>
                {statusMsg && statusMsg.type === 'error' && (
                  <div className={`${styles.statusMsg} ${styles.statusError}`}>{statusMsg.text}</div>
                )}

                {/* Account identity card */}
                <div className={styles.deleteAccountCard}>
                  {acc?.pictureUrl ? (
                    <img src={acc.pictureUrl} alt={acc.displayName || ''} className={styles.deleteAccountAvatar} />
                  ) : (
                    <div className={styles.deleteAccountAvatarPlaceholder}>
                      {(acc?.displayName || 'B').charAt(0)}
                    </div>
                  )}
                  <div className={styles.deleteAccountInfo}>
                    <p className={styles.deleteAccountName}>{acc?.displayName || 'ไม่มีชื่อ'}</p>
                    <p className={styles.deleteAccountId}>{acc?.basicId || acc?.channelId}</p>
                  </div>
                  <span className={acc?.isActive ? styles.deleteAccountBadgeActive : styles.deleteAccountBadge}>
                    {acc?.isActive ? <><Wifi size={10} /> เชื่อมต่อ</> : <><WifiOff size={10} /> ปิดอยู่</>}
                  </span>
                </div>

                {/* Impact table */}
                <div className={styles.deleteImpactSection}>
                  <div className={styles.deleteImpactHeader}>
                    <AlertTriangle size={11} style={{ flexShrink: 0 }} />
                    ข้อมูลที่จะถูกลบทั้งหมด
                  </div>
                  <div className={styles.deleteImpactRow}>
                    <MessageCircle size={14} className={styles.deleteImpactIcon} />
                    <span className={styles.deleteImpactLabel}>การสนทนา</span>
                    <span className={styles.deleteImpactCount}>{(acc?._count?.conversations ?? 0).toLocaleString()}</span>
                  </div>
                  <div className={styles.deleteImpactRowAlt}>
                    <Bot size={14} className={styles.deleteImpactIcon} />
                    <span className={styles.deleteImpactLabel}>ข้อความ</span>
                    <span className={styles.deleteImpactCount}>{(acc?._count?.messages ?? 0).toLocaleString()}</span>
                  </div>
                  <div className={styles.deleteImpactRow}>
                    <BookOpen size={14} className={styles.deleteImpactIcon} />
                    <span className={styles.deleteImpactLabel}>Tags &amp; Labels</span>
                    <span className={styles.deleteImpactCountAll}>ทั้งหมด</span>
                  </div>
                </div>

                {/* Tip */}
                <div className={styles.deleteHint}>
                  <div className={styles.deleteHintIcon}><Power size={12} /></div>
                  <span>ต้องการหยุดชั่วคราว? ใช้ <strong>ปิดใช้งาน</strong> แทนการลบ</span>
                </div>
              </div>

              {/* Footer */}
              <div className={styles.deleteModalFooter}>
                <button
                  className={styles.btnSecondary}
                  onClick={() => setDeleteConfirmId(null)}
                  type="button"
                  disabled={hardDeleteMutation.isPending}
                >
                  ยกเลิก
                </button>
                <button
                  className={styles.deleteBtnDanger}
                  onClick={() => handleHardDelete(deleteConfirmId)}
                  type="button"
                  disabled={hardDeleteMutation.isPending}
                >
                  {hardDeleteMutation.isPending ? (
                    <><RefreshCw size={14} className={styles.spinner} /> กำลังลบ...</>
                  ) : (
                    <><Trash2 size={14} /> ลบถาวร</>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
