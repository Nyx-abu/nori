'use client'

// Fix-pass decision: switched to internal `editing` state for click-to-edit UX, kept all existing neobrutalist styling and the optional callbacks. Move callbacks renamed to onMoveLeft/onMoveRight to match the parent canvas, with onMoveUp/onMoveDown kept as aliases for backwards compatibility with any other caller.
import { useState } from 'react'
import { Handle, Position } from 'reactflow'
import { ToolLogo } from '../ui/ToolLogo'
import { cn } from '../ui/cn'

export type ToolNodeData = {
  toolName: string
  toolSlug?: string | null
  toolDomain?: string | null
  useCase: string
  editable?: boolean
  onUseCaseChange?: (v: string) => void
  onRemove?: () => void
  onMoveLeft?: () => void
  onMoveRight?: () => void
  // legacy aliases (kept for any caller still using up/down)
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveLeft?: boolean
  canMoveRight?: boolean
  canMoveUp?: boolean
  canMoveDown?: boolean
}

export function ToolNode({ data, selected }: { data: ToolNodeData; selected?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.useCase ?? '')

  // resolve directional aliases
  const moveLeft = data.onMoveLeft ?? data.onMoveUp
  const moveRight = data.onMoveRight ?? data.onMoveDown
  const canLeft = data.canMoveLeft ?? data.canMoveUp ?? false
  const canRight = data.canMoveRight ?? data.canMoveDown ?? false

  const commit = () => {
    setEditing(false)
    if (draft !== (data.useCase ?? '')) {
      data.onUseCaseChange?.(draft)
    }
  }

  return (
    <div
      className={cn(
        'w-[260px] rounded-lg border-2 border-border bg-surface p-4 transition-all duration-base ease-enter',
        selected
          ? 'shadow-[6px_6px_0px_#1A1A1A] -translate-y-1'
          : 'shadow-[3px_3px_0px_#1A1A1A]',
      )}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#1A1A1A' }} />
      <div className="flex items-start gap-2">
        <ToolLogo name={data.toolName} domain={data.toolDomain ?? null} size={36} framed />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-text-primary">{data.toolName}</p>

          {data.editable && editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  setDraft(data.useCase ?? '')
                  setEditing(false)
                }
              }}
              placeholder="Why is this tool needed?"
              maxLength={200}
              className="mt-1 w-full rounded-sm border-2 border-border bg-surface-2 px-2 py-1 text-xs font-bold text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          ) : (
            <p
              onClick={() => {
                if (!data.editable) return
                setDraft(data.useCase ?? '')
                setEditing(true)
              }}
              title={data.editable ? 'Click to add a note' : undefined}
              className={cn(
                'mt-1 line-clamp-2 min-h-[1.25rem] text-xs font-bold',
                data.editable ? 'cursor-text' : '',
                data.useCase ? 'text-text-secondary' : 'text-text-muted/70',
              )}
            >
              {data.useCase || (data.editable ? 'Click to add a note…' : '—')}
            </p>
          )}
        </div>
      </div>

      {data.editable && (
        <div className="mt-2 flex items-center gap-1">
          {canLeft && (
            <NodeButton onClick={moveLeft} title="Move earlier">
              ←
            </NodeButton>
          )}
          {canRight && (
            <NodeButton onClick={moveRight} title="Move later">
              →
            </NodeButton>
          )}
          <div className="ml-auto">
            <NodeButton onClick={data.onRemove} variant="warn" title="Remove from workflow">
              ✕
            </NodeButton>
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#1A1A1A' }} />
    </div>
  )
}

function NodeButton({
  onClick,
  variant = 'default',
  title,
  children,
}: {
  onClick?: (() => void) | undefined
  variant?: 'default' | 'warn'
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-sm border-2 border-border px-2 py-0.5 text-2xs font-extrabold transition-all duration-base ease-enter',
        variant === 'warn'
          ? 'bg-accent-pink text-text-primary hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_#1A1A1A]'
          : 'bg-surface-2 text-text-primary hover:-translate-y-0.5 hover:bg-accent-glow hover:shadow-[2px_2px_0px_#1A1A1A]',
      )}
    >
      {children}
    </button>
  )
}
