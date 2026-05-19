// P4 decision: parallel DB+Gemini with Promise.allSettled. Each side fails independently. Names are deduped case-insensitively to avoid showing a tool twice. Filters apply only to the DB side; Gemini results are intentionally unfiltered (small set, augmentation only).
import { NextResponse } from 'next/server'
import { PricingType } from '@prisma/client'
import { sanitizeQuery } from '@/lib/sanitize'
import { searchTools } from '@/lib/search'
import { discoverToolsWithGemini } from '@/lib/gemini-discovery'
import { persistDiscoveredTools } from '@/lib/auto-library'
import { getDomainFromUrl } from '@/lib/logo'
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

  // Normalize: accept legacy single pricing string OR array; same for category/categorySlug
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

  try {
    const dbPromise = searchTools({
      query,
      filters: {
        ...(pricingArr.length ? { pricing: pricingArr } : {}),
        ...(platformsArr.length ? { platforms: platformsArr } : {}),
        ...(categorySlug ? { category: categorySlug } : {}),
        ...(privacyFocused ? { privacy: true } : {}),
        ...(openSourceOnly ? { openSourceOnly: true } : {}),
      },
    })

    const geminiPromise = discoverToolsWithGemini(query, [])

    const [dbRes, geminiRes] = await Promise.allSettled([dbPromise, geminiPromise])

    const dbTools: ToolResult[] = dbRes.status === 'fulfilled' ? dbRes.value : []
    const aiDiscovered = geminiRes.status === 'fulfilled' ? geminiRes.value : []

    // Fire-and-forget: save discovered tools to the library so future searches find them via DB
    // even if Gemini is rate-limited. Never blocks the response.
    if (aiDiscovered.length > 0) {
      void persistDiscoveredTools(aiDiscovered)
    }

    const dbNames = new Set(dbTools.map((t) => t.name.toLowerCase()))
    const aiTools: ToolResult[] = aiDiscovered
      .filter((t) => !dbNames.has(t.name.toLowerCase()))
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

    const results = [...dbTools, ...aiTools]

    return NextResponse.json({
      results,
      dbCount: dbTools.length,
      aiCount: aiTools.length,
      query,
      count: results.length,
      noResults: results.length === 0,
    })
  } catch (err) {
    console.error('search error', err)
    return bad('Search failed', 'SEARCH_FAILED', 500)
  }
}
