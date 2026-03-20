/**
 * Group consecutive IMAGE messages from the same source sent within 5 seconds.
 * Returns a mixed array of single messages and image groups.
 */

export interface MessageItem {
  id: string;
  source: 'INBOUND' | 'OUTBOUND';
  type: string;
  textContent?: string | null;
  metadata?: any;
  stickerPackageId?: string | null;
  stickerId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  createdAt: Date | string;
  deliveryStatus?: string | null;
  sentByName?: string | null;
  attachments?: {
    id: string;
    type: string;
    processingStatus: string;
    r2KeyThumbnail?: string | null;
    r2KeyPreview?: string | null;
    thumbnailUrl?: string | null;
    previewUrl?: string | null;
    originalUrl?: string | null;
    originalWidth?: number | null;
    originalHeight?: number | null;
    durationMs?: number | null;
  }[];
}

export interface GroupedItem {
  type: 'single' | 'image-group';
  messages: MessageItem[];
}

const GROUP_THRESHOLD_MS = 5000; // 5 seconds
const MAX_GROUP_SIZE = 10;

/**
 * Groups consecutive IMAGE messages from the same source within 5s window.
 * Non-image messages are returned as single items.
 */
export function groupMessages(messages: MessageItem[]): GroupedItem[] {
  const result: GroupedItem[] = [];
  let currentGroup: MessageItem[] = [];

  const flushGroup = () => {
    if (currentGroup.length === 0) return;
    if (currentGroup.length === 1) {
      result.push({ type: 'single', messages: [currentGroup[0]] });
    } else {
      result.push({ type: 'image-group', messages: [...currentGroup] });
    }
    currentGroup = [];
  };

  for (const msg of messages) {
    if (msg.type !== 'IMAGE') {
      flushGroup();
      result.push({ type: 'single', messages: [msg] });
      continue;
    }

    // It's an IMAGE message
    if (currentGroup.length === 0) {
      currentGroup.push(msg);
      continue;
    }

    const lastMsg = currentGroup[currentGroup.length - 1];
    const lastTime = new Date(lastMsg.createdAt).getTime();
    const curTime = new Date(msg.createdAt).getTime();
    const sameSource = msg.source === lastMsg.source;
    const withinThreshold = Math.abs(curTime - lastTime) <= GROUP_THRESHOLD_MS;
    const underMax = currentGroup.length < MAX_GROUP_SIZE;

    if (sameSource && withinThreshold && underMax) {
      currentGroup.push(msg);
    } else {
      flushGroup();
      currentGroup.push(msg);
    }
  }

  flushGroup();
  return result;
}
