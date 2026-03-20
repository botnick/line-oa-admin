import { redis } from './redis';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Basic fixed-window rate limiter using ioredis.
 * @param identifier Unique identifier for the client (e.g. IP address or user ID)
 * @param limit Maximum number of requests allowed in the window
 * @param windowSeconds Duration of the window in seconds
 */
export async function rateLimit(
  identifier: string,
  limit: number = 10,
  windowSeconds: number = 10
): Promise<RateLimitResult> {
  const currentWindow = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `ratelimit:${identifier}:${currentWindow}`;

  // Increment the request count for this window
  // Use a pipeline to also set an expiration if it's a new key
  const results = await redis.pipeline()
    .incr(key)
    .expire(key, windowSeconds * 2) // keep slightly longer than the window
    .exec();

  // Handle pipeline result
  const count = results?.[0]?.[1] as number || 1;
  const success = count <= limit;
  const remaining = Math.max(0, limit - count);
  const reset = (currentWindow + 1) * windowSeconds * 1000;

  return {
    success,
    limit,
    remaining,
    reset,
  };
}
