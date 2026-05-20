'use client'

// Free-form canvas (n8n-style): nodes have stable ids, edges are first-class state, users drag
// between handles to connect, select-then-Delete to remove, and the save payload carries both arrays.
// Key invariants:
//   - nodeTypes / edgeTypes are module-scope so React Flow never re-registers them (classic "blank canvas" bug).
//   - Each node carries a stable client-generated id so edges can reference it across saves/reloads.
//   - When a loaded workflow has no edges (legacy linear chain), we synthesize them from node order
//     so existing workflows render correctly and migrate to the edge model on next save.
//   - Mount gate keeps ReactFlow from running its ResizeObserver against Next.js's SSR placeholder.
import * as React from 'react'
import { useRouter } from 'next/navigation'
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { ToolNode, type ToolNodeData } from './ToolNode'
import { ToolLogo } from '../ui/ToolLogo'
import { Spinner } from '../ui/Spinner'
import { cn } from '../ui/cn'
import { rankToolsForQuery } from '@/lib/tool-ranking'
import { usePostHog } from 'posthog-js/react'

type WfNode = Node<ToolNodeData>

// CRITICAL: declared outside the component so the reference is stable across renders.
// React Flow logs a warning and may drop nodes if nodeTypes changes identity.
const nodeTypes = {
  tool: (props: NodeProps<ToolNodeData>) => (
    <ToolNode data={props.data} selected={props.selected} />
  ),
}

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: '#1A1A1A', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#1A1A1A', width: 18, height: 18 },
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

type InitialNode = {
  id?: string
  toolName: string
  toolSlug?: string | null
  toolDomain?: string | null
  useCase: string
  positionX: number
  positionY: number
}

type InitialEdge = {
  sourceNodeId: string
  targetNodeId: string
}

type Props = {
  initialTitle?: string
  initialDescription?: string
  initialIsPublic?: boolean
  initialNodes?: InitialNode[]
  initialEdges?: InitialEdge[]
  workflowId?: string
}

// Generates a stable id for a freshly-added node. We accept the loaded DB id when present;
// otherwise client-generated ids let edges reference nodes that haven't been persisted yet.
function makeNodeId(): string {
  // crypto.randomUUID is supported in modern browsers + Node 19+. Fallback is base36-time.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return 'n_' + (crypto as Crypto).randomUUID().replace(/-/g, '')
  }
  return 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export function WorkflowCanvas({
  initialTitle = '',
  initialDescription = '',
  initialIsPublic = false,
  initialNodes = [],
  initialEdges = [],
  workflowId,
}: Props) {
  const router = useRouter()
  const posthog = usePostHog()
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

  // Tool payload kept alongside the React Flow node so updates flow through one place.
  const [toolByNodeId, setToolByNodeId] = React.useState<Map<string, {
    toolName: string
    toolSlug: string | null
    toolDomain: string | null
    useCase: string
  }>>(() => {
    const m = new Map<string, { toolName: string; toolSlug: string | null; toolDomain: string | null; useCase: string }>()
    for (const n of initialNodes) {
      const id = n.id ?? makeNodeId()
      m.set(id, {
        toolName: n.toolName,
        toolSlug: n.toolSlug ?? null,
        toolDomain: n.toolDomain ?? null,
        useCase: n.useCase,
      })
    }
    return m
  })

  const [nodes, setNodes] = React.useState<WfNode[]>(() =>
    initialNodes.map((n, i) => {
      const id = n.id ?? makeNodeId()
      // Re-key Map entries when the caller didn't supply ids (covers the case
      // where two initial-state initializers race and the Map keys diverge).
      // Safe because the Map was just constructed above.
      return {
        id,
        type: 'tool',
        position: {
          x: n.positionX || FIRST_NODE_POSITION.x,
          y: n.positionY || FIRST_NODE_POSITION.y + i * NODE_SPACING_Y,
        },
        data: { toolName: n.toolName, toolSlug: n.toolSlug ?? null, toolDomain: n.toolDomain ?? null, useCase: n.useCase, editable: true },
      }
    }),
  )

  // Edges: if the loaded workflow has saved edges, use them. If not but there are >=2 nodes,
  // synthesize a linear chain so legacy linear workflows still look correct — saving will then
  // persist these edges as real records.
  const [edges, setEdges] = React.useState<Edge[]>(() => {
    if (initialEdges.length > 0) {
      return initialEdges.map((e) => ({
        id: `${e.sourceNodeId}__${e.targetNodeId}`,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        ...defaultEdgeOptions,
      }))
    }
    if (initialNodes.length < 2) return []
    const out: Edge[] = []
    const ids = (Array.from(toolByNodeId.keys()))
    // toolByNodeId is keyed by the same generated ids in the same order as initialNodes — safe.
    for (let i = 0; i < ids.length - 1; i++) {
      out.push({
        id: `${ids[i]}__${ids[i + 1]}`,
        source: ids[i] as string,
        target: ids[i + 1] as string,
        ...defaultEdgeOptions,
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })

  const updateUseCase = React.useCallback((id: string, v: string) => {
    setToolByNodeId((prev) => {
      const next = new Map(prev)
      const existing = next.get(id)
      if (!existing) return prev
      next.set(id, { ...existing, useCase: v })
      return next
    })
  }, [])

  const removeNode = React.useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
    setToolByNodeId((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  // Recompute node data whenever the tool map or the bare node positions change so that
  // tool fields, callbacks, and editable flag stay in sync without re-creating WfNode shells.
  const enrichedNodes = React.useMemo<WfNode[]>(
    () =>
      nodes.map((n) => {
        const tool = toolByNodeId.get(n.id)
        if (!tool) return n
        return {
          ...n,
          data: {
            toolName: tool.toolName,
            toolSlug: tool.toolSlug,
            toolDomain: tool.toolDomain,
            useCase: tool.useCase,
            editable: true,
            onUseCaseChange: (v: string) => updateUseCase(n.id, v),
            onRemove: () => removeNode(n.id),
            // Move buttons removed — connections are user-drawn now, no implicit linear order.
            canMoveLeft: false,
            canMoveRight: false,
          },
        }
      }),
    [nodes, toolByNodeId, updateUseCase, removeNode],
  )

  const onNodesChange = React.useCallback((changes: NodeChange[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns) as WfNode[])
  }, [])

  const onEdgesChange = React.useCallback((changes: EdgeChange[]) => {
    setEdges((es) => applyEdgeChanges(changes, es))
  }, [])

  const onConnect = React.useCallback((conn: Connection) => {
    if (!conn.source || !conn.target) return
    if (conn.source === conn.target) return
    setEdges((es) => {
      // Prevent duplicates: addEdge already does this via comparing source/target/handles, but
      // we override the id so it's stable across reloads (used as the DB row identity).
      const id = `${conn.source}__${conn.target}`
      if (es.some((e) => e.id === id)) return es
      return addEdge({ ...conn, id, ...defaultEdgeOptions }, es)
    })
  }, [])

  const addTool = (tool: DrawerTool) => {
    const id = makeNodeId()
    // place new nodes below the lowest existing one so they don't overlap
    const lastY = nodes.length > 0 ? Math.max(...nodes.map((n) => n.position.y)) : FIRST_NODE_POSITION.y - NODE_SPACING_Y
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'tool',
        position: { x: FIRST_NODE_POSITION.x, y: lastY + NODE_SPACING_Y },
        data: {
          toolName: tool.name,
          toolSlug: tool.slug ?? null,
          toolDomain: tool.domain ?? null,
          useCase: '',
          editable: true,
        },
      },
    ])
    setToolByNodeId((prev) => {
      const next = new Map(prev)
      next.set(id, {
        toolName: tool.name,
        toolSlug: tool.slug ?? null,
        toolDomain: tool.domain ?? null,
        useCase: '',
      })
      return next
    })
    setDrawerOpen(false)
  }

  const onSave = async () => {
    setError(null)
    if (title.trim().length < 1) {
      setError('Workflow needs a title.')
      return
    }
    if (nodes.length < 1) {
      setError('Add at least one tool.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        isPublic,
        nodes: nodes.map((n, i) => {
          const tool = toolByNodeId.get(n.id)
          return {
            id: n.id,
            order: i,
            toolName: tool?.toolName ?? 'Unknown Tool',
            toolSlug: tool?.toolSlug ?? null,
            toolDomain: tool?.toolDomain ?? null,
            useCase: tool?.useCase ?? '',
            positionX: n.position.x,
            positionY: n.position.y,
          }
        }),
        edges: edges.map((e) => ({ sourceNodeId: e.source, targetNodeId: e.target })),
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
      posthog?.capture(workflowId ? 'workflow_updated' : 'workflow_created', {
        workflow_id: id,
        node_count: nodes.length,
        is_public: isPublic,
        tool_names: nodes.map((n) => toolByNodeId.get(n.id)?.toolName ?? 'Unknown'),
      })
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

      <div className="border-b border-border/50 bg-surface-2 px-4 py-1.5 text-2xs font-bold text-text-muted sm:px-6">
        Drag a node by its dark dot to connect. Click an edge then press Delete to remove it.
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
              nodes={enrichedNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.3}
              maxZoom={2}
              defaultEdgeOptions={defaultEdgeOptions}
              deleteKeyCode={['Backspace', 'Delete']}
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

        {mounted && nodes.length === 0 && (
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
          excludeNames={Array.from(toolByNodeId.values()).map((t) => t.toolName)}
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
