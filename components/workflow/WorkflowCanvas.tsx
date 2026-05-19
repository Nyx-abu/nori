'use client'

// Fix-pass decision: nodeTypes is declared at module scope so React Flow never re-registers it across renders (the classic "node flickers / disappears" cause). Canvas wrapper now has an explicit pixel height — relying on flex-1 alone produced 0-height containers in some chromium variants. Drawer switched to /api/tools/search (library + Gemini + dedup + ranking).
import * as React from 'react'
import { useRouter } from 'next/navigation'
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  applyNodeChanges,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { ToolNode, type ToolNodeData } from './ToolNode'
import { ToolLogo } from '../ui/ToolLogo'
import { Spinner } from '../ui/Spinner'
import { cn } from '../ui/cn'
import { rankToolsForQuery } from '@/lib/tool-ranking'

type WfNode = Node<ToolNodeData>

// CRITICAL: declared outside the component so the reference is stable across renders.
// React Flow logs a warning and may drop nodes if nodeTypes changes identity.
const nodeTypes = {
  tool: (props: NodeProps<ToolNodeData>) => (
    <ToolNode data={props.data} selected={props.selected} />
  ),
}

// Global header is 64px (h-16 in components/layout/Header.tsx); canvas fills the rest.
const CANVAS_HEIGHT = 'calc(100vh - 64px)'

const FIRST_NODE_POSITION = { x: 100, y: 100 }
const NODE_SPACING_Y = 180

type DrawerTool = {
  id: string
  name: string
  tagline: string
  website: string
  domain: string | null
  pricing: string
  source: 'db' | 'gemini'
  whyRelevant: string | null
  slug?: string
}

type Props = {
  initialTitle?: string
  initialDescription?: string
  initialIsPublic?: boolean
  initialNodes?: Array<{
    toolName: string
    toolSlug?: string | null
    toolDomain?: string | null
    useCase: string
    positionX: number
    positionY: number
  }>
  workflowId?: string
}

export function WorkflowCanvas({
  initialTitle = '',
  initialDescription = '',
  initialIsPublic = false,
  initialNodes = [],
  workflowId,
}: Props) {
  const router = useRouter()
  const [title, setTitle] = React.useState(initialTitle)
  const [description, setDescription] = React.useState(initialDescription)
  const [isPublic, setIsPublic] = React.useState(initialIsPublic)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  // Mount gate: ReactFlow uses ResizeObserver/document, which 'use client' alone doesn't shield from SSR.
  // Without this, the renderer hydrates against a server-rendered placeholder and silently drops nodes.
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // logical chain — order in this array is the workflow order
  const [chain, setChain] = React.useState<Array<{
    toolName: string
    toolSlug: string | null
    toolDomain: string | null
    useCase: string
    positionX: number
    positionY: number
  }>>(() =>
    initialNodes.map((n, i) => ({
      toolName: n.toolName,
      toolSlug: n.toolSlug ?? null,
      toolDomain: n.toolDomain ?? null,
      useCase: n.useCase,
      positionX: n.positionX || FIRST_NODE_POSITION.x,
      positionY: n.positionY || FIRST_NODE_POSITION.y + i * NODE_SPACING_Y,
    })),
  )

  const updateUseCase = (i: number, v: string) => {
    setChain((c) => c.map((n, idx) => (idx === i ? { ...n, useCase: v } : n)))
  }
  const removeAt = (i: number) => {
    setChain((c) => c.filter((_, idx) => idx !== i))
  }
  const moveLeft = (i: number) => {
    setChain((c) => {
      if (i <= 0) return c
      const out = [...c]
      const tmp = out[i - 1]!
      out[i - 1] = out[i]!
      out[i] = tmp
      return out
    })
  }
  const moveRight = (i: number) => {
    setChain((c) => {
      if (i >= c.length - 1) return c
      const out = [...c]
      const tmp = out[i + 1]!
      out[i + 1] = out[i]!
      out[i] = tmp
      return out
    })
  }

  const nodes: WfNode[] = React.useMemo(
    () =>
      chain.map((n, i) => ({
        id: `n-${i}`,
        type: 'tool',
        position: { x: n.positionX, y: n.positionY },
        data: {
          toolName: n.toolName,
          toolSlug: n.toolSlug,
          toolDomain: n.toolDomain,
          useCase: n.useCase,
          editable: true,
          onUseCaseChange: (v: string) => updateUseCase(i, v),
          onRemove: () => removeAt(i),
          onMoveLeft: () => moveLeft(i),
          onMoveRight: () => moveRight(i),
          canMoveLeft: i > 0,
          canMoveRight: i < chain.length - 1,
        },
      })),
    [chain],
  )

  // edges rebuild whenever the chain order changes
  const edges: Edge[] = React.useMemo(
    () =>
      chain.slice(0, -1).map((_, i) => ({
        id: `e-${i}-${i + 1}`,
        source: `n-${i}`,
        target: `n-${i + 1}`,
        animated: true,
        style: { stroke: '#1A1A1A', strokeWidth: 2 },
      })),
    [chain],
  )

  const onNodesChange = (changes: NodeChange[]) => {
    const next = applyNodeChanges(changes, nodes) as WfNode[]
    setChain((c) =>
      c.map((n, i) => {
        const m = next.find((x) => x.id === `n-${i}`)
        if (!m) return n
        return { ...n, positionX: m.position.x, positionY: m.position.y }
      }),
    )
  }

  const addTool = (tool: DrawerTool) => {
    setChain((c) => {
      const lastY = c.length > 0 ? c[c.length - 1]!.positionY : FIRST_NODE_POSITION.y - NODE_SPACING_Y
      return [
        ...c,
        {
          toolName: tool.name,
          toolSlug: tool.slug ?? null,
          toolDomain: tool.domain ?? null,
          useCase: '',
          positionX: FIRST_NODE_POSITION.x,
          positionY: lastY + NODE_SPACING_Y,
        },
      ]
    })
    setDrawerOpen(false)
  }

  const onSave = async () => {
    setError(null)
    if (title.trim().length < 1) {
      setError('Workflow needs a title.')
      return
    }
    if (chain.length < 1) {
      setError('Add at least one tool.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        isPublic,
        nodes: chain.map((n, i) => ({
          order: i,
          toolName: n.toolName,
          toolSlug: n.toolSlug,
          toolDomain: n.toolDomain,
          useCase: n.useCase,
          positionX: n.positionX,
          positionY: n.positionY,
        })),
      }
      const url = workflowId ? `/api/workflows/${workflowId}` : '/api/workflows/create'
      const method = workflowId ? 'PATCH' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Save failed (${r.status})`)
      }
      const body = (await r.json()) as { workflowId?: string; ok?: boolean }
      const id = body.workflowId ?? workflowId
      if (id) router.push(isPublic ? `/workflows/${id}` : '/profile')
      else router.push('/profile')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex w-full flex-col bg-background" style={{ height: CANVAS_HEIGHT }}>
      <header className="z-20 flex flex-wrap items-center gap-3 border-b-4 border-border bg-surface px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => router.push('/workflows')}
          className="rounded-pill border-2 border-border bg-surface-2 px-3 py-1.5 text-xs font-extrabold text-text-primary shadow-[2px_2px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-0.5"
        >
          ← back
        </button>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled workflow"
          maxLength={100}
          className="min-w-0 flex-1 rounded-md border-2 border-border bg-surface px-3 py-2 text-lg font-extrabold text-text-primary placeholder:text-text-muted shadow-[2px_2px_0px_#1A1A1A] focus:outline-none focus:border-accent"
        />
        <label className="flex items-center gap-2 rounded-pill border-2 border-border bg-surface px-3 py-1.5 text-xs font-extrabold text-text-primary shadow-[2px_2px_0px_#1A1A1A]">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Public
        </label>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-pill border-2 border-border bg-accent-glow px-4 py-2 text-sm font-extrabold text-text-primary shadow-[3px_3px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#1A1A1A]"
        >
          <span className="sm:hidden">+ Add</span>
          <span className="hidden sm:inline">+ Add tool</span>
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-pill border-2 border-border bg-accent px-5 py-2 text-sm font-extrabold text-surface shadow-[3px_3px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#1A1A1A] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : workflowId ? 'Update' : 'Save'}
        </button>
      </header>

      <div className="border-b-2 border-border bg-surface-2 px-4 py-2 sm:px-6">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          maxLength={500}
          // text-base (16px) avoids iOS focus-zoom on phones.
          className="w-full bg-transparent text-base font-bold text-text-primary placeholder:text-text-muted focus:outline-none"
        />
      </div>

      {error && (
        <div className="border-b-2 border-border bg-accent-pink px-4 py-2 text-sm font-extrabold text-text-primary sm:px-6">
          {error}
        </div>
      )}

      <div className="relative flex-1" style={{ minHeight: 300 }}>
        {mounted ? (
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.3}
              maxZoom={2}
              defaultEdgeOptions={{ animated: true }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={'dots' as never} gap={24} size={1.5} color="#EAE5D9" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-bold text-text-secondary">
            <Spinner /> <span className="ml-2">Loading canvas…</span>
          </div>
        )}

        {mounted && chain.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl border-4 border-dashed border-border bg-surface px-8 py-6 text-center shadow-[6px_6px_0px_#1A1A1A]">
              <p className="text-lg font-extrabold text-text-primary">Empty canvas</p>
              <p className="mt-1 text-sm font-bold text-text-secondary">
                Hit "+ Add tool" to start your workflow.
              </p>
            </div>
          </div>
        )}
      </div>

      {drawerOpen && (
        <ToolPickerDrawer
          excludeNames={chain.map((c) => c.toolName)}
          onPick={addTool}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  )
}

type DrawerProps = {
  excludeNames: string[]
  onPick: (t: DrawerTool) => void
  onClose: () => void
}

function ToolPickerDrawer({ excludeNames, onPick, onClose }: DrawerProps) {
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<DrawerTool[]>([])
  // Drawer-local toggle. Server returns merged results in library-first order;
  // this re-orders client-side so toggling is instant (no extra fetch).
  const [aiFirst, setAiFirst] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    const trimmed = query.trim()
    // 300ms debounce except for the initial empty-query preload which fires immediately
    const delay = trimmed.length === 0 ? 0 : 300
    setLoading(true)
    const t = setTimeout(() => {
      const url = `/api/tools/search${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ''}`
      fetch(url)
        .then((r) => r.json())
        .then((data: { results: DrawerTool[] }) => {
          if (cancelled) return
          setResults(data.results ?? [])
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, delay)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const exclude = new Set(excludeNames.map((n) => n.toLowerCase().trim()))
  const filtered = results.filter((r) => !exclude.has(r.name.toLowerCase().trim()))
  const visible = rankToolsForQuery(filtered, query, { aiFirst })

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l-4 border-border bg-background p-5"
        style={{ boxShadow: '-8px 0px 0px #1A1A1A' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-extrabold text-text-primary">Add a tool</h3>
          <button
            onClick={onClose}
            className="rounded-pill border-2 border-border bg-surface px-3 py-1 text-xs font-extrabold text-text-primary shadow-[2px_2px_0px_#1A1A1A]"
          >
            close
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="Search the library or ask AI…"
          maxLength={200}
          className="mt-4 w-full rounded-md border-2 border-border bg-surface px-3 py-2 text-base font-bold text-text-primary placeholder:text-text-muted shadow-[2px_2px_0px_#1A1A1A] focus:outline-none focus:border-accent"
        />

        <div className="mt-3 flex items-center gap-2">
          <span className="text-2xs font-extrabold uppercase tracking-widest text-text-muted">
            Order
          </span>
          <button
            type="button"
            onClick={() => setAiFirst(false)}
            className={cn(
              'rounded-pill border-2 border-border px-3 py-1 text-2xs font-extrabold text-text-primary transition-all duration-base ease-enter shadow-[2px_2px_0px_#1A1A1A]',
              !aiFirst
                ? 'bg-accent-glow -translate-y-0.5 shadow-[3px_3px_0px_#1A1A1A]'
                : 'bg-surface hover:-translate-y-0.5 hover:bg-accent-blue',
            )}
          >
            Library first
          </button>
          <button
            type="button"
            onClick={() => setAiFirst(true)}
            className={cn(
              'rounded-pill border-2 border-border px-3 py-1 text-2xs font-extrabold text-text-primary transition-all duration-base ease-enter shadow-[2px_2px_0px_#1A1A1A]',
              aiFirst
                ? 'bg-accent-glow -translate-y-0.5 shadow-[3px_3px_0px_#1A1A1A]'
                : 'bg-surface hover:-translate-y-0.5 hover:bg-accent-pink',
            )}
          >
            AI first
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-sm font-bold text-text-secondary">
              <Spinner /> {query.trim() ? 'Searching…' : 'Loading library…'}
            </div>
          )}
          {!loading && visible.length === 0 && (
            <p className="text-sm font-bold text-text-secondary">
              {query.trim() ? 'No matches. Try a different phrase.' : 'No tools to show.'}
            </p>
          )}
          {visible.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r)}
              className={cn(
                'flex w-full items-start gap-3 rounded-md border-2 border-border bg-surface p-3 text-left shadow-[2px_2px_0px_#1A1A1A] transition-all duration-base ease-enter',
                'hover:-translate-y-0.5 hover:bg-accent-pink hover:shadow-[3px_3px_0px_#1A1A1A]',
              )}
            >
              <ToolLogo name={r.name} domain={r.domain} size={32} framed />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-text-primary">
                  {r.name}
                  {r.source === 'gemini' && (
                    <span className="ml-2 rounded-pill border-2 border-border bg-accent-glow px-2 py-0.5 text-2xs font-extrabold text-text-primary">
                      AI
                    </span>
                  )}
                </p>
                <p className="truncate text-xs font-bold text-text-secondary">{r.tagline}</p>
                {r.source === 'gemini' && r.whyRelevant && (
                  <p className="mt-1 line-clamp-2 text-2xs font-bold text-text-muted">
                    {r.whyRelevant}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
