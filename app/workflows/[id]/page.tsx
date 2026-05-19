import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { WorkflowDetail } from '@/components/workflow/WorkflowDetail'

export const dynamic = 'force-dynamic'

type Props = { params: { id: string } }

function isValidCuid(s: string): boolean {
  return /^c[a-z0-9]{20,40}$/.test(s)
}

export default async function WorkflowDetailPage({ params }: Props) {
  if (!isValidCuid(params.id)) notFound()

  const wf = await prisma.workflow.findUnique({
    where: { id: params.id },
    include: { nodes: { orderBy: { order: 'asc' } } },
  })
  if (!wf) notFound()

  if (!wf.isPublic) {
    const { userId } = auth()
    if (!userId) redirect('/sign-in')
    if (userId !== wf.authorId) redirect('/workflows')
  }

  const { userId } = auth()
  const isOwner = userId === wf.authorId

  return (
    <WorkflowDetail
      workflow={{
        id: wf.id,
        title: wf.title,
        description: wf.description,
        isPublic: wf.isPublic,
        authorId: wf.authorId,
        authorName: wf.authorName,
        authorImage: wf.authorImage,
        createdAt: wf.createdAt.toISOString(),
        nodes: wf.nodes.map((n) => ({
          id: n.id,
          order: n.order,
          toolName: n.toolName,
          toolSlug: n.toolSlug,
          toolDomain: n.toolDomain,
          useCase: n.useCase,
        })),
      }}
      isOwner={isOwner}
    />
  )
}

export async function generateMetadata({ params }: Props) {
  if (!isValidCuid(params.id)) return {}
  const wf = await prisma.workflow.findUnique({
    where: { id: params.id },
    select: { title: true, description: true, isPublic: true },
  })
  if (!wf || !wf.isPublic) return {}
  return {
    title: `${wf.title} — nori`,
    description: wf.description ?? undefined,
  }
}
