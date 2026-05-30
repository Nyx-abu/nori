// DB-only fast path. Gemini live-discovery moved to /api/search/discover so a slow Gemini call can't
// block the library section from painting. The client fires both endpoints in parallel and renders each
// section as it resolves — see components/search/SearchResults.tsx.
import { NextResponse } from 'next/server'
import { PricingType } from '@prisma/client'
import { sanitizeQuery } from '@/lib/sanitize'
import { searchTools, type SearchMeta } from '@/lib/search'
import { cacheGet, cacheSet, stableHash } from '@/lib/redis'
import type { ApiError, ToolResult } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function bad(message: string, code: string, status = 400) {
  const body: ApiError = { error: message, code }
  return NextResponse.json(body, { status })
}

const PRICING_VALUES = Object.values(PricingType) as PricingType[]
const PLATFORM_VALUES = ['web', 'mac', 'windows', 'linux', 'ios', 'android', 'api']

type FiltersIn = {
  pricing?: string[] | string
  platforms?: string[]
  privacyFocused?: boolean
  openSourceOnly?: boolean
  categorySlug?: string
  category?: string
  privacy?: boolean
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

  const filtersIn: FiltersIn =
    body.filters && typeof body.filters === 'object'
      ? (body.filters as FiltersIn)
      : {}

  const pricingArr: PricingType[] = (() => {
    const raw = filtersIn.pricing
    if (Array.isArray(raw)) {
      return raw.filter((p): p is PricingType =>
        typeof p === 'string' && PRICING_VALUES.includes(p as PricingType),
      )
    }
    if (typeof raw === 'string' && PRICING_VALUES.includes(raw as PricingType)) {
      return [raw as PricingType]
    }
    return []
  })()

  const platformsArr: string[] = Array.isArray(filtersIn.platforms)
    ? filtersIn.platforms.filter((p): p is string => typeof p === 'string' && PLATFORM_VALUES.includes(p))
    : []

  const categorySlug =
    (typeof filtersIn.categorySlug === 'string' && filtersIn.categorySlug.slice(0, 60)) ||
    (typeof filtersIn.category === 'string' && filtersIn.category.slice(0, 60)) ||
    undefined

  const privacyFocused =
    typeof filtersIn.privacyFocused === 'boolean'
      ? filtersIn.privacyFocused
      : typeof filtersIn.privacy === 'boolean'
        ? filtersIn.privacy
        : false

  const openSourceOnly = filtersIn.openSourceOnly === true

  // Cache key prefix changed to v3 because the DB pipeline is now multi-vector RRF + reranker — old v2
  // entries would be served with the wrong shape (no aiCount, no ai results).
  const cacheKey = `search:v3:db:${stableHash({
    q: query.toLowerCase(),
    pricing: pricingArr.slice().sort(),
    platforms: platformsArr.slice().sort(),
    category: categorySlug ?? '',
    privacy: privacyFocused,
    oss: openSourceOnly,
  })}`

  const cached = await cacheGet<SearchResponse>(cacheKey)
  if (cached) {
    return NextResponse.json({ ...cached, cached: true })
  }

  try {
    const { results, meta } = await searchTools({
      query,
      filters: {
        ...(pricingArr.length ? { pricing: pricingArr } : {}),
        ...(platformsArr.length ? { platforms: platformsArr } : {}),
        ...(categorySlug ? { category: categorySlug } : {}),
        ...(privacyFocused ? { privacy: true } : {}),
        ...(openSourceOnly ? { openSourceOnly: true } : {}),
      },
    })

    const response: SearchResponse = {
      results,
      dbCount: results.length,
      query,
      count: results.length,
      noResults: results.length === 0,
      ...(process.env.NODE_ENV === 'development' ? { meta } : { meta: {} as SearchMeta }),
    }

    void cacheSet(cacheKey, response, 12 * 60 * 60)

    return NextResponse.json(response)
  } catch (err) {
    console.error('search error', err instanceof Error ? err.message : String(err))
    return bad('Search failed', 'SEARCH_FAILED', 500)
  }
}

type SearchResponse = {
  results: ToolResult[]
  dbCount: number
  query: string
  count: number
  noResults: boolean
  meta: SearchMeta
}
