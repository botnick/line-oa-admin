'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import {
  ArrowLeft, Plus, Edit2, Trash2,
  Tag as TagIcon, Bookmark as LabelIcon, X, Check,
  AlertTriangle,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { NoChannelAccess } from '@/components/ui/NoChannelAccess';
import styles from './page.module.css';

/* ── Color presets ────────────────────── */
const TAG_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
];

/* ── Inline Form Component ───────────── */
function InlineForm({
  initialName = '',
  initialColor = '#3b82f6',
  onSave,
  onCancel,
  isPending,
  placeholder,
}: {
  initialName?: string;
  initialColor?: string;
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
  isPending: boolean;
  placeholder: string;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, color);
  };

  return (
    <div className={styles.inlineForm}>
      <div className={styles.formRow}>
        <div
          className={styles.colorDot}
          style={{ backgroundColor: color }}
        />
        <input
          ref={inputRef}
          type="text"
          className={styles.formInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') onCancel();
          }}
          disabled={isPending}
          maxLength={50}
        />
        <button
          className={styles.formSave}
          onClick={handleSubmit}
          disabled={!name.trim() || isPending}
        >
          <Check size={16} />
        </button>
        <button className={styles.formCancel} onClick={onCancel}>
          <X size={16} />
        </button>
      </div>
      <div className={styles.colorPalette}>
        {TAG_COLORS.map((c) => (
          <button
            key={c}
            className={`${styles.colorSwatch} ${color === c ? styles.colorSwatchActive : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}

/* ── Confirm Dialog ──────────────────── */
function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  isPending,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className={styles.dialogOverlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogIcon}>
          <AlertTriangle size={24} />
        </div>
        <p className={styles.dialogText}>{message}</p>
        <div className={styles.dialogActions}>
          <button className={styles.dialogCancel} onClick={onCancel} disabled={isPending}>
            ยกเลิก
          </button>
          <button className={styles.dialogConfirm} onClick={onConfirm} disabled={isPending}>
            {isPending ? 'กำลังลบ...' : 'ลบ'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────── */
export default function TagsClient() {
  const router = useRouter();
  const { accountId, hasAccess } = useWorkspace();

  // UI state
  const [addingTag, setAddingTag] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  const [addingLabel, setAddingLabel] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [deletingLabelId, setDeletingLabelId] = useState<string | null>(null);

  if (!hasAccess) return <NoChannelAccess />;

  // Queries
  const { data: tags, isLoading: tagsLoading } = trpc.tags.list.useQuery(
    accountId ? { lineAccountId: accountId } : undefined
  );

  const { data: labels, isLoading: labelsLoading } = trpc.labels.list.useQuery(
    accountId ? { lineAccountId: accountId } : undefined
  );

  // Mutations
  const utils = trpc.useUtils();
  const createTag = trpc.tags.create.useMutation({
    onSuccess: () => { utils.tags.list.invalidate(); setAddingTag(false); },
  });
  const updateTag = trpc.tags.update.useMutation({
    onSuccess: () => { utils.tags.list.invalidate(); setEditingTagId(null); },
  });
  const deleteTag = trpc.tags.delete.useMutation({
    onSuccess: () => { utils.tags.list.invalidate(); setDeletingTagId(null); },
  });

  const createLabel = trpc.labels.create.useMutation({
    onSuccess: () => { utils.labels.list.invalidate(); setAddingLabel(false); },
  });
  const updateLabel = trpc.labels.update.useMutation({
    onSuccess: () => { utils.labels.list.invalidate(); setEditingLabelId(null); },
  });
  const deleteLabel = trpc.labels.delete.useMutation({
    onSuccess: () => { utils.labels.list.invalidate(); setDeletingLabelId(null); },
  });

  const deletingTag = tags?.find((t) => t.id === deletingTagId);
  const deletingLabel = labels?.find((l) => l.id === deletingLabelId);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleWrapper}>
          <button onClick={() => router.back()} className={styles.backButton}>
            <ArrowLeft size={18} />
          </button>
          <h1 className={styles.title}>
            <TagIcon size={22} />
            จัดการแท็กและป้ายกำกับ
          </h1>
        </div>
      </div>

      <div className={styles.content}>

        {/* ── Tags Section ── */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleWrap}>
              <div className={`${styles.sectionIcon} ${styles.sectionIconTag}`}>
                <TagIcon size={16} />
              </div>
              <div>
                <h2 className={styles.sectionTitle}>แท็ก (Tags)</h2>
                <p className={styles.sectionDesc}>จัดกลุ่มผู้ติดต่อ เช่น VIP, สนใจสินค้า</p>
              </div>
            </div>
            <button
              className={styles.addButton}
              onClick={() => { setAddingTag(true); setEditingTagId(null); }}
              disabled={addingTag}
            >
              <Plus size={16} />
              <span>สร้างแท็ก</span>
            </button>
          </div>

          {addingTag && (
            <InlineForm
              placeholder="ชื่อแท็กใหม่ เช่น VIP, สนใจสินค้า"
              onSave={(name, color) => {
                if (!accountId) return;
                createTag.mutate({ name, color, lineAccountId: accountId });
              }}
              onCancel={() => setAddingTag(false)}
              isPending={createTag.isPending}
            />
          )}

          {tagsLoading ? (
            <div className={styles.loadingList}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={styles.shimmerRow}>
                  <div className={styles.shimmerDot} />
                  <div className={styles.shimmerText} />
                </div>
              ))}
            </div>
          ) : !tags?.length && !addingTag ? (
            <div className={styles.empty}>
              <TagIcon size={32} strokeWidth={1.5} />
              <p>ยังไม่มีแท็ก</p>
              <span>สร้างแท็กเพื่อจัดกลุ่มผู้ติดต่อ</span>
            </div>
          ) : (
            <ul className={styles.list}>
              {tags?.map((tag) =>
                editingTagId === tag.id ? (
                  <li key={tag.id} className={styles.item}>
                    <InlineForm
                      initialName={tag.name}
                      initialColor={tag.color}
                      placeholder="แก้ไขชื่อแท็ก"
                      onSave={(name, color) => updateTag.mutate({ id: tag.id, name, color })}
                      onCancel={() => setEditingTagId(null)}
                      isPending={updateTag.isPending}
                    />
                  </li>
                ) : (
                  <li key={tag.id} className={styles.item}>
                    <div className={styles.itemLeft}>
                      <div className={styles.tagChip} style={{ backgroundColor: `${tag.color}18`, color: tag.color, borderColor: `${tag.color}30` }}>
                        <div className={styles.colorDotSmall} style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </div>
                      <span className={styles.itemCount}>
                        {(tag as any)._count?.contacts || 0} ผู้ติดต่อ
                      </span>
                    </div>
                    <div className={styles.itemActions}>
                      <button
                        className={styles.actionButton}
                        onClick={() => { setEditingTagId(tag.id); setAddingTag(false); }}
                        title="แก้ไข"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        className={`${styles.actionButton} ${styles.delete}`}
                        onClick={() => setDeletingTagId(tag.id)}
                        title="ลบ"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                )
              )}
            </ul>
          )}
        </div>

        {/* ── Labels Section ── */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleWrap}>
              <div className={`${styles.sectionIcon} ${styles.sectionIconLabel}`}>
                <LabelIcon size={16} />
              </div>
              <div>
                <h2 className={styles.sectionTitle}>ป้ายกำกับ (Labels)</h2>
                <p className={styles.sectionDesc}>จัดหมวดบทสนทนา เช่น สำคัญ, รอโอน</p>
              </div>
            </div>
            <button
              className={styles.addButton}
              onClick={() => { setAddingLabel(true); setEditingLabelId(null); }}
              disabled={addingLabel}
            >
              <Plus size={16} />
              <span>สร้างป้ายกำกับ</span>
            </button>
          </div>

          {addingLabel && (
            <InlineForm
              initialColor="#10b981"
              placeholder="ชื่อป้ายกำกับใหม่ เช่น สำคัญ, รอโอน"
              onSave={(name, color) => {
                if (!accountId) return;
                createLabel.mutate({ name, color, lineAccountId: accountId });
              }}
              onCancel={() => setAddingLabel(false)}
              isPending={createLabel.isPending}
            />
          )}

          {labelsLoading ? (
            <div className={styles.loadingList}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={styles.shimmerRow}>
                  <div className={styles.shimmerDot} />
                  <div className={styles.shimmerText} />
                </div>
              ))}
            </div>
          ) : !labels?.length && !addingLabel ? (
            <div className={styles.empty}>
              <LabelIcon size={32} strokeWidth={1.5} />
              <p>ยังไม่มีป้ายกำกับ</p>
              <span>สร้างป้ายกำกับเพื่อจัดหมวดบทสนทนา</span>
            </div>
          ) : (
            <ul className={styles.list}>
              {labels?.map((label) =>
                editingLabelId === label.id ? (
                  <li key={label.id} className={styles.item}>
                    <InlineForm
                      initialName={label.name}
                      initialColor={label.color}
                      placeholder="แก้ไขชื่อป้ายกำกับ"
                      onSave={(name, color) => updateLabel.mutate({ id: label.id, name, color })}
                      onCancel={() => setEditingLabelId(null)}
                      isPending={updateLabel.isPending}
                    />
                  </li>
                ) : (
                  <li key={label.id} className={styles.item}>
                    <div className={styles.itemLeft}>
                      <div className={styles.tagChip} style={{ backgroundColor: `${label.color}18`, color: label.color, borderColor: `${label.color}30` }}>
                        <div className={styles.colorDotSmall} style={{ backgroundColor: label.color }} />
                        {label.name}
                      </div>
                      <span className={styles.itemCount}>
                        {(label as any)._count?.conversations || 0} บทสนทนา
                      </span>
                    </div>
                    <div className={styles.itemActions}>
                      <button
                        className={styles.actionButton}
                        onClick={() => { setEditingLabelId(label.id); setAddingLabel(false); }}
                        title="แก้ไข"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        className={`${styles.actionButton} ${styles.delete}`}
                        onClick={() => setDeletingLabelId(label.id)}
                        title="ลบ"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                )
              )}
            </ul>
          )}
        </div>
      </div>

      {/* ── Delete Confirm Dialogs ── */}
      {deletingTagId && deletingTag && (
        <ConfirmDialog
          message={`ลบแท็ก "${deletingTag.name}" ใช่ไหม? ผู้ติดต่อทั้งหมดที่ติดแท็กนี้จะถูกนำแท็กออก`}
          onConfirm={() => deleteTag.mutate({ id: deletingTagId })}
          onCancel={() => setDeletingTagId(null)}
          isPending={deleteTag.isPending}
        />
      )}
      {deletingLabelId && deletingLabel && (
        <ConfirmDialog
          message={`ลบป้ายกำกับ "${deletingLabel.name}" ใช่ไหม? บทสนทนาทั้งหมดที่ติดป้ายนี้จะถูกนำออก`}
          onConfirm={() => deleteLabel.mutate({ id: deletingLabelId })}
          onCancel={() => setDeletingLabelId(null)}
          isPending={deleteLabel.isPending}
        />
      )}
    </div>
  );
}
