import { NextResponse } from 'next/server'
import { PricingType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { shapeTool } from '@/lib/search'
import { clampLimit, clampPage } from '@/lib/sanitize'
import type { ApiError } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PRICING_VALUES = Object.values(PricingType) as PricingType[]

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const categorySlug = searchParams.get('category')?.slice(0, 60) ?? undefined
  const pricingParam = searchParams.get('pricing') ?? undefined
  const pricing =
    pricingParam && PRICING_VALUES.includes(pricingParam as PricingType)
      ? (pricingParam as PricingType)
      : undefined
  const page = clampPage(searchParams.get('page'), 1)
  const limit = clampLimit(searchParams.get('limit'), 20, 50)

  const where: Record<string, unknown> = {}
  if (categorySlug) where.category = { slug: categorySlug }
  if (pricing) where.pricing = pricing

  try {
    const [total, tools] = await Promise.all([
      prisma.aiTool.count({ where }),
      prisma.aiTool.findMany({
        where,
        include: { category: true, tags: true },
        orderBy: [{ trustScore: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])
    return NextResponse.json({
      tools: tools.map((t) => shapeTool(t)),
      total,
      page,
    })
  } catch (err) {
    console.error('tools list error', err)
    const body: ApiError = { error: 'Failed to list tools', code: 'LIST_FAILED' }
    return NextResponse.json(body, { status: 500 })
  }
}
