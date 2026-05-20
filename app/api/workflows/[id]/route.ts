// P7 decision: private workflows return 403 (not 404) for non-owners so the owner sees their own existence. Ownership is checked on every mutation.
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { sanitizeWorkflowInput } from '@/lib/sanitize'
import type { ApiError } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function err(msg: string, code: string, status: number) {
  const body: ApiError = { error: msg, code }
  return NextResponse.json(body, { status })
}

function isValidCuid(s: string): boolean {
  return /^c[a-z0-9]{20,40}$/.test(s)
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isValidCuid(params.id)) return err('Invalid id', 'INVALID_ID', 400)

  const wf = await prisma.workflow.findUnique({
    where: { id: params.id },
    include: {
      nodes: { orderBy: { order: 'asc' } },
      edges: true,
    },
  })
  if (!wf) return err('Workflow not found', 'NOT_FOUND', 404)

  if (!wf.isPublic) {
    const { userId } = auth()
    if (!userId) return err('Sign in required', 'UNAUTHORIZED', 401)
    if (userId !== wf.authorId) return err('Forbidden', 'FORBIDDEN', 403)
  }

  return NextResponse.json({
    id: wf.id,
    title: wf.title,
    description: wf.description,
    isPublic: wf.isPublic,
    authorId: wf.authorId,
    authorName: wf.authorName,
    authorImage: wf.authorImage,
    createdAt: wf.createdAt.toISOString(),
    updatedAt: wf.updatedAt.toISOString(),
    nodes: wf.nodes.map((n) => ({
      id: n.id,
      order: n.order,
      toolName: n.toolName,
      toolSlug: n.toolSlug,
      toolDomain: n.toolDomain,
      useCase: n.useCase,
      positionX: n.positionX,
      positionY: n.positionY,
    })),
    edges: wf.edges.map((e) => ({
      sourceNodeId: e.sourceNodeId,
      targetNodeId: e.targetNodeId,
    })),
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isValidCuid(params.id)) return err('Invalid id', 'INVALID_ID', 400)
  const { userId } = auth()
  if (!userId) return err('Sign in required', 'UNAUTHORIZED', 401)

  const wf = await prisma.workflow.findUnique({
    where: { id: params.id },
    select: { authorId: true },
  })
  if (!wf) return err('Workflow not found', 'NOT_FOUND', 404)
  if (wf.authorId !== userId) return err('Forbidden', 'FORBIDDEN', 403)

  await prisma.workflow.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isValidCuid(params.id)) return err('Invalid id', 'INVALID_ID', 400)
  const { userId } = auth()
  if (!userId) return err('Sign in required', 'UNAUTHORIZED', 401)

  const wf = await prisma.workflow.findUnique({
    where: { id: params.id },
    select: { authorId: true },
  })
  if (!wf) return err('Workflow not found', 'NOT_FOUND', 404)
  if (wf.authorId !== userId) return err('Forbidden', 'FORBIDDEN', 403)

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return err('Invalid JSON body', 'INVALID_JSON', 400)
  }
  const data = sanitizeWorkflowInput(raw)
  if (!data) return err('Invalid workflow payload', 'INVALID_BODY', 400)

  try {
    await prisma.$transaction(async (tx) => {
      // Order matters: edges first (FK-free but referentially scoped), then nodes.
      // WorkflowEdge has cascade on workflowId so deleting nodes would already drop edges,
      // but we do it explicitly to keep the operation order obvious and to avoid relying on
      // a cascade that doesn't actually fire from node deletes (the FK is on workflowId).
      await tx.workflowEdge.deleteMany({ where: { workflowId: params.id } })
      await tx.workflowNode.deleteMany({ where: { workflowId: params.id } })
      await tx.workflow.update({
        where: { id: params.id },
        data: {
          title: data.title,
          description: data.description || null,
          isPublic: data.isPublic,
        },
      })
      if (data.nodes.length > 0) {
        await tx.workflowNode.createMany({
          data: data.nodes.map((n) => ({
            id: n.id,
            workflowId: params.id,
            order: n.order,
            toolName: n.toolName,
            toolSlug: n.toolSlug,
            toolDomain: n.toolDomain,
            useCase: n.useCase,
            positionX: n.positionX,
            positionY: n.positionY,
          })),
        })
      }
      if (data.edges.length > 0) {
        await tx.workflowEdge.createMany({
          data: data.edges.map((e) => ({
            workflowId: params.id,
            sourceNodeId: e.sourceNodeId,
            targetNodeId: e.targetNodeId,
          })),
          skipDuplicates: true,
        })
      }
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('workflow patch error', e)
    return err('Failed to update workflow', 'UPDATE_FAILED', 500)
  }
}
