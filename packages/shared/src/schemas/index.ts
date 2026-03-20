import { z } from 'zod';

/** Cursor-based pagination input */
export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

/** Search input */
export const searchInputSchema = z.object({
  query: z.string().min(1).max(500),
  conversationId: z.string().optional(),
  messageType: z.enum([
    'TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE',
    'STICKER', 'LOCATION', 'FLEX', 'TEMPLATE', 'UNKNOWN',
  ]).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

/** Send text message input */
export const sendTextMessageSchema = z.object({
  conversationId: z.string().min(1),
  text: z.string().min(1).max(5000),
});

/** Conversation filters */
export const conversationFilterSchema = z.object({
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'BLOCKED']).optional(),
});

/** Note input */
export const noteInputSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1).max(10000),
});

/** Update conversation input */
export const updateConversationSchema = z.object({
  conversationId: z.string().min(1),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
export type SearchInput = z.infer<typeof searchInputSchema>;
export type SendTextMessageInput = z.infer<typeof sendTextMessageSchema>;
export type ConversationFilter = z.infer<typeof conversationFilterSchema>;
export type NoteInput = z.infer<typeof noteInputSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
