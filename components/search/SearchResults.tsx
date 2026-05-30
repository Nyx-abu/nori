'use client'

// Two parallel fetches: /api/search returns the DB section fast (multi-vector RRF + reranker), and
// /api/search/discover returns Gemini live discoveries on its own clock. Each section paints as soon as
// its endpoint resolves — DB usually under 500ms, AI 2-3s depending on Gemini load. PostHog event is
// fired once after the DB call so analytics see search_performed with a result_count we know is final
// for the library; aiCount is patched in later if/when discover resolves.
import * as React from 'react'
import { motion } from 'framer-motion'
import { ToolCard } from '../tools/ToolCard'
import { ToolLogo } from '../ui/ToolLogo'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { NoResults } from './NoResults'
import type { ToolResult } from '@/lib/types'
import { usePostHog } from 'posthog-js/react'

type SearchMeta = {
  path: 'full-rrf' | 'lexical-only' | 'empty'
  hyde_expanded: boolean
  reranker: 'jina' | 'fallback' | 'skipped'
  eligible_count: number
  candidate_count: number
  rerank_filtered: number
  rerank_score_top: number | null
  rerank_score_median: number | null
}

type DbResponse = {
  results: ToolResult[]
  dbCount: number
  query: string
  count: number
  noResults: boolean
  meta: SearchMeta
}

type AiResponse = {
  results: ToolResult[]
  aiCount: number
  query: string
}

type Props = {
  query: string
  filters?: Record<string, unknown>
  sourceFilter?: 'all' | 'library' | 'ai-discovered'
  aiFirst?: boolean
}

type DbState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; data: DbResponse }
  | { kind: 'error'; message: string }

type AiState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; data: AiResponse }
  | { kind: 'error'; message: string }

export function SearchResults({ query, filters, sourceFilter = 'all', aiFirst = false }: Props) {
  const [dbState, setDbState] = React.useState<DbState>({ kind: 'idle' })
  const [aiState, setAiState] = React.useState<AiState>({ kind: 'idle' })
  const posthog = usePostHog()
  const trimmed = query.trim()
  const filtersKey = JSON.stringify(filters ?? {})

  React.useEffect(() => {
    if (!trimmed) {
      setDbState({ kind: 'idle' })
      setAiState({ kind: 'idle' })
      return
    }
    let cancelled = false
    setDbState({ kind: 'loading' })
    setAiState({ kind: 'loading' })

    const dbPromise = fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: trimmed, filters: filters ?? {} }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `Request failed (${r.status})`)
        }
        return (await r.json()) as DbResponse
      })
      .then((data) => {
        if (cancelled) return data
        setDbState({ kind: 'ok', data })
        return data
      })
      .catch((err: Error) => {
        if (!cancelled) setDbState({ kind: 'error', message: err.message })
        return null
      })

    // Discover runs in parallel. We chain on dbPromise so we can pass dbNames to Gemini for de-duping,
    // but discover doesn't *wait* on DB UI render — that's the point.
    const aiPromise = dbPromise
      .then((dbData) => {
        const dbNames = dbData?.results.map((t) => t.name) ?? []
        return fetch('/api/search/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: trimmed, dbNames }),
        })
      })
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `Request failed (${r.status})`)
        }
        return (await r.json()) as AiResponse
      })
      .then((data) => {
        if (cancelled) return data
        setAiState({ kind: 'ok', data })
        return data
      })
      .catch((err: Error) => {
        if (!cancelled) setAiState({ kind: 'error', message: err.message })
        return null
      })

    // Fire analytics once both halves settle so we have a stable result_count / ai_count plus the
    // pipeline meta (which retrieval path ran, HyDE firing rate, reranker score stats). The meta is what
    // lets us tune the magic constants in lib/search.ts after the fact instead of guessing.
    Promise.all([dbPromise, aiPromise]).then(([dbData, aiData]) => {
      if (cancelled || !dbData) return
      posthog?.capture('search_performed', {
        query: trimmed,
        result_count: dbData.count + (aiData?.aiCount ?? 0),
        db_count: dbData.dbCount,
        ai_count: aiData?.aiCount ?? 0,
        no_results: dbData.noResults && (aiData?.aiCount ?? 0) === 0,
        ai_first: aiFirst,
        source_filter: sourceFilter,
        filters: filters && Object.keys(filters).some((k) => {
          const v = (filters as Record<string, unknown>)[k]
          return Array.isArray(v) ? v.length > 0 : Boolean(v)
        }) ? filters : null,
        // Pipeline telemetry — flatten into event props for easy faceting in PostHog.
        retrieval_path: dbData.meta?.path,
        hyde_expanded: dbData.meta?.hyde_expanded,
        reranker_status: dbData.meta?.reranker,
        eligible_count: dbData.meta?.eligible_count,
        candidate_count: dbData.meta?.candidate_count,
        rerank_filtered: dbData.meta?.rerank_filtered,
        rerank_score_top: dbData.meta?.rerank_score_top,
        rerank_score_median: dbData.meta?.rerank_score_median,
      })
    })

    return () => {
      cancelled = true
    }
  }, [trimmed, filtersKey, posthog]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!trimmed) {
    return (
      <p className="text-base font-bold text-text-secondary">
        Type something above to find AI tools by what they do.
      </p>
    )
  }

  const dbTools = dbState.kind === 'ok' ? dbState.data.results : []
  const aiTools = aiState.kind === 'ok' ? aiState.data.results : []
  const dbNoResults = dbState.kind === 'ok' && dbState.data.noResults
  const aiNoResults = aiState.kind === 'ok' && aiTools.length === 0

  const showDb = sourceFilter !== 'ai-discovered'
  const showAi = sourceFilter !== 'library'

  // Bail out only when both halves came back empty — keeps the UI from blinking NoResults while Gemini
  // is still searching.
  if (dbNoResults && aiNoResults) {
    return <NoResults query={trimmed} />
  }

  if (dbState.kind === 'error' && aiState.kind === 'error') {
    return (
      <div className="rounded-md border-2 border-border bg-accent-pink p-4 text-sm font-bold text-text-primary shadow-[4px_4px_0px_#1A1A1A]">
        {dbState.message}
      </div>
    )
  }

  const dbSection = showDb ? (
    <section key="db">
      <SectionHeader
        title="From the library"
        count={dbTools.length}
        tone="accent-blue"
        loading={dbState.kind === 'loading'}
      />
      {dbState.kind === 'loading' ? (
        <SkeletonGrid />
      ) : dbTools.length > 0 ? (
        <ResultGrid tools={dbTools} query={trimmed} />
      ) : sourceFilter === 'library' ? (
        <NoResults query={trimmed} />
      ) : null}
    </section>
  ) : null

  const aiSection = showAi ? (
    <section key="ai">
      <SectionHeader
        title="AI-discovered"
        count={aiTools.length}
        tone="accent-glow"
        loading={aiState.kind === 'loading'}
      />
      {aiState.kind === 'loading' ? (
        <SkeletonGrid />
      ) : aiTools.length > 0 ? (
        <AiGrid tools={aiTools} query={trimmed} />
      ) : sourceFilter === 'ai-discovered' ? (
        <p className="text-sm font-bold text-text-secondary">No AI-discovered tools for this query.</p>
      ) : null}
    </section>
  ) : null

  const ordered = aiFirst ? [aiSection, dbSection] : [dbSection, aiSection]
  return <div className="space-y-12">{ordered}</div>
}

function SectionHeader({
  title,
  count,
  tone,
  loading,
}: {
  title: string
  count: number
  tone: 'accent-blue' | 'accent-glow'
  loading?: boolean
}) {
  const bg = tone === 'accent-blue' ? 'bg-accent-blue' : 'bg-accent-glow'
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className={`inline-block rounded-pill border-2 border-border ${bg} px-4 py-1 text-sm font-extrabold text-text-primary shadow-[3px_3px_0px_#1A1A1A]`}>
        {title}
      </span>
      {loading ? (
        <span className="flex items-center gap-2 text-sm font-bold text-text-secondary">
          <Spinner /> searching…
        </span>
      ) : (
        <span className="text-sm font-bold text-text-secondary">
          {count} result{count === 1 ? '' : 's'}
        </span>
      )}
    </div>
  )
}

function SkeletonGrid() {
  // Three skeleton cards keep the section's vertical rhythm stable while the fetch resolves — no layout shift.
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-lg border-2 border-border bg-surface-2 shadow-[4px_4px_0px_#1A1A1A]"
        />
      ))}
    </div>
  )
}

function ResultGrid({ tools, query }: { tools: ToolResult[]; query: string }) {
  const posthog = usePostHog()
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool, i) => (
        <motion.div
          key={tool.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: i * 0.04,
            ease: [0.16, 1, 0.3, 1],
          }}
          onClick={() => {
            posthog?.capture('search_result_clicked', {
              tool_slug: tool.slug,
              tool_name: tool.name,
              source: 'db',
              position: i,
              query,
            })
          }}
        >
          <ToolCard tool={tool} />
        </motion.div>
      ))}
    </div>
  )
}

function AiGrid({ tools, query }: { tools: ToolResult[]; query: string }) {
  const posthog = usePostHog()
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool, i) => (
        <motion.a
          key={tool.id}
          href={tool.website}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: i * 0.04,
            ease: [0.16, 1, 0.3, 1],
          }}
          onClick={() => {
            posthog?.capture('search_result_clicked', {
              tool_slug: tool.slug || tool.name.toLowerCase(),
              tool_name: tool.name,
              source: 'gemini',
              position: i,
              query,
            })
            posthog?.capture('tool_website_clicked', {
              tool_slug: tool.name.toLowerCase(),
              tool_name: tool.name,
            })
          }}
          className="group block rounded-lg border-2 border-border bg-surface p-5 shadow-[4px_4px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-1 hover:shadow-[6px_6px_0px_#1A1A1A]"
        >
          <div className="flex items-start gap-3">
            <ToolLogo name={tool.name} domain={tool.domain} size={40} framed />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-extrabold text-text-primary">{tool.name}</h3>
                <span className="text-text-muted">↗</span>
              </div>
              <p className="mt-0.5 truncate text-sm font-bold text-text-secondary">{tool.tagline}</p>
            </div>
          </div>
          {tool.whyRelevant && (
            <p className="mt-3 rounded-md border-2 border-border bg-accent-glow/40 p-2 text-xs font-bold text-text-primary">
              {tool.whyRelevant}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">AI-discovered</Badge>
            <Badge tone="neutral">{tool.pricing.toLowerCase().replace('_', ' ')}</Badge>
          </div>
        </motion.a>
      ))}
    </div>
  )
}
