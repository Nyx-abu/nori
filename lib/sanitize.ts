// Phase 3 decision: native sanitization (no zod) — strip HTML, normalize whitespace, cap length. Keeps runtime small for the MVP.
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g
const HTML_ENTITY = /&(?:#x?[0-9a-fA-F]+|[a-zA-Z]+);/g

export function sanitizeQuery(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(HTML_TAG, ' ')
    .replace(HTML_ENTITY, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export function isValidSlug(input: unknown): input is string {
  return typeof input === 'string' && /^[a-z0-9][a-z0-9-]{0,80}$/.test(input)
}

export function clampPage(input: unknown, fallback = 1): number {
  const n = typeof input === 'string' ? parseInt(input, 10) : Number(input)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(n, 1000)
}

export function clampLimit(input: unknown, fallback = 20, max = 50): number {
  const n = typeof input === 'string' ? parseInt(input, 10) : Number(input)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(n, max)
}

export function stripHtml(input: string): string {
  return input
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/&(?:#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type WorkflowNodeInput = {
  // Client-generated stable id used by edges to reference this node. Always opaque to the DB —
  // it becomes the WorkflowNode.id directly so saved edges remain referentially valid across reloads.
  id: string
  order: number
  toolName: string
  toolSlug: string | null
  toolDomain: string | null
  useCase: string
  positionX: number
  positionY: number
}

export type WorkflowEdgeInput = {
  sourceNodeId: string
  targetNodeId: string
}

export type SanitizedWorkflow = {
  title: string
  description: string
  isPublic: boolean
  nodes: WorkflowNodeInput[]
  edges: WorkflowEdgeInput[]
}

function isValidHostname(s: string): boolean {
  try {
    return new URL(`https://${s}`).hostname === s
  } catch {
    return false
  }
}

// Accept any reasonable stable id format: cuid, uuid-with-or-without-dashes, our n_ prefix.
// We don't care about exact format — only that it's a printable, length-bounded ASCII slug
// that can safely round-trip through the DB primary key column.
const NODE_ID_RE = /^[A-Za-z0-9_-]{6,80}$/

export function sanitizeWorkflowInput(raw: unknown): SanitizedWorkflow | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>

  const title = typeof r.title === 'string' ? stripHtml(r.title).slice(0, 100) : ''
  if (title.length < 1) return null

  const description =
    typeof r.description === 'string' ? stripHtml(r.description).slice(0, 500) : ''
  const isPublic = r.isPublic === true

  if (!Array.isArray(r.nodes) || r.nodes.length < 1 || r.nodes.length > 25) return null

  const nodes: WorkflowNodeInput[] = []
  const idsSeen = new Set<string>()
  for (let i = 0; i < r.nodes.length; i++) {
    const n = r.nodes[i]
    if (typeof n !== 'object' || n === null) return null
    const item = n as Record<string, unknown>

    // Generate a stable id if the client didn't send one. Older WorkflowCanvas builds
    // and any non-canvas caller (tests, scripts) won't carry ids — we mint a deterministic
    // one keyed off the order so edges from the same payload could still wire up.
    const rawId = typeof item.id === 'string' ? item.id : ''
    const id = NODE_ID_RE.test(rawId) ? rawId : `n_legacy_${i}_${Date.now().toString(36)}`
    if (idsSeen.has(id)) return null
    idsSeen.add(id)

    const toolName =
      typeof item.toolName === 'string' && item.toolName.trim().length > 0
        ? stripHtml(item.toolName).slice(0, 100)
        : 'Unknown Tool'
    nodes.push({
      id,
      order: i,
      toolName,
      toolSlug:
        typeof item.toolSlug === 'string' && item.toolSlug.length > 0
          ? item.toolSlug.slice(0, 100)
          : null,
      toolDomain:
        typeof item.toolDomain === 'string' && item.toolDomain.length > 0 && isValidHostname(item.toolDomain.slice(0, 253))
          ? item.toolDomain.slice(0, 253)
          : null,
      useCase:
        typeof item.useCase === 'string' ? stripHtml(item.useCase).slice(0, 200) : '',
      positionX: typeof item.positionX === 'number' ? item.positionX : 0,
      positionY: typeof item.positionY === 'number' ? item.positionY : 0,
    })
  }

  // Edges are optional. We validate that both endpoints refer to ids in the same payload,
  // dedupe by (source, target), and cap the total count to bound write cost.
  const edges: WorkflowEdgeInput[] = []
  if (Array.isArray(r.edges)) {
    const edgeKeys = new Set<string>()
    for (const e of r.edges) {
      if (typeof e !== 'object' || e === null) continue
      const item = e as Record<string, unknown>
      const source = typeof item.sourceNodeId === 'string' ? item.sourceNodeId : ''
      const target = typeof item.targetNodeId === 'string' ? item.targetNodeId : ''
      if (!idsSeen.has(source) || !idsSeen.has(target)) continue
      if (source === target) continue
      const key = `${source}__${target}`
      if (edgeKeys.has(key)) continue
      edgeKeys.add(key)
      edges.push({ sourceNodeId: source, targetNodeId: target })
      // Cap matches what a 25-node fully connected workflow would need; well above realistic usage.
      if (edges.length >= 300) break
    }
  }

  return { title, description, isPublic, nodes, edges }
}
