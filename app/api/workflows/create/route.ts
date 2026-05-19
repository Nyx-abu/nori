// P7 decision: title/desc/nodes are sanitized server-side; authorId comes from Clerk's auth() — NEVER from the client body. Insertion is wrapped in a transaction so partial node writes can't orphan a workflow.
import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { sanitizeWorkflowInput } from '@/lib/sanitize'
import type { ApiError } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function err(msg: string, code: string, status: number) {
  const body: ApiError = { error: msg, code }
  return NextResponse.json(body, { status })
}

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return err('Sign in required', 'UNAUTHORIZED', 401)

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return err('Invalid JSON body', 'INVALID_JSON', 400)
  }

  const data = sanitizeWorkflowInput(raw)
  if (!data) return err('Invalid workflow payload', 'INVALID_BODY', 400)

  const user = await currentUser()
  const authorName =
    user?.fullName ||
    user?.firstName ||
    user?.username ||
    user?.emailAddresses[0]?.emailAddress ||
    'Anonymous'
  const authorImage = user?.imageUrl ?? null

  try {
    const created = await prisma.$transaction(async (tx) => {
      const wf = await tx.workflow.create({
        data: {
          title: data.title,
          description: data.description || null,
          isPublic: data.isPublic,
          authorId: userId,
          authorName,
          authorImage,
        },
      })
      if (data.nodes.length > 0) {
        await tx.workflowNode.createMany({
          data: data.nodes.map((n) => ({
            workflowId: wf.id,
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
      return wf
    })
    return NextResponse.json({ workflowId: created.id }, { status: 201 })
  } catch (e) {
    console.error('workflow create error', e)
    return err('Failed to create workflow', 'CREATE_FAILED', 500)
  }
}
