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

// Spec asked for `text-embedding-004` but the current Gemini API rejects that model name on this key. `gemini-embedding-001` is the supported successor and still emits 768-dim vectors when truncated.
const MODEL = 'gemini-embedding-001'
export const EMBEDDING_DIMENSIONS = 768

export async function embed(text: string, task: 'query' | 'document' = 'document'): Promise<number[]> {
  const trimmed = text.trim().slice(0, 8000)
  if (!trimmed) throw new Error('embed: empty input')

  const model = client().getGenerativeModel({ model: MODEL })
  // gemini-embedding-001 returns 3072 dims by default; outputDimensionality truncates to 768 via Matryoshka. The SDK 0.21 type doesn't surface the field but the REST endpoint accepts it.
  const request: Record<string, unknown> = {
    content: { role: 'user', parts: [{ text: trimmed }] },
    taskType:
      task === 'query'
        ? TaskType.RETRIEVAL_QUERY
        : TaskType.RETRIEVAL_DOCUMENT,
    outputDimensionality: EMBEDDING_DIMENSIONS,
  }
  const result = await model.embedContent(request as unknown as Parameters<typeof model.embedContent>[0])
  const v = result.embedding.values
  if (!Array.isArray(v) || v.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`embed: expected ${EMBEDDING_DIMENSIONS} dims, got ${v?.length ?? 0}`)
  }
  return v
}

export function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`
}
