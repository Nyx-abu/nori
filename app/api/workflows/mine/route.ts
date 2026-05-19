import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import type { ApiError } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = auth()
  if (!userId) {
    const body: ApiError = { error: 'Sign in required', code: 'UNAUTHORIZED' }
    return NextResponse.json(body, { status: 401 })
  }

  const rows = await prisma.workflow.findMany({
    where: { authorId: userId },
    orderBy: { updatedAt: 'desc' },
    include: { nodes: { orderBy: { order: 'asc' } } },
  })

  const workflows = rows.map((wf) => ({
    id: wf.id,
    title: wf.title,
    description: wf.description,
    isPublic: wf.isPublic,
    authorName: wf.authorName,
    authorImage: wf.authorImage,
    createdAt: wf.createdAt.toISOString(),
    updatedAt: wf.updatedAt.toISOString(),
    nodeCount: wf.nodes.length,
    firstNodes: wf.nodes.slice(0, 3).map((n) => ({
      toolName: n.toolName,
      toolDomain: n.toolDomain,
    })),
  }))

  return NextResponse.json({ workflows })
}
