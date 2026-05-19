import { ToolCard } from './ToolCard'
import type { ToolResult } from '@/lib/types'

type Props = {
  tools: ToolResult[]
  emptyMessage?: string
}

export function ToolGrid({ tools, emptyMessage = 'No tools found' }: Props) {
  if (tools.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center text-sm text-text-secondary">
        {emptyMessage}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((t) => (
        <ToolCard key={t.id} tool={t} />
      ))}
    </div>
  )
}
