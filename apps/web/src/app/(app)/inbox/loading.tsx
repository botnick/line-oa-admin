import { InboxSkeleton } from '@/components/ui';

/**
 * Inbox loading state — shown while data is being fetched.
 */
export default function InboxLoading() {
  return <InboxSkeleton rows={10} />;
}
