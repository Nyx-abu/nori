// Upstash Redis is HTTP/fetch-based (no native binaries, no persistent connections).
// All call sites must tolerate Redis being absent — we fall back to a no-op shim so
// missing/expired credentials never break a request path. Use cached() for the common
// read-through pattern; reach for the lower-level client only when you need MULTI/etc.
import { Redis } from '@upstash/redis'

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
 * Stable, collision-resistant hash for cache keys built from user-controlled query strings
 * and filter objects. djb2 is sufficient for cache keying (we only need bucketing, not
 * cryptographic strength). Output is hex, prefixed length-limited at 16 chars.
 */
export function stableHash(input: unknown): string {
  const s = typeof input === 'string' ? input : JSON.stringify(input)
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
