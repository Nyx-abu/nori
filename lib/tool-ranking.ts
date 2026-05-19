// Fix-pass decision: lexical ranking only. The canvas drawer needs deterministic, fast filtering — semantic re-ranking would cost a Gemini call per keystroke. Server-side cosine search already runs on the global /api/search; this is the cheap path for the in-canvas drawer.

export type RankableTool = {
  name: string
  tagline: string
  pricing?: string
  source: 'db' | 'gemini'
  whyRelevant?: string | null
}

export type RankOptions = {
  /** When true, Gemini-discovered tools sort above DB tools; within each group, lexical score order is preserved. */
  aiFirst?: boolean
}

export function rankToolsForQuery<T extends RankableTool>(
  tools: T[],
  query: string,
  opts: RankOptions = {},
): T[] {
  const q = query.toLowerCase().trim()
  const qTokens = q.split(/\s+/).filter(Boolean)

  function score(tool: T): number {
    if (!q) return 0
    let s = 0
    const name = tool.name.toLowerCase()
    const tagline = (tool.tagline ?? '').toLowerCase()
    const why = (tool.whyRelevant ?? '').toLowerCase()

    if (name === q) s += 100
    if (name.startsWith(q)) s += 60
    if (name.includes(q)) s += 40

    for (const token of qTokens) {
      if (name.includes(token)) s += 15
      if (tagline.includes(token)) s += 8
      if (why.includes(token)) s += 5
    }

    if (tool.source === 'gemini' && why.length > 0) s += 10
    if (tool.source === 'db') s += 5

    return s
  }

  const scored = q ? [...tools].sort((a, b) => score(b) - score(a)) : tools

  if (!opts.aiFirst) return scored

  // Partition: gemini first, db second — preserve within-group order from `scored`.
  const gemini: T[] = []
  const db: T[] = []
  for (const t of scored) {
    if (t.source === 'gemini') gemini.push(t)
    else db.push(t)
  }
  return [...gemini, ...db]
}
