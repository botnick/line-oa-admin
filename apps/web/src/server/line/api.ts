// LINE API Configuration

/**
 * LINE Messaging API client.
 * Wraps HTTP calls to the LINE Platform API.
 */

const LINE_API_BASE = 'https://api.line.me/v2/bot';
const LINE_DATA_API_BASE = 'https://api-data.line.me/v2/bot';

interface LineApiOptions {
  method?: string;
  body?: unknown;
  token: string;
}

/** Make authenticated request to LINE API */
async function lineRequest(path: string, options: LineApiOptions) {
  const { method = 'GET', body, token } = options;

  const res = await fetch(`${LINE_API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[LINE API] ${method} ${path} → ${res.status}: ${text}`);
    throw new Error(`LINE API Error: ${res.status}`);
  }

  // Some endpoints (e.g. /chat/markAsRead) return empty body
  const contentType = res.headers.get('content-type') || '';
  const contentLength = res.headers.get('content-length');
  if (contentLength === '0' || !contentType.includes('application/json')) {
    return {};
  }

  return res.json();
}

/** Get bot info (own user ID, basic ID) */
export async function getBotInfo(token: string) {
  return lineRequest(`/info`, { token }) as Promise<{
    userId: string;
    basicId: string;
    displayName: string;
    pictureUrl?: string;
  }>;
}

/** Get user profile */
export async function getProfile(userId: string, token: string) {
  return lineRequest(`/profile/${userId}`, { token }) as Promise<{
    userId: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
  }>;
}

/** Push message to user */
export async function pushMessage(to: string, messages: unknown[], token: string) {
  return lineRequest('/message/push', {
    method: 'POST',
    body: { to, messages },
    token,
  });
}

/** Reply to a message */
export async function replyMessage(replyToken: string, messages: unknown[], token: string) {
  return lineRequest('/message/reply', {
    method: 'POST',
    body: { replyToken, messages },
    token,
  });
}

/** Get media content (binary) from LINE */
export async function getContent(messageId: string, token: string): Promise<ArrayBuffer> {
  const res = await fetch(
    `${LINE_DATA_API_BASE}/message/${messageId}/content`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`LINE Content API Error: ${res.status}`);
  }

  return res.arrayBuffer();
}

/** Multicast — send messages to specific users (max 500) */
export async function multicastMessage(to: string[], messages: unknown[], token: string) {
  return lineRequest('/message/multicast', {
    method: 'POST',
    body: { to, messages },
    token,
  });
}

/** Broadcast — send messages to ALL followers */
export async function broadcastMessage(messages: unknown[], token: string) {
  return lineRequest('/message/broadcast', {
    method: 'POST',
    body: { messages },
    token,
  });
}

/**
 * Mark messages as read in LINE chat.
 * Requires Chat feature to be ON in LINE Official Account Manager.
 * Token comes from webhook message event's markAsReadToken property (never expires).
 */
export async function markAsRead(markAsReadToken: string, token: string) {
  return lineRequest('/chat/markAsRead', {
    method: 'POST',
    body: { markAsReadToken },
    token,
  });
}

