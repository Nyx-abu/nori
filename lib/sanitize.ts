// Phase 3 decision: native sanitization (no zod) — strip HTML, normalize whitespace, cap length. Keeps runtime small for the MVP.
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g
const HTML_ENTITY = /&(?:#x?[0-9a-fA-F]+|[a-zA-Z]+);/g

export function sanitizeQuery(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(HTML_TAG, ' ')
    .replace(HTML_ENTITY, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export function isValidSlug(input: unknown): input is string {
  return typeof input === 'string' && /^[a-z0-9][a-z0-9-]{0,80}$/.test(input)
}

export function clampPage(input: unknown, fallback = 1): number {
  const n = typeof input === 'string' ? parseInt(input, 10) : Number(input)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(n, 1000)
}

export function clampLimit(input: unknown, fallback = 20, max = 50): number {
  const n = typeof input === 'string' ? parseInt(input, 10) : Number(input)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(n, max)
}
