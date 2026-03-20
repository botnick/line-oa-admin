'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Shield, Trash2, Power, UserCheck, UserX, Settings2, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Tooltip } from '@/components/ui/Tooltip';
import styles from './page.module.css';
import dayjs from 'dayjs';

export function UsersClient() {
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [channelModalUser, setChannelModalUser] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  const utils = trpc.useUtils();

  const { data: me } = trpc.auth.me.useQuery();
  const { data: users, isPending } = trpc.users.list.useQuery(undefined, {
    retry: false,
    staleTime: 5000,
  });

  // Fetch all LINE accounts for the channel assignment modal (SUPER_ADMIN only)
  const { data: allLineAccounts } = trpc.lineAccounts.list.useQuery(undefined, {
    enabled: me?.role === 'SUPER_ADMIN',
    staleTime: 30000,
  });

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      setStatusMsg({ type: 'success', text: '✓ เปลี่ยนสิทธิ์ใช้งานสำเร็จ' });
      utils.users.list.invalidate();
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message });
    },
  });

  const toggleActiveMutation = trpc.users.toggleActive.useMutation({
    onSuccess: () => {
      setStatusMsg({ type: 'success', text: '✓ อัปเดตสถานะสำเร็จ' });
      utils.users.list.invalidate();
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message });
    },
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      setStatusMsg({ type: 'success', text: '✓ ลบบัญชีผู้ใช้สำเร็จ' });
      utils.users.list.invalidate();
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message });
    },
  });

  const updateChannelAccessMutation = trpc.users.updateChannelAccess.useMutation({
    onSuccess: () => {
      setStatusMsg({ type: 'success', text: '✓ อัปเดตสิทธิ์การเข้าถึงช่องทางสำเร็จ' });
      utils.users.list.invalidate();
      setChannelModalUser(null);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message });
    },
  });

  const isMutating = updateRoleMutation.isPending || toggleActiveMutation.isPending
    || deleteMutation.isPending || updateChannelAccessMutation.isPending;
  const isSuperAdmin = me?.role === 'SUPER_ADMIN';

  // ---------- Handlers ----------
  const handleToggleRole = (id: string, currentRole: string) => {
    if (!isSuperAdmin) return;
    updateRoleMutation.mutate({ id, role: currentRole === 'SUPER_ADMIN' ? 'ADMIN' : 'SUPER_ADMIN' });
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    if (!isSuperAdmin) return;
    toggleActiveMutation.mutate({ id, isActive: !currentActive });
  };

  const handleDelete = (id: string) => {
    if (!isSuperAdmin) return;
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีผู้ใช้นี้?\nการกระทำนี้ไม่สามารถย้อนกลับได้')) return;
    deleteMutation.mutate({ id });
  };

  /** Open the channel assignment modal for a user */
  const handleOpenChannelModal = (userId: string) => {
    const user = users?.find((u) => u.id === userId);
    if (!user) return;
    // Pre-select currently assigned channels
    const currentChannelIds = (user.channelAccess ?? []).map((ca: { lineAccountId: string }) => ca.lineAccountId);
    setSelectedChannels(currentChannelIds);
    setChannelModalUser(userId);
  };

  /** Toggle a channel in the selection */
  const handleToggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
  };

  /** Save channel assignments */
  const handleSaveChannels = () => {
    if (!channelModalUser) return;
    updateChannelAccessMutation.mutate({
      userId: channelModalUser,
      lineAccountIds: selectedChannels,
    });
  };

  const targetUser = users?.find((u) => u.id === channelModalUser);

  // ---------- Render ----------
  if (isPending) {
    return (
      <div className={styles.loadingWrapper}>
        <RefreshCw size={24} className={styles.spinner} />
        <span className={styles.loadingText}>กำลังตรวจสอบสิทธิ์...</span>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <Link href="/settings" className={styles.backBtn} aria-label="กลับสู่เมนูตั้งค่า">
            <ArrowLeft size={18} />
          </Link>
          <div className={styles.headerText}>
            <h1 className={styles.title}>จัดการผู้ใช้งาน (User Management)</h1>
            <p className={styles.subtitle}>กำหนดสิทธิ์และอนุมัติการเข้าถึงระบบ</p>
          </div>
        </header>

        {statusMsg && (
          <div
            className={`${styles.statusMsg} ${
              statusMsg.type === 'success' ? styles.statusSuccess : styles.statusError
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        {/* Users List */}
        <div className={styles.userList}>
          {users?.length === 0 ? (
            <div className={styles.emptyState}>
              <Shield size={48} className={styles.emptyIcon} />
              <h3 className={styles.emptyTitle}>ไม่มีผู้ใช้งาน</h3>
              <p className={styles.emptyText}>ไม่พบข้อมูลผู้ใช้งานในระบบ</p>
            </div>
          ) : (
            users?.map((user) => {
              const isSelf = user.id === me?.id;
              const userChannels = user.channelAccess ?? [];
              const isSuperAdminUser = user.role === 'SUPER_ADMIN';
              const hasNoChannels = userChannels.length === 0 && !isSuperAdminUser;
              
              return (
                <div key={user.id} className={styles.userCard}>
                  {user.pictureUrl ? (
                    <img src={String(user.pictureUrl)} alt={user.displayName ?? ''} className={styles.userAvatar} />
                  ) : (
                    <div className={styles.userAvatarPlaceholder}>
                      {user.displayName?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}

                  <div className={styles.userInfo}>
                    <h3 className={styles.userName}>
                      {user.displayName} {isSelf && <span className="text-xs text-gray-400 font-normal">(คุณ)</span>}
                    </h3>
                    <div className={styles.userMeta}>
                      <span className={user.role === 'SUPER_ADMIN' ? styles.roleSuperAdmin : styles.roleAdmin}>
                        {user.role}
                      </span>
                      <span className={user.isActive ? styles.statusActive : styles.statusInactive}>
                        {user.isActive ? 'เปิดใช้งานแล้ว' : 'รออนุมัติ / ระงับการใช้งาน'}
                      </span>
                      {user.lastLoginAt && (
                        <span className={styles.metaItem}>
                          <span className={styles.label}>ใช้งานล่าสุด:</span>
                          <span className={styles.value}>
                            {dayjs(user.lastLoginAt).format('D MMM YYYY HH:mm')}
                          </span>
                        </span>
                      )}
                    </div>
                    {/* Channel Badges */}
                    {isSuperAdmin && (
                      <div className={styles.channelBadges}>
                      {isSuperAdminUser ? (
                          <span className={`${styles.channelBadge} ${styles.channelBadgeAll}`}>ทุกช่องทาง</span>
                        ) : hasNoChannels ? (
                          <span className={`${styles.channelBadge} ${styles.channelBadgeDenied}`}>ไม่มีช่องทาง</span>
                        ) : (
                          userChannels.map((ca: { lineAccountId: string; lineAccount: { displayName: string | null } }) => (
                            <span key={ca.lineAccountId} className={styles.channelBadge}>
                              {ca.lineAccount.displayName || ca.lineAccountId}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {isSuperAdmin && (
                    <div className={styles.userActions}>
                      {/* Channel Access */}
                      {user.role !== 'SUPER_ADMIN' && (
                        <Tooltip content="กำหนดช่องทาง LINE OA">
                          <button
                            className={styles.actionBtn}
                            onClick={() => handleOpenChannelModal(user.id)}
                            disabled={isMutating}
                          >
                            <Settings2 size={16} />
                          </button>
                        </Tooltip>
                      )}

                      <Tooltip content={user.role === 'SUPER_ADMIN' ? 'ลดสิทธิ์เป็น ADMIN' : 'เลื่อนสิทธิ์เป็น SUPER_ADMIN'}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => handleToggleRole(user.id, user.role)}
                          disabled={isMutating || isSelf}
                        >
                          <Shield size={16} />
                        </button>
                      </Tooltip>

                      <Tooltip content={user.isActive ? 'ระงับบัญชี' : 'อนุมัติ/เปิดใช้งานบัญชี'}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => handleToggleActive(user.id, user.isActive)}
                          disabled={isMutating || isSelf}
                        >
                          {user.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                      </Tooltip>

                      <Tooltip content="ลบบัญชีผู้ใช้นี้">
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => handleDelete(user.id)}
                          disabled={isMutating || isSelf}
                        >
                          <Trash2 size={16} />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Channel Assignment Modal */}
      {channelModalUser && (
        <div className={styles.modalOverlay} onClick={() => setChannelModalUser(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                กำหนดช่องทาง — {targetUser?.displayName}
              </h2>
              <button className={styles.modalCloseBtn} onClick={() => setChannelModalUser(null)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalHint}>
                เลือกช่องทาง LINE OA ที่ต้องการให้ผู้ใช้นี้เข้าถึง
                <br />
                ⚠️ หากไม่เลือกเลย ผู้ใช้จะ<strong>ไม่สามารถเข้าถึงช่องทางใดๆ</strong> ได้
              </p>

              {allLineAccounts && allLineAccounts.length > 0 ? (
                allLineAccounts.map((acc) => (
                  <label key={acc.id} className={styles.channelCheckItem}>
                    <input
                      type="checkbox"
                      className={styles.channelCheckbox}
                      checked={selectedChannels.includes(acc.id)}
                      onChange={() => handleToggleChannel(acc.id)}
                    />
                    <span className={styles.channelCheckLabel}>
                      {acc.displayName || 'ไม่ระบุชื่อ'}
                    </span>
                    {acc.basicId && (
                      <span className={styles.channelCheckId}>{acc.basicId}</span>
                    )}
                  </label>
                ))
              ) : (
                <p className={styles.modalHint}>ยังไม่มีบัญชี LINE OA ในระบบ</p>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setChannelModalUser(null)}>
                ยกเลิก
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleSaveChannels}
                disabled={updateChannelAccessMutation.isPending}
              >
                {updateChannelAccessMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
