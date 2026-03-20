export type MessageSource = 'INBOUND' | 'OUTBOUND';

export type MessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'FILE'
  | 'STICKER'
  | 'LOCATION'
  | 'FLEX'
  | 'TEMPLATE'
  | 'UNKNOWN';

export type DeliveryStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED';

export type ProcessingStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export interface ConversationListItem {
  id: string;
  contactId: string;
  contactName: string | null;
  contactPictureUrl: string | null;
  isPinned: boolean;
  isArchived: boolean;
  unreadCount: number;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastMessageType: MessageType | null;
  lastMessageSource: MessageSource | null;
}

export interface MessageBubble {
  id: string;
  source: MessageSource;
  type: MessageType;
  textContent: string | null;
  deliveryStatus: DeliveryStatus;
  createdAt: string;
  lineTimestamp: string | null;
  stickerPackageId: string | null;
  stickerId: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  attachments: AttachmentInfo[];
}

export interface AttachmentInfo {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
  processingStatus: ProcessingStatus;
  originalFilename: string | null;
  originalMimeType: string | null;
  optimizedWidth: number | null;
  optimizedHeight: number | null;
  durationMs: number | null;
  thumbnailUrl?: string;
  previewUrl?: string;
  originalUrl?: string;
}

export interface ContactInfo {
  id: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  statusMessage: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface SearchResult {
  messageId: string;
  conversationId: string;
  contactName: string | null;
  textContent: string | null;
  highlightedSnippet: string | null;
  messageType: MessageType;
  createdAt: string;
  rank: number;
}
