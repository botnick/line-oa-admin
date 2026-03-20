'use client';

import { MessageCircle } from 'lucide-react';
import { EmptyState } from '@/components/ui';

/**
 * Inbox page (root of /inbox).
 * On Mobile: This component is rendered but hidden by layout CSS.
 * On Desktop: This sits in the main area when no chat is selected.
 */
export default function InboxClient() {
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <EmptyState
        icon={MessageCircle}
        title="LINE OA Admin"
        description="เลือกช่องแชทซ้ายมือเพื่อเริ่มต้นการสนทนา"
      />
    </div>
  );
}
