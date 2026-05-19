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
  order: number
  toolName: string
  toolSlug: string | null
  toolDomain: string | null
  useCase: string
  positionX: number
  positionY: number
}

export type SanitizedWorkflow = {
  title: string
  description: string
  isPublic: boolean
  nodes: WorkflowNodeInput[]
}

export function sanitizeWorkflowInput(raw: unknown): SanitizedWorkflow | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>

  const title = typeof r.title === 'string' ? stripHtml(r.title).slice(0, 100) : ''
  if (title.length < 1) return null

  const description =
    typeof r.description === 'string' ? stripHtml(r.description).slice(0, 500) : ''
  const isPublic = r.isPublic === true

  if (!Array.isArray(r.nodes) || r.nodes.length < 1 || r.nodes.length > 10) return null

  const nodes: WorkflowNodeInput[] = []
  for (let i = 0; i < r.nodes.length; i++) {
    const n = r.nodes[i]
    if (typeof n !== 'object' || n === null) return null
    const item = n as Record<string, unknown>
    const toolName =
      typeof item.toolName === 'string' && item.toolName.trim().length > 0
        ? stripHtml(item.toolName).slice(0, 100)
        : 'Unknown Tool'
    nodes.push({
      order: i,
      toolName,
      toolSlug:
        typeof item.toolSlug === 'string' && item.toolSlug.length > 0
          ? item.toolSlug.slice(0, 100)
          : null,
      toolDomain:
        typeof item.toolDomain === 'string' && item.toolDomain.length > 0
          ? item.toolDomain.slice(0, 253)
          : null,
      useCase:
        typeof item.useCase === 'string' ? stripHtml(item.useCase).slice(0, 200) : '',
      positionX: typeof item.positionX === 'number' ? item.positionX : 0,
      positionY: typeof item.positionY === 'number' ? item.positionY : 0,
    })
  }
  return { title, description, isPublic, nodes }
}
