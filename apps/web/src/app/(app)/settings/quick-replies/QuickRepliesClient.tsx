'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Edit2, Trash2, MessageSquare } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Tooltip } from '@/components/ui/Tooltip';
import styles from './page.module.css';

/** LINE Messaging API text limit */
const LINE_TEXT_LIMIT = 2000;

export function QuickRepliesClient() {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', content: '', shortcut: '' });

  const utils = trpc.useUtils();
  const { data: replies, isPending } = trpc.quickReplies.list.useQuery();

  const createMut = trpc.quickReplies.create.useMutation({
    onSuccess: () => {
      setIsCreating(false);
      setEditForm({ title: '', content: '', shortcut: '' });
      utils.quickReplies.list.invalidate();
    }
  });

  const updateMut = trpc.quickReplies.update.useMutation({
    onSuccess: () => {
      setIsEditing(null);
      utils.quickReplies.list.invalidate();
    }
  });

  const deleteMut = trpc.quickReplies.delete.useMutation({
    onSuccess: () => {
      utils.quickReplies.list.invalidate();
    }
  });

  const contentLength = editForm.content.length;
  const isContentOverLimit = contentLength > LINE_TEXT_LIMIT;

  const handleSaveCreate = () => {
    if (!editForm.title.trim() || !editForm.content.trim() || isContentOverLimit) return;
    createMut.mutate({
      title: editForm.title.trim(),
      content: editForm.content.trim(),
      shortcut: editForm.shortcut.trim() || undefined,
    });
  };

  const handleSaveEdit = () => {
    if (!isEditing || !editForm.title.trim() || !editForm.content.trim() || isContentOverLimit) return;
    updateMut.mutate({
      id: isEditing,
      title: editForm.title.trim(),
      content: editForm.content.trim(),
      shortcut: editForm.shortcut.trim() || undefined,
    });
  };

  const startEdit = (reply: any) => {
    setIsEditing(reply.id);
    setEditForm({
      title: reply.title,
      content: reply.content,
      shortcut: reply.shortcut || '',
    });
    setIsCreating(false);
  };

  const startCreate = () => {
    setIsCreating(true);
    setIsEditing(null);
    setEditForm({ title: '', content: '', shortcut: '' });
  };

  /** Reusable content textarea with char counter */
  const renderContentTextarea = (placeholder: string) => (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>เนื้อหาข้อความ (Content)</label>
      <textarea
        className={styles.input}
        style={{
          minHeight: '100px',
          resize: 'vertical',
          borderColor: isContentOverLimit ? 'var(--color-danger)' : undefined,
          boxShadow: isContentOverLimit ? '0 0 0 3px var(--color-danger-light, rgba(239,68,68,0.12))' : undefined,
        }}
        placeholder={placeholder}
        value={editForm.content}
        onChange={(e) => setEditForm((prev) => ({ ...prev, content: e.target.value }))}
      />
      <div className={`${styles.charCounter} ${isContentOverLimit ? styles.charOver : styles.charNormal}`}>
        {contentLength.toLocaleString()}/{LINE_TEXT_LIMIT.toLocaleString()}
      </div>
    </div>
  );

  /** Reusable form fields (create / edit share the same fields) */
  const renderFormFields = (titlePlaceholder: string, contentPlaceholder: string) => (
    <div className={styles.formGrid}>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>หัวข้อ (Title)</label>
        <input
          autoFocus
          className={styles.input}
          placeholder={titlePlaceholder}
          value={editForm.title}
          onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
        />
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>คีย์ลัด (Shortcut - ตัวเลือก)</label>
        <input
          className={styles.input}
          placeholder="เช่น /hello"
          value={editForm.shortcut}
          onChange={(e) => setEditForm(prev => ({ ...prev, shortcut: e.target.value }))}
        />
      </div>
      {renderContentTextarea(contentPlaceholder)}
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ---- Header (matches line-accounts pattern) ---- */}
        <div className={styles.header}>
          <Link href="/settings" className={styles.backBtn}>
            <ArrowLeft size={20} />
          </Link>
          <div className={styles.headerText}>
            <h1 className={styles.title}>ข้อความตอบกลับด่วน</h1>
            <p className={styles.subtitle}>จัดการคำตอบที่ใช้บ่อย เพื่อความรวดเร็วในการแชท</p>
          </div>
          {!isCreating && (
            <button className={styles.addBtn} onClick={startCreate} type="button">
              <Plus size={16} />
              เพิ่มข้อความ
            </button>
          )}
        </div>

        {/* ---- Main Section ---- */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>รายการข้อความด่วน</h2>
          </div>

          {/* Create Form */}
          {isCreating && (
            <div className={styles.formCard}>
              <h3 className={styles.formTitle}>เพิ่มข้อความใหม่</h3>
              {renderFormFields('เช่น ทักทายลูกค้าใหม่', 'สวัสดีค่ะ ยินดีต้อนรับ...')}
              <div className={styles.formActions}>
                <button className={styles.btnSecondary} onClick={() => setIsCreating(false)} type="button">ยกเลิก</button>
                <button
                  className={styles.btnPrimary}
                  onClick={handleSaveCreate}
                  disabled={!editForm.title || !editForm.content || isContentOverLimit || createMut.isPending}
                  type="button"
                >
                  {createMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {isPending ? (
            <div className={styles.loadingText}>กำลังโหลด...</div>
          ) : replies?.length === 0 && !isCreating ? (
            <div className={styles.emptyState}>
              <MessageSquare size={32} className={styles.emptyIcon} />
              <p className={styles.emptyText}>ยังไม่มีข้อความตอบกลับด่วน</p>
            </div>
          ) : (
            <div className={styles.replyList}>
              {replies?.map(reply => (
                <div key={reply.id} className={styles.replyCard}>
                  {isEditing === reply.id ? (
                    /* Edit mode */
                    <div>
                      <h3 className={styles.formTitle}>แก้ไขข้อความ</h3>
                      {renderFormFields('', '')}
                      <div className={styles.formActions}>
                        <button className={styles.btnSecondary} onClick={() => setIsEditing(null)} type="button">ยกเลิก</button>
                        <button
                          className={styles.btnPrimary}
                          onClick={handleSaveEdit}
                          disabled={!editForm.title || !editForm.content || isContentOverLimit || updateMut.isPending}
                          type="button"
                        >
                          {updateMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div className={styles.replyViewRow}>
                      <div>
                        <div className={styles.replyTitleRow}>
                          <h4 className={styles.replyTitle}>{reply.title}</h4>
                          {reply.shortcut && (
                            <span className={styles.shortcutBadge}>{reply.shortcut}</span>
                          )}
                        </div>
                        <p className={styles.replyContent}>{reply.content}</p>
                      </div>
                      <div className={styles.replyActions}>
                        <Tooltip content="แก้ไข">
                          <button
                            className={styles.iconBtn}
                            onClick={() => startEdit(reply)}
                            type="button"
                            aria-label="แก้ไข"
                          >
                            <Edit2 size={16} />
                          </button>
                        </Tooltip>
                        <Tooltip content="ลบ">
                          <button
                            className={styles.iconBtnDanger}
                            onClick={() => { if (confirm('ต้องการลบข้อความด่วนนี้หรือไม่?')) deleteMut.mutate({ id: reply.id }) }}
                            type="button"
                            aria-label="ลบ"
                          >
                            <Trash2 size={16} />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
