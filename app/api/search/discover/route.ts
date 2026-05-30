// Gemini live-discovery, isolated from the DB hot path. Client fires this in parallel with /api/search
// and renders the AI-discovered section when it resolves. Cached longer (12h) because discoveries get
// auto-persisted to the library — same query the next day is almost certainly already DB-searchable.
import { NextResponse } from 'next/server'
import { PricingType } from '@prisma/client'
import { sanitizeQuery } from '@/lib/sanitize'
import { discoverToolsWithGemini } from '@/lib/gemini-discovery'
import { persistDiscoveredTools } from '@/lib/auto-library'
import { getDomainFromUrl } from '@/lib/logo'
import { cacheGet, cacheSet, stableHash } from '@/lib/redis'
import type { ApiError, ToolResult } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function bad(message: string, code: string, status = 400) {
  const body: ApiError = { error: message, code }
  return NextResponse.json(body, { status })
}

type DiscoverResponse = {
  results: ToolResult[]
  aiCount: number
  query: string
}

export async function POST(req: Request) {
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return bad('Invalid JSON body', 'INVALID_JSON')
  }
  if (!payload || typeof payload !== 'object') {
    return bad('Request body must be an object', 'INVALID_BODY')
  }
  const body = payload as Record<string, unknown>
  const query = sanitizeQuery(body.query)
  if (!query) return bad('query is required', 'MISSING_QUERY')
  if (query.length < 2) return bad('query is too short', 'QUERY_TOO_SHORT')

  // Optional: the client may pass dbNames so Gemini can avoid suggesting tools the user is already seeing
  // in the library section. Safe-cast: anything else becomes [].
  const dbNames: string[] = Array.isArray(body.dbNames)
    ? (body.dbNames as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 20)
    : []

  // Cache key intentionally ignores filters — Gemini results are an unfiltered augmentation, and varying
  // by filters would multiply cache pressure with no quality lift.
  const cacheKey = `search:v3:ai:${stableHash({ q: query.toLowerCase() })}`
  const cached = await cacheGet<DiscoverResponse>(cacheKey)
  if (cached) {
    return NextResponse.json({ ...cached, cached: true })
  }

  try {
    const discovered = await discoverToolsWithGemini(query, dbNames)

    if (discovered.length > 0) {
      void persistDiscoveredTools(discovered)
    }

    const seen = new Set(dbNames.map((n) => n.toLowerCase()))
    const aiTools: ToolResult[] = discovered
      .filter((t) => !seen.has(t.name.toLowerCase()))
      .map((t, i) => ({
        id: `gemini-${i}-${t.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        slug: '',
        name: t.name,
        tagline: t.tagline,
        description: t.tagline,
        website: t.website,
        domain: getDomainFromUrl(t.website),
        pricing: t.pricing as PricingType,
        isOpenSource: t.isOpenSource,
        isPrivacyFocused: t.isPrivacyFocused,
        platforms: t.platforms,
        trustScore: 0,
        category: {
          id: 'gemini',
          slug: 'discovered',
          name: 'AI-discovered',
          icon: 'M5 3v18m14-18v18M5 12h14',
        },
        tags: [],
        source: 'gemini' as const,
        whyRelevant: t.whyRelevant,
      }))

    const response: DiscoverResponse = {
      results: aiTools,
      aiCount: aiTools.length,
      query,
    }

    void cacheSet(cacheKey, response, 12 * 60 * 60)

    return NextResponse.json(response)
  } catch (err) {
    console.error('discover error', err)
    return bad('Discovery failed', 'DISCOVER_FAILED', 500)
  }
}
