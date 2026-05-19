import { NextResponse } from 'next/server'
import { PricingType } from '@prisma/client'
import { sanitizeQuery } from '@/lib/sanitize'
import { searchTools } from '@/lib/search'
import type { ApiError, SearchResponse } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function bad(message: string, code: string, status = 400) {
  const body: ApiError = { error: message, code }
  return NextResponse.json(body, { status })
}

const PRICING_VALUES = Object.values(PricingType) as PricingType[]

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

  const filtersIn =
    body.filters && typeof body.filters === 'object'
      ? (body.filters as Record<string, unknown>)
      : {}

  const filters: {
    category?: string
    pricing?: PricingType
    privacy?: boolean
  } = {}
  if (typeof filtersIn.category === 'string' && filtersIn.category) {
    filters.category = filtersIn.category.slice(0, 60)
  }
  if (typeof filtersIn.pricing === 'string' && PRICING_VALUES.includes(filtersIn.pricing as PricingType)) {
    filters.pricing = filtersIn.pricing as PricingType
  }
  if (typeof filtersIn.privacy === 'boolean') {
    filters.privacy = filtersIn.privacy
  }

  try {
    const results = await searchTools({ query, filters })
    const response: SearchResponse = { results, query, count: results.length }
    return NextResponse.json(response)
  } catch (err) {
    console.error('search error', err)
    return bad('Search failed', 'SEARCH_FAILED', 500)
  }
}
