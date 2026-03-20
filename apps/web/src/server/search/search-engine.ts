import { Prisma } from '@line-oa/db';
import { prisma } from '@line-oa/db';
import { normalizeText } from './normalize';

export type SearchScope = 'all' | 'contacts' | 'messages';

export interface SearchOptions {
  limit?: number;
  lineAccountId?: string;
  scope?: SearchScope;
}

export interface UnifiedSearchResult {
  type: 'contact' | 'message' | 'conversation';
  id: string; // contactId or messageId
  title: string;
  subtitle: string | null;
  matchedField: string;
  score: number;
  timestamp: string | null;
  conversationId: string | null;
  contactId: string | null;
  avatarR2Key: string | null;
  pictureUrl: string | null;
  lineAccountId: string | null;
  snippet: string | null;
}

/**
 * Executes a unified search across contacts and messages using PostgreSQL's
 * pg_trgm and full-text search capabilities for ranked, scored results.
 */
export async function unifiedSearch(
  query: string,
  options: SearchOptions = {}
): Promise<UnifiedSearchResult[]> {
  const { limit = 20, lineAccountId, scope = 'all' } = options;
  const normalizedQuery = normalizeText(query);
  const words = normalizedQuery.split(' ').filter(Boolean);
  
  if (!normalizedQuery || words.length === 0) {
    return [];
  }

  // Create tsquery syntax for full-text search (e.g. 'word1 & word2:*')
  const tsQueryString = words.map((w, i) => i === words.length - 1 ? `${w}:*` : w).join(' & ');
  const exactQuery = `%${normalizedQuery}%`;

  const searchResults: UnifiedSearchResult[] = [];

  // ==========================================
  // 1. Search Contacts
  // ==========================================
  if (scope === 'all' || scope === 'contacts') {
    try {
      const accountFilter = lineAccountId
        ? Prisma.sql`AND c.id IN (SELECT "contact_id" FROM "conversations" WHERE "line_account_id" = ${lineAccountId})`
        : Prisma.empty;

      // Try advanced search with pg_trgm similarity scoring
      const contactsQuery = Prisma.sql`
        SELECT 
          c.id, 
          c.display_name AS "displayName",
          c.picture_url AS "pictureUrl",
          c.avatar_r2_key AS "avatarR2Key",
          c.line_user_id AS "lineUserId",
          conv.id AS "conversationId",
          conv.line_account_id AS "lineAccountId",
          conv.last_message_at AS "timestamp",
          conv.last_message_text AS "lastMessageText",
          (
            CASE 
              WHEN LOWER(c.display_name) = ${normalizedQuery} THEN 100
              WHEN c.display_name_normalized = ${normalizedQuery} THEN 70
              WHEN c.display_name ILIKE ${exactQuery} THEN 50
              ELSE COALESCE(similarity(c.display_name_normalized, ${normalizedQuery}), 0) * 30
            END
          ) AS score
        FROM "contacts" c
        LEFT JOIN "conversations" conv ON c.id = conv.contact_id 
          ${lineAccountId ? Prisma.sql`AND conv.line_account_id = ${lineAccountId}` : Prisma.empty}
        WHERE (
          c.display_name ILIKE ${exactQuery}
          OR c.display_name_normalized % ${normalizedQuery}
        )
        ${accountFilter}
        ORDER BY score DESC
        LIMIT ${limit}
      `;

      const contacts = await prisma.$queryRaw<any[]>(contactsQuery);

      for (const c of contacts) {
        searchResults.push({
          type: 'contact',
          id: c.id,
          title: c.displayName || c.lineUserId || 'Unknown Contact',
          subtitle: c.lastMessageText || null,
          matchedField: 'Contact Name',
          score: Number(c.score) || 0,
          timestamp: c.timestamp ? new Date(c.timestamp).toISOString() : null,
          conversationId: c.conversationId || null,
          contactId: c.id,
          avatarR2Key: c.avatarR2Key || null,
          pictureUrl: c.pictureUrl || null,
          lineAccountId: c.lineAccountId || null,
          snippet: c.displayName,
        });
      }
    } catch (err) {
      // Fallback: pg_trgm might not be enabled — use simple ILIKE
      console.warn('[Search] pg_trgm contact search failed, falling back to ILIKE:', (err as Error).message);
      const fallbackContacts = await prisma.contact.findMany({
        where: { displayName: { contains: query, mode: 'insensitive' } },
        take: limit,
        include: {
          conversations: {
            take: 1,
            orderBy: { lastMessageAt: 'desc' },
            select: { id: true, lineAccountId: true, lastMessageAt: true, lastMessageText: true },
          },
        },
      });
      for (const c of fallbackContacts) {
        const conv = c.conversations[0];
        searchResults.push({
          type: 'contact',
          id: c.id,
          title: c.displayName || c.lineUserId || 'Unknown',
          subtitle: conv?.lastMessageText || null,
          matchedField: 'Contact Name',
          score: 40,
          timestamp: conv?.lastMessageAt ? new Date(conv.lastMessageAt).toISOString() : null,
          conversationId: conv?.id || null,
          contactId: c.id,
          avatarR2Key: c.avatarR2Key || null,
          pictureUrl: c.pictureUrl || null,
          lineAccountId: conv?.lineAccountId || null,
          snippet: c.displayName,
        });
      }
    }
  }

  // ==========================================
  // 2. Search Messages
  // ==========================================
  if (scope === 'all' || scope === 'messages') {
    try {
      const accountFilterMsgs = lineAccountId
        ? Prisma.sql`AND m.line_account_id = ${lineAccountId}`
        : Prisma.empty;

      // Try advanced search with tsvector + trigram similarity scoring
      const messagesQuery = Prisma.sql`
        SELECT 
          m.id, 
          m.text_content AS "textContent",
          m.created_at AS "createdAt",
          m.conversation_id AS "conversationId",
          m.line_account_id AS "lineAccountId",
          m.source,
          m.sent_by_name AS "sentByName",
          c.id AS "contactId",
          c.display_name AS "contactName",
          c.picture_url AS "pictureUrl",
          c.avatar_r2_key AS "avatarR2Key",
          (
            CASE 
              WHEN m.text_normalized = ${normalizedQuery} THEN 90
              ELSE 
                (COALESCE(ts_rank(m.search_vector, to_tsquery('simple', ${tsQueryString})), 0) * 80) +
                (COALESCE(similarity(m.text_normalized, ${normalizedQuery}), 0) * 20)
            END
          ) AS score
        FROM "messages" m
        JOIN "conversations" conv ON m.conversation_id = conv.id
        JOIN "contacts" c ON conv.contact_id = c.id
        WHERE (
          m.search_vector @@ to_tsquery('simple', ${tsQueryString})
          OR m.text_normalized % ${normalizedQuery}
        )
        AND m.type = 'TEXT'
        ${accountFilterMsgs}
        ORDER BY score DESC
        LIMIT ${limit}
      `;

      const messages = await prisma.$queryRaw<any[]>(messagesQuery);

      for (const m of messages) {
        if (Number(m.score) < 5) continue;

        searchResults.push({
          type: 'message',
          id: m.id,
          title: m.source === 'OUTBOUND' ? (m.sentByName || 'LINE OA') : (m.contactName || 'Unknown'),
          subtitle: null,
          matchedField: 'Message Text',
          score: Number(m.score) || 0,
          timestamp: m.createdAt ? new Date(m.createdAt).toISOString() : null,
          conversationId: m.conversationId,
          contactId: m.contactId,
          avatarR2Key: m.avatarR2Key || null,
          pictureUrl: m.pictureUrl || null,
          lineAccountId: m.lineAccountId,
          snippet: getSnippet(m.textContent, words),
        });
      }
    } catch (err) {
      // Fallback: tsvector/pg_trgm might not be available — use simple ILIKE
      console.warn('[Search] Advanced message search failed, falling back to ILIKE:', (err as Error).message);
      const fallbackMsgs = await prisma.message.findMany({
        where: {
          textContent: { contains: query, mode: 'insensitive' },
          type: 'TEXT',
          ...(lineAccountId ? { lineAccountId } : {}),
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          conversation: {
            include: {
              contact: { select: { id: true, displayName: true, pictureUrl: true, avatarR2Key: true } },
            },
          },
        },
      });
      for (const m of fallbackMsgs) {
        searchResults.push({
          type: 'message',
          id: m.id,
          title: m.source === 'OUTBOUND' ? (m.sentByName || 'LINE OA') : (m.conversation?.contact?.displayName || 'Unknown'),
          subtitle: null,
          matchedField: 'Message Text',
          score: 40,
          timestamp: m.createdAt ? new Date(m.createdAt).toISOString() : null,
          conversationId: m.conversationId,
          contactId: m.conversation?.contact?.id || null,
          avatarR2Key: m.conversation?.contact?.avatarR2Key || null,
          pictureUrl: m.conversation?.contact?.pictureUrl || null,
          lineAccountId: m.lineAccountId,
          snippet: getSnippet(m.textContent, words),
        });
      }
    }
  }

  // ==========================================
  // 3. Merge, Sort, and Truncate
  // ==========================================
  searchResults.sort((a, b) => b.score - a.score);
  
  // Deduplicate conversations (if we matched a contact AND a message in that interaction, 
  // we might want to group them or just return the highest scoring one for that conversation).
  // For now, we return all distinct hits up to the limit.

  return searchResults.slice(0, limit);
}

/**
 * Creates a short snippet around the matched terms
 */
function getSnippet(text: string | null, words: string[]): string {
  if (!text) return '';
  const lowerText = text.toLowerCase();
  
  let firstMatchIndex = -1;
  for (const word of words) {
    const idx = lowerText.indexOf(word);
    if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
      firstMatchIndex = idx;
    }
  }

  if (firstMatchIndex === -1) {
    return text.substring(0, 100) + (text.length > 100 ? '...' : '');
  }

  const start = Math.max(0, firstMatchIndex - 40);
  const end = Math.min(text.length, firstMatchIndex + 60);
  
  let snippet = text.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  
  return snippet;
}
