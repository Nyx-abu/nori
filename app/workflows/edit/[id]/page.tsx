import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas'

export const dynamic = 'force-dynamic'

type Props = { params: { id: string } }

function isValidCuid(s: string): boolean {
  return /^c[a-z0-9]{20,40}$/.test(s)
}

export default async function EditWorkflowPage({ params }: Props) {
  if (!isValidCuid(params.id)) notFound()
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const wf = await prisma.workflow.findUnique({
    where: { id: params.id },
    include: {
      nodes: { orderBy: { order: 'asc' } },
      edges: true,
    },
  })
  if (!wf) notFound()
  if (wf.authorId !== userId) redirect('/workflows')

  return (
    <WorkflowCanvas
      workflowId={wf.id}
      initialTitle={wf.title}
      initialDescription={wf.description ?? ''}
      initialIsPublic={wf.isPublic}
      initialNodes={wf.nodes.map((n) => ({
        id: n.id,
        toolName: n.toolName,
        toolSlug: n.toolSlug,
        toolDomain: n.toolDomain,
        useCase: n.useCase,
        positionX: n.positionX,
        positionY: n.positionY,
      }))}
      initialEdges={wf.edges.map((e) => ({
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
      }))}
    />
  )
}
