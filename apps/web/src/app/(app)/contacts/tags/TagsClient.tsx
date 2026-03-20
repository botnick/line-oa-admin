'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { ArrowLeft, Plus, Edit2, Trash2, Tag as TagIcon, Bookmark as LabelIcon } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { NoChannelAccess } from '@/components/ui/NoChannelAccess';
import { th } from '@/lib/thai';
import styles from './page.module.css';

export default function TagsClient() {
  const router = useRouter();
  const { accountId, hasAccess } = useWorkspace();

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
    onSuccess: () => utils.tags.list.invalidate(),
  });
  const updateTag = trpc.tags.update.useMutation({
    onSuccess: () => utils.tags.list.invalidate(),
  });
  const deleteTag = trpc.tags.delete.useMutation({
    onSuccess: () => utils.tags.list.invalidate(),
  });

  const createLabel = trpc.labels.create.useMutation({
    onSuccess: () => utils.labels.list.invalidate(),
  });
  const updateLabel = trpc.labels.update.useMutation({
    onSuccess: () => utils.labels.list.invalidate(),
  });
  const deleteLabel = trpc.labels.delete.useMutation({
    onSuccess: () => utils.labels.list.invalidate(),
  });

  // Simple prompt-based dialogs for MVP
  const handleAddTag = async () => {
    if (!accountId) return;
    const name = window.prompt('ใส่ชื่อแท็กใหม่ (เช่น VIP, สนใจสินค้า):');
    if (!name) return;
    const color = window.prompt('ใส่รหัสสี HEX (เช่น #ff0000) หรือปล่อยว่างเพื่อใช้สีสุ่ม:', '#3b82f6') || '#3b82f6';
    
    await createTag.mutateAsync({ name, color, lineAccountId: accountId });
  };

  const handleEditTag = async (tag: any) => {
    const name = window.prompt('แก้ไขชื่อแท็ก:', tag.name);
    if (!name) return;
    const color = window.prompt('แก้ไขรหัสสี HEX:', tag.color) || tag.color;
    
    await updateTag.mutateAsync({ id: tag.id, name, color });
  };

  const handleDeleteTag = async (id: string) => {
    if (window.confirm('คุณต้องการลบแท็กนี้ใช่หรือไม่? ผู้ติดต่อที่ติดแท็กนี้จะถูกนำแท็กออกทั้งหมด')) {
      await deleteTag.mutateAsync({ id });
    }
  };

  const handleAddLabel = async () => {
    if (!accountId) return;
    const name = window.prompt('ใส่ชื่อป้ายกำกับบทสนทนา (เช่น สำคัญสุด, รอโอน):');
    if (!name) return;
    const color = window.prompt('ใส่รหัสสี HEX (เช่น #10b981) หรือปล่อยว่างเพื่อใช้สีสุ่ม:', '#10b981') || '#10b981';
    
    await createLabel.mutateAsync({ name, color, lineAccountId: accountId });
  };

  const handleEditLabel = async (label: any) => {
    const name = window.prompt('แก้ไขชื่อป้ายกำกับ:', label.name);
    if (!name) return;
    const color = window.prompt('แก้ไขรหัสสี HEX:', label.color) || label.color;
    
    await updateLabel.mutateAsync({ id: label.id, name, color });
  };

  const handleDeleteLabel = async (id: string) => {
    if (window.confirm('คุณต้องการลบป้ายกำกับนี้ใช่หรือไม่? บทสนทนาที่ติดป้ายกำกับนี้จะถูกนำออกทั้งหมด')) {
      await deleteLabel.mutateAsync({ id });
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleWrapper}>
          <button onClick={() => router.back()} className={styles.backButton}>
            <ArrowLeft size={18} />
          </button>
          <h1 className={styles.title}>
            <TagIcon size={22} />
            {th.tags?.title || 'จัดการแท็กและป้ายกำกับ'}
          </h1>
        </div>
      </div>

      <div className={styles.content}>
        
        {/* Tags Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>แท็ก (Tags) - สำหรับผู้ติดต่อ</h2>
            <button className={styles.addButton} onClick={handleAddTag} disabled={createTag.isPending}>
              <Plus size={16} />
              {th.tags?.create || 'สร้างใหม่'}
            </button>
          </div>
          
          {tagsLoading ? (
            <div className={styles.empty}>กำลังโหลด...</div>
          ) : tags?.length === 0 ? (
            <div className={styles.empty}>ยังไม่มีแท็ก</div>
          ) : (
            <ul className={styles.list}>
              {tags?.map((tag) => (
                <li key={tag.id} className={styles.item}>
                  <div className={styles.itemLeft}>
                    <div className={styles.colorPreview} style={{ backgroundColor: tag.color }} />
                    <span className={styles.itemName}>{tag.name}</span>
                    <span className={styles.itemCount}>{(tag as any)._count?.contacts || 0} ผู้ติดต่อ</span>
                  </div>
                  <div className={styles.itemActions}>
                    <button className={styles.actionButton} onClick={() => handleEditTag(tag)}>
                      <Edit2 size={16} />
                    </button>
                    <button className={`${styles.actionButton} ${styles.delete}`} onClick={() => handleDeleteTag(tag.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Labels Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>ป้ายกำกับ (Labels) - สำหรับบทสนทนา</h2>
            <button className={styles.addButton} onClick={handleAddLabel} disabled={createLabel.isPending}>
              <Plus size={16} />
              {th.tags?.create || 'สร้างใหม่'}
            </button>
          </div>
          
          {labelsLoading ? (
            <div className={styles.empty}>กำลังโหลด...</div>
          ) : labels?.length === 0 ? (
            <div className={styles.empty}>ยังไม่มีป้ายกำกับ</div>
          ) : (
            <ul className={styles.list}>
              {labels?.map((label) => (
                <li key={label.id} className={styles.item}>
                  <div className={styles.itemLeft}>
                    <div className={styles.colorPreview} style={{ backgroundColor: label.color }} />
                    <span className={styles.itemName}>{label.name}</span>
                    <span className={styles.itemCount}>{(label as any)._count?.conversations || 0} บทสนทนา</span>
                  </div>
                  <div className={styles.itemActions}>
                    <button className={styles.actionButton} onClick={() => handleEditLabel(label)}>
                      <Edit2 size={16} />
                    </button>
                    <button className={`${styles.actionButton} ${styles.delete}`} onClick={() => handleDeleteLabel(label.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
