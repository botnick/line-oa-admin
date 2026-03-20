'use client';

import { useState, useCallback } from 'react';
import {
  X, User, Tag, StickyNote, Bookmark, Edit2, Check,
  Plus, Trash2, Clock, Globe, MessageSquare,
  UserCircle, MessagesSquare, UserPlus, UserMinus, History,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { ColorPickerPopover } from './ColorPicker';
import { formatRelative, formatDateTime } from '@/lib/dayjs';
import styles from './RightPanel.module.css';

interface RightPanelProps {
  conversationId: string;
  contactId: string;
  contactName: string;
  contactAvatar?: string | null;
  statusMessage?: string | null;
  language?: string | null;
  firstSeenAt?: string | Date;
  lastSeenAt?: string | Date;
  isFollowing?: boolean;
  unfollowedAt?: string | Date | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Right panel — contact profile, tags, labels, notes.
 */
export function RightPanel({
  conversationId,
  contactId,
  contactName,
  contactAvatar,
  statusMessage,
  language,
  firstSeenAt,
  lastSeenAt,
  isFollowing,
  unfollowedAt,
  isOpen,
  onClose,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<'tags' | 'labels' | 'notes' | 'history'>('tags');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(contactName);

  const utils = trpc.useUtils();
  const { data: conversation } = trpc.conversations.get.useQuery({ id: conversationId });
  const lineAccountId = conversation?.lineAccountId;

  const updateContactMut = trpc.contacts.update.useMutation({
    onSuccess: () => {
      setIsEditingName(false);
      utils.conversations.get.invalidate({ id: conversationId });
      utils.conversations.list.invalidate(); // to update sidebar if needed
    }
  });

  const handleUpdateName = useCallback(() => {
    if (editNameValue.trim() && editNameValue !== contactName) {
      updateContactMut.mutate({ id: contactId, displayName: editNameValue.trim() });
    } else {
      setIsEditingName(false);
    }
  }, [editNameValue, contactName, contactId, updateContactMut]);

  if (!isOpen) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>รายละเอียด</span>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* Profile card */}
      <div className={styles.profileCard}>
        <div className={styles.avatar}>
          {contactAvatar ? (
            <img src={contactAvatar} alt={contactName} className={styles.avatarImg} />
          ) : (
            <User size={32} />
          )}
        </div>

        {isEditingName ? (
          <div className={styles.editNameForm}>
            <input
              autoFocus
              className={styles.editNameInput}
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
              onBlur={handleUpdateName}
            />
          </div>
        ) : (
          <div className={styles.nameRow}>
            <h3 className={styles.contactName}>{contactName}</h3>
            <button className={styles.editNameBtn} onClick={() => { setEditNameValue(contactName); setIsEditingName(true); }}>
              <Edit2 size={12} />
            </button>
          </div>
        )}
        {statusMessage && (
          <p className={styles.statusMessage}>{statusMessage}</p>
        )}
        <div className={styles.metaRow}>
          <Globe size={12} />
          <span>{language || 'ไม่ระบุ'}</span>
        </div>
        <div className={styles.metaRow}>
          <Clock size={12} />
          <span>เห็นล่าสุด {lastSeenAt ? formatRelative(new Date(lastSeenAt)) : '-'}</span>
        </div>
        <div className={styles.metaRow}>
          <MessageSquare size={12} />
          <span>เริ่มติดต่อ {firstSeenAt ? formatDateTime(new Date(firstSeenAt)) : '-'}</span>
        </div>

        {/* Follow status */}
        <div className={`${styles.followStatus} ${isFollowing === false ? styles.followStatusInactive : styles.followStatusActive}`}>
          {isFollowing === false ? (
            <>
              <UserMinus size={13} />
              <span>เลิกติดตาม</span>
              {unfollowedAt && (
                <span className={styles.followDate}>
                  {formatDateTime(new Date(unfollowedAt))}
                </span>
              )}
            </>
          ) : (
            <>
              <UserPlus size={13} />
              <span>กำลังติดตาม</span>
              {unfollowedAt && (
                <span className={styles.followHint}>
                  (เคยเลิกติดตาม {formatRelative(new Date(unfollowedAt))})
                </span>
              )}
            </>
          )}
        </div>

      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['tags', 'labels', 'notes', 'history'] as const).map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'tags' && <Tag size={14} />}
            {tab === 'labels' && <Bookmark size={14} />}
            {tab === 'notes' && <StickyNote size={14} />}
            {tab === 'history' && <History size={14} />}
            {tab === 'tags' ? 'แท็ก' : tab === 'labels' ? 'ป้ายกำกับ' : tab === 'notes' ? 'บันทึก' : 'ประวัติ'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={styles.tabContent}>
        {activeTab === 'tags' && (
          <TagsSection contactId={contactId} lineAccountId={lineAccountId} />
        )}
        {activeTab === 'labels' && (
          <LabelsSection conversationId={conversationId} lineAccountId={lineAccountId} />
        )}
        {activeTab === 'notes' && (
          <NotesSection conversationId={conversationId} />
        )}
        {activeTab === 'history' && (
          <FollowHistoryTab contactId={contactId} />
        )}
      </div>
    </div>
  );
}

/* ─── Tags Section (Contact-level) ─── */
function TagsSection({ contactId, lineAccountId }: { contactId: string, lineAccountId?: string }) {
  const [newTag, setNewTag] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const utils = trpc.useUtils();

  const { data: allTags = [] } = trpc.tags.list.useQuery({ lineAccountId });
  const { data: contactTags = [] } = trpc.tags.getForContact.useQuery({ contactId });
  const createMut = trpc.tags.create.useMutation({ onSuccess: () => utils.tags.invalidate() });
  const assignMut = trpc.tags.assign.useMutation({ onSuccess: () => utils.tags.invalidate() });
  const removeMut = trpc.tags.remove.useMutation({ onSuccess: () => utils.tags.invalidate() });

  const contactTagIds = new Set(contactTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !contactTagIds.has(t.id));

  const handleCreateAndAssign = useCallback(() => {
    const name = newTag.trim();
    if (!name) return;
    createMut.mutate({ name, color: newColor, lineAccountId }, {
      onSuccess: (tag) => {
        assignMut.mutate({ contactId, tagId: tag.id });
        setNewTag('');
      },
    });
  }, [newTag, newColor, contactId, lineAccountId, createMut, assignMut]);

  return (
    <div className={styles.section}>
      {/* Section description */}
      <div className={styles.sectionHeader}>
        <UserCircle size={14} />
        <span>แท็กผู้ติดต่อ</span>
      </div>
      <p className={styles.sectionHint}>
        ใช้จำแนกประเภทผู้ติดต่อ เช่น VIP, ลูกค้าใหม่
      </p>

      {/* Assigned tags — rounded pill badges */}
      <div className={styles.chipList}>
        {contactTags.map((tag) => (
          <span
            key={tag.id}
            className={styles.tagChip}
            style={{
              background: tag.color + '18',
              borderColor: tag.color + '40',
              color: tag.color,
            }}
          >
            <span className={styles.chipDot} style={{ background: tag.color }} />
            {tag.name}
            <button
              className={styles.chipRemove}
              onClick={() => removeMut.mutate({ contactId, tagId: tag.id })}
              style={{ color: tag.color }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      {/* Available tags to add */}
      {availableTags.length > 0 && (
        <div className={styles.addSection}>
          <span className={styles.addLabel}>เพิ่มแท็ก:</span>
          <div className={styles.chipList}>
            {availableTags.map((tag) => (
              <button
                key={tag.id}
                className={styles.tagChipAdd}
                style={{
                  borderColor: tag.color + '60',
                  color: tag.color,
                }}
                onClick={() => assignMut.mutate({ contactId, tagId: tag.id })}
              >
                <Plus size={10} /> {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create new tag with color picker */}
      <div className={styles.createForm}>
        <div className={styles.createFormRow}>
          <ColorPickerPopover value={newColor} onChange={setNewColor} size="sm" />
          <input
            className={styles.inlineInput}
            placeholder="สร้างแท็กใหม่..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAssign()}
          />
          <button
            className={styles.inlineBtn}
            onClick={handleCreateAndAssign}
            disabled={!newTag.trim()}
            style={{ background: newColor }}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Labels Section (Conversation-level) ─── */
function LabelsSection({ conversationId, lineAccountId }: { conversationId: string, lineAccountId?: string }) {
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#10b981');
  const utils = trpc.useUtils();

  const { data: allLabels = [] } = trpc.labels.list.useQuery({ lineAccountId });
  const { data: convLabels = [] } = trpc.labels.getForConversation.useQuery({ conversationId });
  const createMut = trpc.labels.create.useMutation({ onSuccess: () => utils.labels.invalidate() });
  const assignMut = trpc.labels.assign.useMutation({ onSuccess: () => utils.labels.invalidate() });
  const removeMut = trpc.labels.remove.useMutation({ onSuccess: () => utils.labels.invalidate() });

  const convLabelIds = new Set(convLabels.map((l) => l.id));
  const availableLabels = allLabels.filter((l) => !convLabelIds.has(l.id));

  const handleCreateAndAssign = useCallback(() => {
    const name = newLabel.trim();
    if (!name) return;
    createMut.mutate({ name, color: newColor, lineAccountId }, {
      onSuccess: (label) => {
        assignMut.mutate({ conversationId, labelId: label.id });
        setNewLabel('');
      },
    });
  }, [newLabel, newColor, conversationId, lineAccountId, createMut, assignMut]);

  return (
    <div className={styles.section}>
      {/* Section description */}
      <div className={styles.sectionHeader}>
        <MessagesSquare size={14} />
        <span>ป้ายกำกับแชท</span>
      </div>
      <p className={styles.sectionHint}>
        ใช้จัดระเบียบบทสนทนา เช่น รอชำระเงิน, ส่งสินค้าแล้ว
      </p>

      {/* Assigned labels — rectangular folder-label style */}
      <div className={styles.labelList}>
        {convLabels.map((label) => (
          <span
            key={label.id}
            className={styles.labelChip}
            style={{
              background: label.color,
              borderColor: label.color,
            }}
          >
            <Bookmark size={11} />
            {label.name}
            <button
              className={styles.labelRemove}
              onClick={() => removeMut.mutate({ conversationId, labelId: label.id })}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      {/* Available labels to add */}
      {availableLabels.length > 0 && (
        <div className={styles.addSection}>
          <span className={styles.addLabel}>เพิ่มป้ายกำกับ:</span>
          <div className={styles.labelList}>
            {availableLabels.map((label) => (
              <button
                key={label.id}
                className={styles.labelChipAdd}
                style={{
                  borderColor: label.color,
                  color: label.color,
                }}
                onClick={() => assignMut.mutate({ conversationId, labelId: label.id })}
              >
                <Plus size={10} /> {label.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create new label with color picker */}
      <div className={styles.createForm}>
        <div className={styles.createFormRow}>
          <ColorPickerPopover value={newColor} onChange={setNewColor} size="sm" />
          <input
            className={styles.inlineInput}
            placeholder="สร้างป้ายกำกับใหม่..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAssign()}
          />
          <button
            className={styles.inlineBtn}
            onClick={handleCreateAndAssign}
            disabled={!newLabel.trim()}
            style={{ background: newColor }}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Notes Section ─── */
function NotesSection({ conversationId }: { conversationId: string }) {
  const [draft, setDraft] = useState('');
  const utils = trpc.useUtils();

  const { data: notes = [] } = trpc.notes.list.useQuery({ conversationId });
  const createMut = trpc.notes.create.useMutation({ onSuccess: () => { utils.notes.invalidate(); setDraft(''); } });
  const deleteMut = trpc.notes.delete.useMutation({ onSuccess: () => utils.notes.invalidate() });

  return (
    <div className={styles.section}>
      {/* New note form */}
      <div className={styles.noteForm}>
        <textarea
          className={styles.noteTextarea}
          placeholder="เพิ่มบันทึก..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
        />
        <button
          className={styles.noteSubmit}
          onClick={() => createMut.mutate({ conversationId, content: draft })}
          disabled={!draft.trim()}
        >
          บันทึก
        </button>
      </div>

      {/* Notes list */}
      <div className={styles.notesList}>
        {notes.map((note) => (
          <div key={note.id} className={styles.noteCard}>
            <p className={styles.noteContent}>{note.content}</p>
            <div className={styles.noteMeta}>
              <span className={styles.noteDate}>
                {note.createdByName && <strong style={{ color: '#333' }}>{note.createdByName} • </strong>}
                {formatDateTime(new Date(note.createdAt))}
              </span>
              <button
                className={styles.noteDelete}
                onClick={() => deleteMut.mutate({ id: note.id })}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <p className={styles.emptyNote}>ยังไม่มีบันทึก</p>
        )}
      </div>
    </div>
  );
}

/** Follow history tab — timeline view */
function FollowHistoryTab({ contactId }: { contactId: string }) {
  const { data: logs, isLoading } = trpc.contacts.followHistory.useQuery(
    { contactId },
    { enabled: !!contactId },
  );

  const followCount = logs?.filter((l) => l.action === 'FOLLOW').length ?? 0;
  const unfollowCount = logs?.filter((l) => l.action === 'UNFOLLOW').length ?? 0;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <History size={14} />
        <span>ประวัติการติดตาม</span>
      </div>

      {/* Summary badges */}
      {logs && logs.length > 0 && (
        <div className={styles.histSummary}>
          <span className={styles.histBadgeGreen}>
            <UserPlus size={11} /> ติดตาม {followCount}
          </span>
          <span className={styles.histBadgeRed}>
            <UserMinus size={11} /> เลิกติดตาม {unfollowCount}
          </span>
        </div>
      )}

      {/* Timeline */}
      {isLoading && (
        <p className={styles.emptyNote}>กำลังโหลด...</p>
      )}

      {!isLoading && (!logs || logs.length === 0) && (
        <div className={styles.histEmpty}>
          <History size={28} strokeWidth={1.2} />
          <p>ยังไม่มีประวัติ</p>
          <span>ระบบจะบันทึกอัตโนมัติเมื่อผู้ใช้ติดตามหรือเลิกติดตาม</span>
        </div>
      )}

      {logs && logs.length > 0 && (
        <div className={styles.histTimeline}>
          {logs.map((log, i) => (
            <div key={log.id} className={styles.histTimelineItem}>
              <div className={styles.histTimelineTrack}>
                <div className={`${styles.histDot} ${log.action === 'FOLLOW' ? styles.histDotGreen : styles.histDotRed}`} />
                {i < logs.length - 1 && <div className={styles.histLine} />}
              </div>
              <div className={styles.histContent}>
                <div className={styles.histLabel}>
                  {log.action === 'FOLLOW' ? (
                    <><UserPlus size={12} className={styles.followIconGreen} /> ติดตาม</>
                  ) : (
                    <><UserMinus size={12} className={styles.followIconRed} /> เลิกติดตาม</>
                  )}
                </div>
                <span className={styles.histDate}>
                  {formatDateTime(new Date(log.createdAt))}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
