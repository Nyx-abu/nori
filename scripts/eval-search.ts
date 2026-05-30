// Search-relevance eval over a hand-labeled query set. Replaces "tune the magic constants by vibes" with
// "tune by metrics". Each query has an ordered list of expected slugs — the first slug is the ideal top
// result (relevance 3), the next two are also strong (2), the rest are tangential (1). Anything not in
// the list is irrelevant (0). For nonsense queries, an empty expected[] means "should return zero results".
//
// Metrics:
//   - nDCG@10 : standard graded-relevance metric, penalises wrong ordering
//   - P@10    : fraction of top-10 that appears in expected[]
//   - R@10    : fraction of expected[] that appears in top-10
//
// Run:  npm run eval:search   (which uses tsx --env-file=.env)
// Prereqs: DB populated (npm run db:seed) and JINA_API_KEY/GEMINI_API_KEY in .env.

import { searchTools } from '../lib/search'

type LabeledQuery = {
  query: string
  expected: string[]
}

// Ground truth reflects the actual library (~78 tools after auto-discovery), not just the original 17
// seed. Slugs ordered best-to-worst — the first slug gets relevance 3, next two get 2, rest get 1.
const queries: LabeledQuery[] = [
  // Direct intent — clear winners
  { query: 'ai video generation', expected: ['runway', 'kling', 'pika', 'luma-dream-machine'] },
  { query: 'text to video', expected: ['pika', 'runway', 'kling', 'luma-dream-machine', 'invideo-ai'] },
  { query: 'cursor', expected: ['cursor'] },
  { query: 'ai code editor', expected: ['cursor', 'copilot', 'windsurf', 'continue', 'pearai', 'void', 'aider'] },
  { query: 'image generation', expected: ['midjourney', 'flux', 'ideogram', 'dall-e-3', 'leonardo-ai', 'adobe-firefly'] },
  { query: 'local llm', expected: ['ollama', 'lm-studio', 'jan', 'gpt4all', 'anythingllm', 'llamafile'] },
  { query: 'voice cloning', expected: ['elevenlabs', 'descript'] },
  { query: 'answer engine with citations', expected: ['perplexity'] },
  // Adjacent intent — needs semantic
  { query: 'pair programming in the terminal', expected: ['aider', 'cursor', 'copilot'] },
  { query: 'self-hosted ai models', expected: ['ollama', 'lm-studio', 'jan', 'gpt4all', 'anythingllm', 'llamafile', 'llama-cpp'] },
  { query: 'logo design with legible text', expected: ['ideogram', 'midjourney', 'dall-e-3'] },
  { query: 'research assistant for academic papers', expected: ['elicit', 'scispace', 'consensus', 'scholarcy', 'explainpaper'] },
  { query: 'workspace knowledge q and a', expected: ['notion-ai'] },
  { query: 'podcast audio cleanup', expected: ['adobe-podcast', 'auphonic', 'descript'] },
  { query: 'desktop app for running local language models', expected: ['lm-studio', 'jan', 'ollama', 'anythingllm'] },
  // Tag-style intent
  { query: 'open source code assistant', expected: ['aider', 'continue', 'pearai', 'void'] },
  { query: 'open source image model', expected: ['flux'] },
  { query: 'self organizing notes', expected: ['mem', 'notion-ai'] },
  // Single-token (HyDE should kick in)
  { query: 'transcription', expected: ['descript', 'adobe-podcast', 'elevenlabs'] },
  { query: 'animation', expected: ['runway', 'kling', 'pika', 'wonder-dynamics', 'deepmotion'] },
  // Nonsense — should return nothing
  { query: 'purple banana sky cloud', expected: [] },
  { query: 'xqzjklmnop', expected: [] },
]

function relevance(slug: string, expected: string[]): number {
  const idx = expected.indexOf(slug)
  if (idx === -1) return 0
  if (idx === 0) return 3
  if (idx <= 2) return 2
  return 1
}

function dcg(rels: number[]): number {
  return rels.reduce((s, r, i) => s + (Math.pow(2, r) - 1) / Math.log2(i + 2), 0)
}

function nDCG(actual: string[], expected: string[], k = 10): number {
  if (expected.length === 0) return actual.length === 0 ? 1 : 0
  const actualRels = actual.slice(0, k).map((s) => relevance(s, expected))
  // Ideal: assign relevance to each expected slot, take top-k, sort desc.
  const idealRels = expected
    .map((_, i) => (i === 0 ? 3 : i <= 2 ? 2 : 1))
    .sort((a, b) => b - a)
    .slice(0, k)
  const idcg = dcg(idealRels)
  if (idcg === 0) return 0
  return dcg(actualRels) / idcg
}

function precisionAt(actual: string[], expected: string[], k: number): number {
  if (actual.length === 0) return expected.length === 0 ? 1 : 0
  const top = actual.slice(0, k)
  const hits = top.filter((s) => expected.includes(s)).length
  return hits / Math.min(k, top.length)
}

function recallAt(actual: string[], expected: string[], k: number): number {
  if (expected.length === 0) return actual.length === 0 ? 1 : 0
  const top = actual.slice(0, k)
  const hits = top.filter((s) => expected.includes(s)).length
  return hits / expected.length
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length)
}

async function main() {
  console.log(`Evaluating ${queries.length} labeled queries…\n`)

  const rows: Array<{
    query: string
    top: string
    ndcg: number
    p10: number
    r10: number
    path: string
    hyde: boolean
    reranker: string
    topScore: number | null
  }> = []

  for (const q of queries) {
    const { results, meta } = await searchTools({ query: q.query })
    const slugs = results.map((r) => r.slug)
    rows.push({
      query: q.query,
      top: slugs.slice(0, 3).join(', ') || '(empty)',
      ndcg: nDCG(slugs, q.expected),
      p10: precisionAt(slugs, q.expected, 10),
      r10: recallAt(slugs, q.expected, 10),
      path: meta.path,
      hyde: meta.hyde_expanded,
      reranker: meta.reranker,
      topScore: meta.rerank_score_top,
    })
  }

  console.log(
    pad('query', 42) +
      pad('top-3 slugs', 36) +
      pad('nDCG@10', 9) +
      pad('P@10', 7) +
      pad('R@10', 7) +
      pad('path', 14) +
      pad('hyde', 6) +
      pad('rerank', 10) +
      'top_score',
  )
  console.log('-'.repeat(135))
  for (const r of rows) {
    console.log(
      pad(r.query, 42) +
        pad(r.top, 36) +
        pad(r.ndcg.toFixed(3), 9) +
        pad(r.p10.toFixed(2), 7) +
        pad(r.r10.toFixed(2), 7) +
        pad(r.path, 14) +
        pad(r.hyde ? 'yes' : 'no', 6) +
        pad(r.reranker, 10) +
        (r.topScore !== null ? r.topScore.toFixed(3) : '—'),
    )
  }

  const avg = (k: 'ndcg' | 'p10' | 'r10') =>
    rows.reduce((s, r) => s + r[k], 0) / rows.length
  console.log('\n' + '='.repeat(135))
  console.log(`Mean nDCG@10: ${avg('ndcg').toFixed(3)}`)
  console.log(`Mean P@10:    ${avg('p10').toFixed(3)}`)
  console.log(`Mean R@10:    ${avg('r10').toFixed(3)}`)
  console.log(
    `HyDE fired:   ${rows.filter((r) => r.hyde).length}/${rows.length} queries`,
  )
  console.log(
    `Reranker:     ${rows.filter((r) => r.reranker === 'jina').length} jina, ${rows.filter((r) => r.reranker === 'fallback').length} fallback, ${rows.filter((r) => r.reranker === 'skipped').length} skipped`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
