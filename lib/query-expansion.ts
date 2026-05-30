// HyDE (Hypothetical Document Embeddings): for short/sparse queries, dense retrieval struggles because
// 1-2 tokens carry little semantic signal. We ask Gemini to hallucinate a 2-sentence description of the
// ideal tool, then embed (original + hallucinated). The original tokens still drive the lexical leg of
// RRF, so we get the best of both: precise lexical match on the literal query + broader semantic reach
// on the expanded form.
//
// Only fires for queries with fewer than 4 tokens — longer queries already carry enough semantic load
// that HyDE costs more (extra Gemini call) than it gains. Results are cached in Redis for 7 days because
// hypothetical docs for a given short query are stable.
import { GoogleGenerativeAI } from '@google/generative-ai'
import { cacheGet, cacheSet, stableHash } from './redis'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

const SHORT_QUERY_TOKEN_THRESHOLD = 4
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60

export type ExpansionResult = {
  text: string
  expanded: boolean
}

export async function expandQueryWithHyDE(query: string): Promise<ExpansionResult> {
  const tokens = query.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { text: query, expanded: false }
  if (tokens.length >= SHORT_QUERY_TOKEN_THRESHOLD) return { text: query, expanded: false }
  if (!process.env.GEMINI_API_KEY) return { text: query, expanded: false }

  const cacheKey = `hyde:v1:${stableHash(query.toLowerCase().trim())}`
  const cached = await cacheGet<string>(cacheKey)
  if (cached) return { text: cached, expanded: true }

  const prompt = `A user is searching an AI tool directory for: "${query}".

Write a 2-sentence description of the ideal AI tool that would perfectly match this search. Describe the tool's capability and the kind of user who would reach for it. Output ONLY the description — no preamble, no quotes, no markdown.`

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' })
    const result = await model.generateContent(prompt)
    const hallucinated = result.response.text().trim().slice(0, 500)
    if (!hallucinated) return { text: query, expanded: false }

    // Concat: original query stays prominent for the embedder, hypothetical doc adds reach.
    const combined = `${query}. ${hallucinated}`
    void cacheSet(cacheKey, combined, CACHE_TTL_SECONDS)
    return { text: combined, expanded: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[hyde] expansion failed, using raw query:', msg)
    return { text: query, expanded: false }
  }
}
