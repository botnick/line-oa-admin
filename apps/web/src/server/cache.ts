import { redis } from './redis';

/**
 * Standardized caching utility to intercept expensive DB queries
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  forceRefresh = false
): Promise<T> {
  if (!forceRefresh) {
    const cached = await redis.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch (err) {
        console.error(`[cache] Failed to parse cached data for key ${key}`, err);
        // Fallthrough to fetcher
      }
    }
  }

  const data = await fetcher();
  
  try {
    // Only cache if data is valid (not undefined)
    if (data !== undefined) {
      // Use setex for atomic SET + EXPIRE
      await redis.setex(key, ttlSeconds, JSON.stringify(data));
    }
  } catch (err) {
    console.error(`[cache] Failed to set cache for key ${key}`, err);
  }

  return data;
}

/**
 * Invalidate cache by pattern.
 * Note: Uses KEYS which is O(N). Safe for limited admin usage and small patterns.
 */
export async function invalidateCache(pattern: string) {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.error(`[cache] Failed to invalidate pattern ${pattern}`, err);
  }
}
