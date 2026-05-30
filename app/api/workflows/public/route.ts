import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { clampLimit, clampPage } from '@/lib/sanitize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const page = clampPage(searchParams.get('page'), 1)
  const limit = clampLimit(searchParams.get('limit'), 12, 24)

  const [total, rows] = await Promise.all([
    prisma.workflow.count({ where: { isPublic: true } }),
    prisma.workflow.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        nodes: {
          orderBy: { order: 'asc' },
        },
      },
    }),
  ])

  const workflows = rows.map((wf) => ({
    id: wf.id,
    title: wf.title,
    description: wf.description,
    isPublic: wf.isPublic,
    authorName: wf.authorName,
    authorImage: wf.authorImage,
    createdAt: wf.createdAt.toISOString(),
    nodeCount: wf.nodes.length,
    firstNodes: wf.nodes.slice(0, 3).map((n) => ({
      toolName: n.toolName,
      toolDomain: n.toolDomain,
    })),
  }))

  return NextResponse.json({ workflows, total, page })
}
