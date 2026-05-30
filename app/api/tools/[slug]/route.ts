import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { shapeTool } from '@/lib/search'
import { isValidSlug } from '@/lib/sanitize'
import type { ApiError } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  if (!isValidSlug(params.slug)) {
    const body: ApiError = { error: 'Invalid slug', code: 'INVALID_SLUG' }
    return NextResponse.json(body, { status: 400 })
  }
  try {
    const tool = await prisma.aiTool.findUnique({
      where: { slug: params.slug },
      include: { category: true, tags: true },
    })
    if (!tool) {
      const body: ApiError = { error: 'Tool not found', code: 'NOT_FOUND' }
      return NextResponse.json(body, { status: 404 })
    }
    return NextResponse.json(shapeTool(tool))
  } catch (err) {
    console.error('tool detail error', err instanceof Error ? err.message : String(err))
    const body: ApiError = { error: 'Failed to load tool', code: 'TOOL_LOAD_FAILED' }
    return NextResponse.json(body, { status: 500 })
  }
}
