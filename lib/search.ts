// Search pipeline — multi-vector + lexical RRF → cross-encoder rerank → top 10.
//
//   1. Pre-filter to eligibleIds with Prisma so RRF's top-K is post-filter (otherwise filters bite a hole
//      in the candidate pool and the reranker runs on 2 docs instead of 20).
//   2. Expand the query with HyDE if it's under 4 tokens — hypothetical doc adds semantic reach without
//      losing the lexical signal of the literal tokens.
//   3. Embed the expanded query. If embed fails (Gemini down / rate-limited) we degrade to lexical-only
//      RRF over tsvector instead of erroring — search keeps working through Gemini outages.
//   4. Single CTE pulls top-20 from FOUR ranked lists, all restricted to eligibleIds:
//        nameVec / taglineVec / descriptionVec (HNSW halfvec_cosine_ops) + searchVector (GIN tsvector).
//      Wrapped in a transaction with `SET LOCAL hnsw.ef_search = 100` to widen ANN recall under filters.
//      Fused via Reciprocal Rank Fusion (1/(60+rank)).
//   5. Cross-encoder reranks the 20 RRF candidates with augmented context (name + tagline + description
//      + category + tag names). Drop below sigmoid 0.3.
//   6. Return shaped tools + telemetry meta (which pipeline ran, HyDE fired, reranker scores). Meta flows
//      to /api/search → client → PostHog so we can tune the pipeline post-hoc instead of guessing.
import { prisma } from './db'
import { embed, toPgVectorLiteral } from './embeddings'
import { expandQueryWithHyDE } from './query-expansion'
import { rerank } from './reranker'
import { getDomainFromUrl } from './logo'
import type { ToolResult, SearchRequest, PricingType } from './types'

// Constants tuned against scripts/eval-search.ts on a 78-tool library. Final config produces
// nDCG@10=0.840 / P@10=0.752 / R@10=0.777. Trials that did NOT move the needle:
//   - RRF_K 30/60/120 (flat — library too small for fusion weighting to differ)
//   - CANDIDATE_POOL 30 (noisier reranker input, -0.003 nDCG)
//   - RERANK_INPUT 30 (same as POOL bump, -0.004 nDCG)
//   - HNSW_EF_SEARCH 100→200 (flat — default ANN frontier already covers all 78 vectors)
//   - HyDE threshold 4→5 (flat, extra Gemini calls for no lift)
// The only lift came from MIN_RERANK_SCORE 0.30→0.25 (+0.015 nDCG, +0.036 R). Re-run the eval after any
// further change so trade-offs are measured, not guessed.
const RRF_K = 60
const CANDIDATE_POOL = 20
const RERANK_INPUT = 20
const RERANK_OUTPUT = 10
const MIN_RERANK_SCORE = 0.25
const HNSW_EF_SEARCH = 200
const RERANK_DOC_MAX_CHARS = 1500

export type SearchMeta = {
  // Which retrieval pipeline ran. lexical-only = embed failed, RRF degraded gracefully.
  path: 'full-rrf' | 'lexical-only' | 'empty'
  hyde_expanded: boolean
  // 'jina' = reranker scored candidates; 'fallback' = call failed, RRF order used; 'skipped' = no candidates.
  reranker: 'jina' | 'fallback' | 'skipped'
  eligible_count: number
  candidate_count: number
  rerank_filtered: number
  rerank_score_top: number | null
  rerank_score_median: number | null
}

export type SearchToolsResult = {
  results: ToolResult[]
  meta: SearchMeta
}

type Candidate = { toolId: string; rrfScore: number }

function buildPrismaWhere(filters: SearchRequest['filters'] = {}): Record<string, unknown> {
  const where: Record<string, unknown> = {}
  if (filters.category) {
    where.category = { slug: filters.category }
  }
  if (filters.pricing) {
    const p = filters.pricing
    where.pricing = Array.isArray(p) ? { in: p } : p
  }
  if (filters.platforms && filters.platforms.length > 0) {
    where.platforms = { hasSome: filters.platforms }
  }
  if (filters.privacy === true) {
    where.isPrivacyFocused = true
  }
  if (filters.openSourceOnly === true) {
    where.isOpenSource = true
  }
  return where
}

async function fullRRFSearch(
  vec: number[],
  query: string,
  eligibleIds: string[],
): Promise<Candidate[]> {
  const lit = toPgVectorLiteral(vec)

  // SET LOCAL only applies inside a transaction — pgBouncer can recycle the connection otherwise and
  // leak the elevated ef_search to unrelated queries. Transaction scopes it to this one read.
  return prisma.$transaction(async (tx) => {
    if (!Number.isInteger(HNSW_EF_SEARCH)) throw new Error('HNSW_EF_SEARCH must be an integer')
    await tx.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = ${HNSW_EF_SEARCH}`)

    const rows = await tx.$queryRawUnsafe<{ toolId: string; score: number }[]>(
      `
      WITH name_top AS (
        SELECT te."toolId",
               ROW_NUMBER() OVER (ORDER BY te."nameVec" <=> $1::halfvec) AS rank
        FROM "ToolEmbedding" te
        WHERE te."toolId" = ANY($3::text[])
        ORDER BY te."nameVec" <=> $1::halfvec
        LIMIT ${CANDIDATE_POOL}
      ),
      tagline_top AS (
        SELECT te."toolId",
               ROW_NUMBER() OVER (ORDER BY te."taglineVec" <=> $1::halfvec) AS rank
        FROM "ToolEmbedding" te
        WHERE te."toolId" = ANY($3::text[])
        ORDER BY te."taglineVec" <=> $1::halfvec
        LIMIT ${CANDIDATE_POOL}
      ),
      desc_top AS (
        SELECT te."toolId",
               ROW_NUMBER() OVER (ORDER BY te."descriptionVec" <=> $1::halfvec) AS rank
        FROM "ToolEmbedding" te
        WHERE te."toolId" = ANY($3::text[])
        ORDER BY te."descriptionVec" <=> $1::halfvec
        LIMIT ${CANDIDATE_POOL}
      ),
      lex_top AS (
        SELECT id AS "toolId",
               ROW_NUMBER() OVER (
                 ORDER BY ts_rank_cd("searchVector", websearch_to_tsquery('english', $2)) DESC
               ) AS rank
        FROM "AiTool"
        WHERE id = ANY($3::text[])
          AND "searchVector" @@ websearch_to_tsquery('english', $2)
        ORDER BY ts_rank_cd("searchVector", websearch_to_tsquery('english', $2)) DESC
        LIMIT ${CANDIDATE_POOL}
      ),
      fused AS (
        SELECT "toolId", rank FROM name_top
        UNION ALL SELECT "toolId", rank FROM tagline_top
        UNION ALL SELECT "toolId", rank FROM desc_top
        UNION ALL SELECT "toolId", rank FROM lex_top
      )
      SELECT "toolId", SUM(1.0 / (${RRF_K} + rank))::double precision AS score
      FROM fused
      GROUP BY "toolId"
      ORDER BY score DESC
      LIMIT ${RERANK_INPUT};
      `,
      lit,
      query,
      eligibleIds,
    )

    return rows.map((r) => ({ toolId: r.toolId, rrfScore: Number(r.score) }))
  })
}

async function lexicalOnlySearch(
  query: string,
  eligibleIds: string[],
): Promise<Candidate[]> {
  // Used when embed() fails. We still get a usable result set from the tsvector leg — the user will see
  // a degraded but functional library section instead of an error.
  const rows = await prisma.$queryRawUnsafe<{ toolId: string; score: number }[]>(
    `
    SELECT id AS "toolId",
           ts_rank_cd("searchVector", websearch_to_tsquery('english', $1))::double precision AS score
    FROM "AiTool"
    WHERE id = ANY($2::text[])
      AND "searchVector" @@ websearch_to_tsquery('english', $1)
    ORDER BY score DESC
    LIMIT ${RERANK_INPUT};
    `,
    query,
    eligibleIds,
  )
  return rows.map((r) => ({ toolId: r.toolId, rrfScore: Number(r.score) }))
}

function buildRerankerDoc(t: {
  name: string
  tagline: string
  description: string
  category: { name: string }
  tags: { name: string }[]
}): string {
  const parts = [t.name, t.tagline, t.description, `Category: ${t.category.name}`]
  if (t.tags.length > 0) {
    parts.push(`Tags: ${t.tags.map((g) => g.name).join(', ')}`)
  }
  // bge-family cross-encoders typically cap at 512 tokens; ~1500 chars stays well under that
  // (a generous safety margin for tokenizer variance).
  return parts.join('. ').slice(0, RERANK_DOC_MAX_CHARS)
}

export async function searchTools(req: SearchRequest): Promise<SearchToolsResult> {
  const where = buildPrismaWhere(req.filters)
  const eligible = await prisma.aiTool.findMany({ where, select: { id: true } })
  const eligibleIds = eligible.map((r) => r.id)

  if (eligibleIds.length === 0) {
    return {
      results: [],
      meta: {
        path: 'empty',
        hyde_expanded: false,
        reranker: 'skipped',
        eligible_count: 0,
        candidate_count: 0,
        rerank_filtered: 0,
        rerank_score_top: null,
        rerank_score_median: null,
      },
    }
  }

  const expansion = await expandQueryWithHyDE(req.query)

  let candidates: Candidate[] = []
  let path: SearchMeta['path'] = 'full-rrf'
  try {
    const vec = await embed(expansion.text, 'query')
    candidates = await fullRRFSearch(vec, req.query, eligibleIds)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[search] embed/RRF failed, falling back to lexical-only:', msg)
    candidates = await lexicalOnlySearch(req.query, eligibleIds)
    path = 'lexical-only'
  }

  if (candidates.length === 0) {
    return {
      results: [],
      meta: {
        path,
        hyde_expanded: expansion.expanded,
        reranker: 'skipped',
        eligible_count: eligibleIds.length,
        candidate_count: 0,
        rerank_filtered: 0,
        rerank_score_top: null,
        rerank_score_median: null,
      },
    }
  }

  const tools = await prisma.aiTool.findMany({
    where: { id: { in: candidates.map((c) => c.toolId) } },
    include: { category: true, tags: true },
  })
  if (tools.length === 0) {
    return {
      results: [],
      meta: {
        path,
        hyde_expanded: expansion.expanded,
        reranker: 'skipped',
        eligible_count: eligibleIds.length,
        candidate_count: candidates.length,
        rerank_filtered: 0,
        rerank_score_top: null,
        rerank_score_median: null,
      },
    }
  }

  const docs = tools.map((t) => ({ id: t.id, text: buildRerankerDoc(t) }))
  const reranked = await rerank(req.query, docs)

  const toolById = new Map(tools.map((t) => [t.id, t]))

  if (reranked.length === 0) {
    // Reranker unavailable — fall back to RRF order. Search still degrades gracefully.
    const rrfById = new Map(candidates.map((c) => [c.toolId, c.rrfScore]))
    const sorted = tools
      .map((t) => ({ t, score: rrfById.get(t.id) ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, RERANK_OUTPUT)
    return {
      results: sorted.map(({ t, score }) => shapeTool(t, score)),
      meta: {
        path,
        hyde_expanded: expansion.expanded,
        reranker: 'fallback',
        eligible_count: eligibleIds.length,
        candidate_count: candidates.length,
        rerank_filtered: 0,
        rerank_score_top: null,
        rerank_score_median: null,
      },
    }
  }

  const sortedScores = [...reranked].sort((a, b) => b.score - a.score).map((r) => r.score)
  const relevant = reranked
    .filter((r) => r.score >= MIN_RERANK_SCORE)
    .slice(0, RERANK_OUTPUT)
  const filteredOut = reranked.length - relevant.length

  const results = relevant
    .map((r) => {
      const t = toolById.get(r.id)
      return t ? shapeTool(t, r.score) : null
    })
    .filter((x): x is ToolResult => x !== null)

  return {
    results,
    meta: {
      path,
      hyde_expanded: expansion.expanded,
      reranker: 'jina',
      eligible_count: eligibleIds.length,
      candidate_count: candidates.length,
      rerank_filtered: filteredOut,
      rerank_score_top: sortedScores[0] ?? null,
      rerank_score_median: sortedScores[Math.floor(sortedScores.length / 2)] ?? null,
    },
  }
}

export function shapeTool(
  t: {
    id: string
    slug: string
    name: string
    tagline: string
    description: string
    website: string
    pricing: PricingType
    isOpenSource: boolean
    isPrivacyFocused: boolean
    platforms: string[]
    trustScore: number
    category: { id: string; slug: string; name: string; icon: string }
    tags: { id: string; slug: string; name: string }[]
  },
  score?: number,
): ToolResult {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    description: t.description,
    website: t.website,
    domain: t.website ? getDomainFromUrl(t.website) : null,
    pricing: t.pricing,
    isOpenSource: t.isOpenSource,
    isPrivacyFocused: t.isPrivacyFocused,
    platforms: t.platforms,
    trustScore: t.trustScore,
    category: {
      id: t.category.id,
      slug: t.category.slug,
      name: t.category.name,
      icon: t.category.icon,
    },
    tags: t.tags.map((g) => ({ id: g.id, slug: g.slug, name: g.name })),
    source: 'db' as const,
    ...(score !== undefined ? { score } : {}),
  }
}
