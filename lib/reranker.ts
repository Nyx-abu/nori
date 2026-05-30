// Cross-encoder reranker via Jina AI. Jina hosts bge-reranker-v2-m3 (the practical successor to the
// bge-reranker-base family) behind a clean HTTP API. Scores are sigmoid'd relevance probabilities, so
// `lib/search.ts` can use a model-grounded threshold (0.3) instead of the old calibrated-by-vibes cosine
// cutoff. If JINA_API_KEY is unset, or the call fails for any reason, we return [] and the caller falls
// back to RRF order — search degrades gracefully, never errors.

type Doc = { id: string; text: string }
type Scored = { id: string; score: number }

const ENDPOINT = 'https://api.jina.ai/v1/rerank'
const MODEL = 'jina-reranker-v2-base-multilingual'
const TIMEOUT_MS = 4000

export async function rerank(query: string, docs: Doc[]): Promise<Scored[]> {
  const apiKey = process.env.JINA_API_KEY
  if (!apiKey || docs.length === 0) return []

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        query,
        documents: docs.map((d) => d.text),
        // top_n omitted on purpose — we want a score for every candidate so the caller can apply its own threshold.
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      console.warn('[reranker] non-2xx, falling back to RRF order:', res.status)
      return []
    }

    const body = (await res.json()) as {
      results?: { index: number; relevance_score: number }[]
    }
    if (!Array.isArray(body.results)) return []

    return body.results
      .map((r) => {
        const doc = docs[r.index]
        return doc ? { id: doc.id, score: r.relevance_score } : null
      })
      .filter((x): x is Scored => x !== null)
      .sort((a, b) => b.score - a.score)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[reranker] call failed, falling back to RRF order:', msg)
    return []
  } finally {
    clearTimeout(timer)
  }
}
