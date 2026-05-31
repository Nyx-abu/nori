// Upstash Redis is HTTP/fetch-based (no native binaries, no persistent connections).
// All call sites must tolerate Redis being absent — we fall back to a no-op shim so
// missing/expired credentials never break a request path. Use cached() for the common
// read-through pattern; reach for the lower-level client only when you need MULTI/etc.
import { Redis } from '@upstash/redis'
import { createHash } from 'crypto'

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

let _client: Redis | null = null
function client(): Redis | null {
  if (_client) return _client
  if (!url || !token) return null
  _client = new Redis({ url, token })
  return _client
}

export function isRedisConfigured(): boolean {
  return Boolean(url && token)
}

/**
 * Get a JSON value by key. Returns null on miss, parse failure, or any transport error.
 * Upstash returns parsed objects directly when stored as JSON — we don't double-parse.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const c = client()
  if (!c) return null
  try {
    const v = await c.get<T>(key)
    return (v as T | null) ?? null
  } catch (e) {
    console.warn('[redis] get failed for', key, '—', e instanceof Error ? e.message : String(e))
    return null
  }
}

/**
 * Set a JSON value with a TTL in seconds. Fire-and-forget: returns true on success, false on
 * any error. Callers should not await this when serving cache misses on the hot path —
 * `void cacheSet(...)` is fine.
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
  const c = client()
  if (!c) return false
  try {
    await c.set(key, value, { ex: Math.max(1, Math.floor(ttlSeconds)) })
    return true
  } catch (e) {
    console.warn('[redis] set failed for', key, '—', e instanceof Error ? e.message : String(e))
    return false
  }
}

export async function cacheDel(key: string): Promise<void> {
  const c = client()
  if (!c) return
  try {
    await c.del(key)
  } catch {
    // best-effort delete
  }
}

/**
 * Stable hash for cache keys built from user-controlled query strings and filter objects.
 * 16 hex chars = 64 bits of entropy → birthday collisions kick in around ~4B distinct
 * inputs, vs ~65k for the previous djb2 32-bit hash. Cache-key cross-contamination
 * between unrelated queries is the failure mode we're guarding against, not adversarial
 * collisions, so a truncated SHA-256 is the cheap fit.
 */
export function stableHash(input: unknown): string {
  const s = typeof input === 'string' ? input : JSON.stringify(input)
  return createHash('sha256').update(s).digest('hex').slice(0, 16)
}
