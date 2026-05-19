// Phase 3 decision: search is a two-step query — pgvector picks the top 20 candidates by cosine, then a typed Prisma find applies filters and shapes the response.
import { prisma } from './db'
import { embed, toPgVectorLiteral } from './embeddings'
import { getDomainFromUrl } from './logo'
import type { ToolResult, SearchRequest, PricingType } from './types'

type Row = { toolId: string; score: number }

async function vectorSearch(query: string, k = 20): Promise<Row[]> {
  const vec = await embed(query, 'query')
  const lit = toPgVectorLiteral(vec)
  // cosine distance: <=> with vector_cosine_ops returns 0 (identical) → 2 (opposite)
  // similarity = 1 - distance, clamped to [0, 1] for UI
  const rows = await prisma.$queryRawUnsafe<{ toolId: string; distance: number }[]>(
    `SELECT "toolId", (vector <=> $1::vector) AS distance
     FROM "ToolEmbedding"
     ORDER BY vector <=> $1::vector
     LIMIT $2`,
    lit,
    k,
  )
  return rows.map((r) => ({
    toolId: r.toolId,
    score: Math.max(0, Math.min(1, 1 - Number(r.distance))),
  }))
}

// Cosine similarity below this is treated as "nothing meaningful matched". Calibrated
// against gemini-embedding-001 outputs at 768d — nonsense queries cluster well below 0.55,
// genuine matches start at ~0.6 for tangentially related and ~0.75+ for direct intent.
const MIN_RELEVANT_SCORE = 0.62

export async function searchTools(req: SearchRequest): Promise<ToolResult[]> {
  const candidates = await vectorSearch(req.query, 20)
  if (candidates.length === 0) return []

  const relevant = candidates.filter((c) => c.score >= MIN_RELEVANT_SCORE)
  if (relevant.length === 0) return []

  const scoreById = new Map(relevant.map((c) => [c.toolId, c.score]))

  const where: Record<string, unknown> = {
    id: { in: relevant.map((c) => c.toolId) },
  }
  if (req.filters?.category) {
    where.category = { slug: req.filters.category }
  }
  if (req.filters?.pricing) {
    const p = req.filters.pricing
    where.pricing = Array.isArray(p) ? { in: p } : p
  }
  if (req.filters?.platforms && req.filters.platforms.length > 0) {
    where.platforms = { hasSome: req.filters.platforms }
  }
  if (req.filters?.privacy === true) {
    where.isPrivacyFocused = true
  }
  if (req.filters?.openSourceOnly === true) {
    where.isOpenSource = true
  }

  const tools = await prisma.aiTool.findMany({
    where,
    include: { category: true, tags: true },
  })

  return tools
    .map((t) => shapeTool(t, scoreById.get(t.id) ?? 0))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 10)
}

type ToolWithRelations = Awaited<
  ReturnType<typeof prisma.aiTool.findFirst>
> extends infer R
  ? R extends null
    ? never
    : R
  : never

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
