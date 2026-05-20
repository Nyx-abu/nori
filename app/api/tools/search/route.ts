// Fix-pass decision: this is the in-canvas drawer search — distinct from /api/search (semantic, embedding-based). This route uses fast lexical Prisma `contains` against the library, optionally augments with Gemini, dedupes by name, and ranks by token overlap. The Prisma model name is `aiTool` (not `tool`).
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

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 200).trim()

  // Shorter TTL than /api/search because the drawer feeds the live editor — fresh
  // library inserts (e.g. from a sibling search call) should show up within the hour.
  const cacheKey = `drawer:v2:${stableHash(q.toLowerCase())}`
  const cached = await cacheGet<{ results: DrawerResult[]; query: string }>(cacheKey)
  if (cached) {
    return NextResponse.json({ ...cached, cached: true })
  }

  // 1. Library results
  const dbRows = await prisma.aiTool.findMany({
    ...(q.length > 0
      ? {
          where: {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { tagline: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
              { category: { name: { contains: q, mode: 'insensitive' as const } } },
            ],
          },
        }
      : {}),
    include: { category: true },
    orderBy: { trustScore: 'desc' },
    take: 20,
  })

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
        // Same fire-and-forget pattern as /api/search.
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
      // Gemini is best-effort — never fail the route on its account
      geminiResults = []
    }
  }

  // 3. Deduplicate by case-insensitive trimmed name — DB wins
  const seen = new Set(dbResults.map((t) => t.name.toLowerCase().trim()))
  const uniqueGemini = geminiResults.filter(
    (t) => !seen.has(t.name.toLowerCase().trim()),
  )
  const combined = [...dbResults, ...uniqueGemini]

  // 4. Rank only when a query is present; empty query → library order (trustScore desc)
  const ranked = q.length > 0 ? rankToolsForQuery(combined, q) : combined

  const payload = { results: ranked.slice(0, 25), query: q }
  void cacheSet(cacheKey, payload, 60 * 60)
  return NextResponse.json(payload)
}
