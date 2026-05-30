import { GoogleGenerativeAI, TaskType } from '@google/generative-ai'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey && process.env.NODE_ENV !== 'test') {
  // surfaced at first call, not at import — keeps build-time imports cheap
}

let cachedClient: GoogleGenerativeAI | null = null
function client(): GoogleGenerativeAI {
  if (!cachedClient) {
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
    cachedClient = new GoogleGenerativeAI(apiKey)
  }
  return cachedClient
}

// gemini-embedding-001 returns 3072 dims natively. We stopped Matryoshka-truncating to 768 because the
// recall loss at the cut isn't worth saving on storage when halfvec keeps each vector to ~6KB. HNSW on halfvec
// indexes up to 4000 dim, so the full vector is queryable end-to-end.
const MODEL = 'gemini-embedding-001'
export const EMBEDDING_DIMENSIONS = 3072
const MAX_RETRIES = 3

function parseRetryDelayMs(msg: string): number | null {
  // Gemini's 429 body includes "Please retry in 21.008154526s". Use that hint when present; default
  // to exponential backoff otherwise. The SDK surfaces the raw response body inside the Error message.
  const m = msg.match(/retry in ([\d.]+)s/i)
  if (m && m[1]) {
    const seconds = parseFloat(m[1])
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000)
  }
  return null
}

async function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

export async function embed(text: string, task: 'query' | 'document' = 'document'): Promise<number[]> {
  const trimmed = text.trim().slice(0, 8000)
  if (!trimmed) throw new Error('embed: empty input')

  const model = client().getGenerativeModel({ model: MODEL })
  const request: Record<string, unknown> = {
    content: { role: 'user', parts: [{ text: trimmed }] },
    taskType:
      task === 'query'
        ? TaskType.RETRIEVAL_QUERY
        : TaskType.RETRIEVAL_DOCUMENT,
  }

  let lastErr: unknown = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.embedContent(
        request as unknown as Parameters<typeof model.embedContent>[0],
      )
      const v = result.embedding.values
      if (!Array.isArray(v) || v.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`embed: expected ${EMBEDDING_DIMENSIONS} dims, got ${v?.length ?? 0}`)
      }
      return v
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      const is429 = msg.includes('429') || msg.toLowerCase().includes('quota')
      if (!is429 || attempt === MAX_RETRIES) throw e
      // Prefer the server-suggested delay; fall back to 2^attempt seconds.
      const wait = parseRetryDelayMs(msg) ?? Math.min(30_000, 2000 * Math.pow(2, attempt))
      console.warn(`[embed] 429, retrying in ${wait}ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
      await sleep(wait)
    }
  }
  // Unreachable — the loop either returns or throws.
  throw lastErr instanceof Error ? lastErr : new Error('embed: exhausted retries')
}

/**
 * Embed name, tagline, and description in parallel — used by seed and auto-library to populate the
 * three per-field columns on ToolEmbedding in one round-trip set.
 */
export async function embedToolFields(
  name: string,
  tagline: string,
  description: string,
  task: 'query' | 'document' = 'document',
): Promise<{ name: number[]; tagline: number[]; description: number[] }> {
  const [nameVec, taglineVec, descriptionVec] = await Promise.all([
    embed(name, task),
    embed(tagline, task),
    embed(description, task),
  ])
  return { name: nameVec, tagline: taglineVec, description: descriptionVec }
}

export function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`
}
