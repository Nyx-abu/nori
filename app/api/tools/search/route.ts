// In-canvas drawer search — keystroke-driven, so it stays lexical (no embedding). Now ranks by tsvector
// + ts_rank_cd instead of Prisma `contains` over multiple fields, which gives weighted matches (name=A,
// tagline=B, description=C) and survives stemmer-friendly typos. Each query token gets prefix matching
// (`token:*`) so partial words like "vid" still match "video" mid-typing.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rankToolsForQuery, type RankableTool } from '@/lib/tool-ranking'
import { discoverToolsWithGemini } from '@/lib/gemini-discovery'
import { persistDiscoveredTools } from '@/lib/auto-library'
import { getDomainFromUrl } from '@/lib/logo'
import { cacheGet, cacheSet, stableHash } from '@/lib/redis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DrawerResult = RankableTool & {
  id: string
  website: string
  domain: string | null
  pricing: string
  slug?: string
}

const DRAWER_LIMIT = 20

/**
 * Turn a free-text query into a safe `to_tsquery` payload. Each alphanumeric token gets `:*` for prefix
 * matching, joined by ` & ` (AND). Non-alphanumeric characters are stripped — that filters out the
 * tsquery special chars (& | ! :) so a user typing them can't crash the parser. Returns null if the
 * query has no usable tokens after sanitization, signalling the caller to fall back to non-tsvector ranking.
 */
function buildPrefixTsQuery(q: string): string | null {
  const tokens = q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length === 0) return null
  return tokens.map((t) => `${t}:*`).join(' & ')
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 200).trim()

  const cacheKey = `drawer:v3:${stableHash(q.toLowerCase())}`
  const cached = await cacheGet<{ results: DrawerResult[]; query: string }>(cacheKey)
  if (cached) {
    return NextResponse.json({ ...cached, cached: true })
  }

  // 1. Library results — tsvector-ranked when the query has usable tokens, trustScore-ordered otherwise.
  type Row = { id: string; rank: number | null }
  let ranked: Row[] = []

  const tsquery = q.length > 0 ? buildPrefixTsQuery(q) : null

  if (tsquery) {
    // Raw SQL is necessary here — Prisma doesn't expose tsvector ops. We only need the ranked IDs;
    // the full tool rows come from a follow-up findMany so we keep type-safe includes.
    ranked = await prisma.$queryRawUnsafe<Row[]>(
      `
      SELECT id,
             ts_rank_cd("searchVector", to_tsquery('english', $1))::double precision AS rank
      FROM "AiTool"
      WHERE "searchVector" @@ to_tsquery('english', $1)
      ORDER BY rank DESC, "trustScore" DESC
      LIMIT ${DRAWER_LIMIT};
      `,
      tsquery,
    )
  } else {
    const rows = await prisma.aiTool.findMany({
      select: { id: true },
      orderBy: { trustScore: 'desc' },
      take: DRAWER_LIMIT,
    })
    ranked = rows.map((r) => ({ id: r.id, rank: null }))
  }

  const orderById = new Map(ranked.map((r, i) => [r.id, i]))
  const dbRows = ranked.length
    ? await prisma.aiTool.findMany({
        where: { id: { in: ranked.map((r) => r.id) } },
        include: { category: true },
      })
    : []

  dbRows.sort((a, b) => (orderById.get(a.id) ?? 99) - (orderById.get(b.id) ?? 99))

  const dbResults: DrawerResult[] = dbRows.map((t) => ({
    id: t.id,
    name: t.name,
    tagline: t.tagline,
    website: t.website,
    domain: t.website ? getDomainFromUrl(t.website) : null,
    pricing: t.pricing,
    source: 'db' as const,
    whyRelevant: null,
    slug: t.slug,
  }))

  // 2. Gemini augmentation (only when there's a query; respect free-tier quota)
  let geminiResults: DrawerResult[] = []
  if (q.length > 1) {
    const dbNames = dbResults.map((t) => t.name)
    try {
      const discovered = await discoverToolsWithGemini(q, dbNames)
      if (discovered.length > 0) {
        void persistDiscoveredTools(discovered)
      }
      geminiResults = discovered.map((t) => ({
        id: `gemini-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: t.name,
        tagline: t.tagline,
        website: t.website,
        domain: getDomainFromUrl(t.website),
        pricing: t.pricing,
        source: 'gemini' as const,
        whyRelevant: t.whyRelevant,
      }))
    } catch {
      geminiResults = []
    }
  }

  // 3. Deduplicate by case-insensitive trimmed name — DB wins
  const seen = new Set(dbResults.map((t) => t.name.toLowerCase().trim()))
  const uniqueGemini = geminiResults.filter(
    (t) => !seen.has(t.name.toLowerCase().trim()),
  )
  const combined = [...dbResults, ...uniqueGemini]

  // 4. Final ranking — tsvector already ordered the DB half, but rankToolsForQuery applies the existing
  // brand/tagline boosts (and handles Gemini results that haven't been through any ranker).
  const finalResults = q.length > 0 ? rankToolsForQuery(combined, q) : combined

  const payload = { results: finalResults.slice(0, 25), query: q }
  void cacheSet(cacheKey, payload, 60 * 60)
  return NextResponse.json(payload)
}
