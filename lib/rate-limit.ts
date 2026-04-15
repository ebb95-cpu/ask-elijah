import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

const cache: Record<string, Ratelimit> = {}

function getLimiter(prefix: string, limit: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`) {
  const key = `${prefix}:${limit}:${window}`
  if (cache[key]) return cache[key]
  const redis = getRedis()
  if (!redis) return null
  cache[key] = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix,
  })
  return cache[key]
}

/**
 * Check a rate limit. Returns { success } — always resolves.
 * If Upstash isn't configured or fails, the request is ALLOWED (fail-open)
 * so we don't break prod if Redis goes down.
 */
export async function checkLimit(
  prefix: string,
  id: string,
  limit: number,
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`
): Promise<{ success: boolean; reset?: number }> {
  const limiter = getLimiter(prefix, limit, window)
  if (!limiter) return { success: true }
  try {
    const res = await limiter.limit(id)
    return { success: res.success, reset: res.reset }
  } catch (err) {
    console.warn(`[rate-limit:${prefix}] unavailable, allowing:`, err)
    return { success: true }
  }
}
