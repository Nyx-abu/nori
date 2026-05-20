'use client'

// P7 decision: detail view shows the saved workflow. When the workflow has user-drawn edges
// we render a read-only ReactFlow canvas (n8n-style); otherwise we fall back to the original
// vertical chain. Owners get Edit + Delete actions inline; delete confirms via window.confirm.
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { usePostHog } from 'posthog-js/react'
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { ToolNode, type ToolNodeData } from './ToolNode'
import { ToolLogo } from '../ui/ToolLogo'

type WorkflowNode = {
  id: string
  order: number
  toolName: string
  toolSlug: string | null
  toolDomain: string | null
  useCase: string
  positionX?: number
  positionY?: number
}

type WorkflowEdge = {
  sourceNodeId: string
  targetNodeId: string
}

type Workflow = {
  id: string
  title: string
  description: string | null
  isPublic: boolean
  authorId: string
  authorName: string
  authorImage: string | null
  createdAt: string
  nodes: WorkflowNode[]
  edges?: WorkflowEdge[]
}

// Module-scope for the same reason as the editor: React Flow drops nodes if nodeTypes
// changes identity. ToolNode renders without callbacks here (editable=false).
const nodeTypes = {
  tool: (props: NodeProps<ToolNodeData>) => (
    <ToolNode data={props.data} selected={props.selected} />
  ),
}

const detailEdgeOptions = {
  animated: true,
  style: { stroke: '#1A1A1A', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#1A1A1A', width: 18, height: 18 },
}

export function WorkflowDetail({
  workflow,
  isOwner,
}: {
  workflow: Workflow
  isOwner: boolean
}) {
  const router = useRouter()
  const posthog = usePostHog()
  // Mount gate parity with the editor.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!posthog) return
    posthog.capture('workflow_viewed', {
      workflow_id: workflow.id,
      is_owner: isOwner,
      is_public: workflow.isPublic,
      node_count: workflow.nodes.length,
    })
  }, [posthog, workflow.id, isOwner, workflow.isPublic, workflow.nodes.length])

  const onDelete = async () => {
    if (!window.confirm('Delete this workflow? This cannot be undone.')) return
    const r = await fetch(`/api/workflows/${workflow.id}`, { method: 'DELETE' })
    if (r.ok) {
      posthog?.capture('workflow_deleted', { workflow_id: workflow.id })
      router.push('/profile')
    } else {
      window.alert('Failed to delete workflow.')
    }
  }

  const hasGraph = (workflow.edges?.length ?? 0) > 0 && workflow.nodes.length > 0

  const flowNodes = useMemo<Node<ToolNodeData>[]>(
    () =>
      workflow.nodes.map((n, i) => ({
        id: n.id,
        type: 'tool',
        position: {
          x: typeof n.positionX === 'number' ? n.positionX : 100,
          y: typeof n.positionY === 'number' ? n.positionY : 100 + i * 180,
        },
        data: {
          toolName: n.toolName,
          toolSlug: n.toolSlug,
          toolDomain: n.toolDomain,
          useCase: n.useCase,
          editable: false,
        },
        draggable: false,
      })),
    [workflow.nodes],
  )

  const flowEdges = useMemo<Edge[]>(
    () =>
      (workflow.edges ?? []).map((e) => ({
        id: `${e.sourceNodeId}__${e.targetNodeId}`,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        ...detailEdgeOptions,
      })),
    [workflow.edges],
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="rounded-xl border-2 border-border bg-surface p-6 shadow-[6px_6px_0px_#1A1A1A]">
        <div className="flex items-center gap-2">
          <span className="rounded-pill border-2 border-border bg-accent-glow px-3 py-0.5 text-2xs font-extrabold text-text-primary shadow-[2px_2px_0px_#1A1A1A]">
            {workflow.isPublic ? 'Public' : 'Private'}
          </span>
          <span className="text-2xs font-bold text-text-muted">
            {new Date(workflow.createdAt).toLocaleDateString()}
          </span>
        </div>
        <h1 className="mt-3 break-words text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
          {workflow.title}
        </h1>
        {workflow.description && (
          <p className="mt-2 text-base font-bold text-text-secondary">{workflow.description}</p>
        )}
        <p className="mt-3 text-sm font-bold text-text-muted">
          by {workflow.authorName} · {workflow.nodes.length} tool
          {workflow.nodes.length === 1 ? '' : 's'}
        </p>

        {isOwner && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push(`/workflows/edit/${workflow.id}`)}
              className="rounded-pill border-2 border-border bg-accent-blue px-4 py-1.5 text-xs font-extrabold text-text-primary shadow-[2px_2px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_#1A1A1A]"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="rounded-pill border-2 border-border bg-accent-pink px-4 py-1.5 text-xs font-extrabold text-text-primary shadow-[2px_2px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_#1A1A1A]"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {hasGraph ? (
        <div className="mt-10">
          <h2 className="mb-5 text-xl font-extrabold tracking-tight text-text-primary">The graph</h2>
          <div
            className="relative rounded-xl border-2 border-border bg-surface shadow-[6px_6px_0px_#1A1A1A]"
            style={{ height: 520 }}
          >
            {mounted ? (
              <ReactFlowProvider>
                <ReactFlow
                  nodes={flowNodes}
                  edges={flowEdges}
                  nodeTypes={nodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.25 }}
                  minZoom={0.3}
                  maxZoom={2}
                  defaultEdgeOptions={detailEdgeOptions}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background variant={'dots' as never} gap={24} size={1.5} color="#EAE5D9" />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </ReactFlowProvider>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-10">
          <h2 className="mb-5 text-xl font-extrabold tracking-tight text-text-primary">The chain</h2>
          <div className="flex flex-col items-center gap-3">
            {workflow.nodes.map((n, i) => (
              <Fragment key={n.id}>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full max-w-md rounded-lg border-2 border-border bg-surface p-4 shadow-[4px_4px_0px_#1A1A1A]"
                >
                  <div className="flex items-start gap-3">
                    <ToolLogo name={n.toolName} domain={n.toolDomain} size={44} framed />
                    <div className="min-w-0 flex-1">
                      <p className="text-2xs font-extrabold uppercase tracking-widest text-text-muted">
                        Step {i + 1}
                      </p>
                      {n.toolSlug ? (
                        <a
                          href={`/tools/${n.toolSlug}`}
                          className="text-lg font-extrabold text-text-primary underline-offset-4 hover:underline"
                        >
                          {n.toolName}
                        </a>
                      ) : (
                        <p className="text-lg font-extrabold text-text-primary">{n.toolName}</p>
                      )}
                      {n.useCase && (
                        <p className="mt-1 text-sm font-bold text-text-secondary">{n.useCase}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
                {i < workflow.nodes.length - 1 && (
                  <span aria-hidden="true" className="text-2xl font-extrabold text-text-primary">
                    ↓
                  </span>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
