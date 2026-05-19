import Link from 'next/link'
import { ToolLogo } from '../ui/ToolLogo'

export type WorkflowCardData = {
  id: string
  title: string
  description: string | null
  isPublic: boolean
  authorName?: string
  authorImage?: string | null
  createdAt: string
  nodeCount: number
  firstNodes: Array<{ toolName: string; toolDomain: string | null }>
}

export function WorkflowCard({
  workflow,
  showLock = false,
}: {
  workflow: WorkflowCardData
  showLock?: boolean
}) {
  const extra = Math.max(0, workflow.nodeCount - workflow.firstNodes.length)
  return (
    <Link
      href={`/workflows/${workflow.id}`}
      className="group block rounded-xl border-2 border-border bg-surface p-5 shadow-[4px_4px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-1 hover:bg-accent-glow hover:shadow-[6px_6px_0px_#1A1A1A]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-pill border-2 border-border bg-accent-blue px-3 py-0.5 text-2xs font-extrabold text-text-primary shadow-[2px_2px_0px_#1A1A1A]">
          {workflow.nodeCount} step{workflow.nodeCount === 1 ? '' : 's'}
        </span>
        {showLock && !workflow.isPublic && (
          <span className="rounded-pill border-2 border-border bg-accent-pink px-3 py-0.5 text-2xs font-extrabold text-text-primary shadow-[2px_2px_0px_#1A1A1A]">
            🔒 Private
          </span>
        )}
      </div>
      <h3 className="mt-3 text-lg font-extrabold tracking-tight text-text-primary">
        {workflow.title}
      </h3>
      {workflow.description && (
        <p className="mt-1 line-clamp-2 text-sm font-bold text-text-secondary">
          {workflow.description}
        </p>
      )}
      <div className="mt-4 flex items-center gap-2">
        {workflow.firstNodes.map((n, i) => (
          <div
            key={`${n.toolName}-${i}`}
            className="rounded-md border-2 border-border bg-surface p-1 shadow-[1px_1px_0px_#1A1A1A]"
            title={n.toolName}
          >
            <ToolLogo name={n.toolName} domain={n.toolDomain} size={24} />
          </div>
        ))}
        {extra > 0 && (
          <span className="rounded-pill border-2 border-border bg-surface-2 px-2 py-0.5 text-2xs font-extrabold text-text-primary">
            +{extra} more
          </span>
        )}
      </div>
      {workflow.authorName && (
        <p className="mt-4 text-2xs font-bold text-text-muted">
          by {workflow.authorName} · {new Date(workflow.createdAt).toLocaleDateString()}
        </p>
      )}
    </Link>
  )
}
