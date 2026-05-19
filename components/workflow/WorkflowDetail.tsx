'use client'

// P7 decision: detail view is read-only display of the sequential chain. Owners get Edit + Delete actions inline; delete confirms via window.confirm — no modal library.
import { Fragment, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { usePostHog } from 'posthog-js/react'
import { ToolLogo } from '../ui/ToolLogo'

type Node = {
  id: string
  order: number
  toolName: string
  toolSlug: string | null
  toolDomain: string | null
  useCase: string
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
  nodes: Node[]
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
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
    </div>
  )
}
