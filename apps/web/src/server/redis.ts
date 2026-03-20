import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Prevent multiple instances during hot-reload in development
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  subscriber: Redis | undefined;
};

// Main Redis client for issuing commands (Publish, queues, caching)
export const redis =
  globalForRedis.redis ||
  new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });

const globalForSubscriber = globalThis as unknown as {
  subscriber: Redis | undefined;
};

// Dedicated Redis client for Subscriptions (Pub/Sub)
export const subscriber =
  globalForSubscriber.subscriber ||
  new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
  globalForSubscriber.subscriber = subscriber;
}

// Global Pub/Sub Channels
export const CHANNELS = {
  SYNC: 'line:oa:sync',
} as const;

/**
 * Helper to securely publish a typed sync event
 */
export async function publishSyncEvent(
  type: 'NEW_MESSAGE' | 'MESSAGE_UPDATED' | 'CONVERSATION_UPDATED' | 'TAG_UPDATED' | 'LABEL_UPDATED' | 'CONTACT_UPDATED' | 'CONTACT_STATUS_CHANGE' | 'CHANNEL_ACCESS_UPDATED' | 'NEW_NOTIFICATION' | 'NOTIFICATION_UPDATED',
  payload: any
) {
  try {
    await redis.publish(CHANNELS.SYNC, JSON.stringify({ type, timestamp: Date.now(), payload }));
  } catch (error) {
    console.error('[redis] failed to publish sync event', error);
  }
}
