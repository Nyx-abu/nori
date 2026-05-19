'use client'

// P4 decision: Two result groups (db / gemini) rendered separately so they can be filtered client-side and tagged visually. Gemini cards open the external website directly because no detail page exists for them.
import * as React from 'react'
import { motion } from 'framer-motion'
import { ToolCard } from '../tools/ToolCard'
import { ToolLogo } from '../ui/ToolLogo'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { NoResults } from './NoResults'
import type { ToolResult } from '@/lib/types'
import { usePostHog } from 'posthog-js/react'

type SearchResponse = {
  results: ToolResult[]
  dbCount: number
  aiCount: number
  query: string
  count: number
  noResults: boolean
}

type Props = {
  query: string
  filters?: Record<string, unknown>
  sourceFilter?: 'all' | 'library' | 'ai-discovered'
  aiFirst?: boolean
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; data: SearchResponse }
  | { kind: 'error'; message: string }

export function SearchResults({ query, filters, sourceFilter = 'all', aiFirst = false }: Props) {
  const [state, setState] = React.useState<State>({ kind: 'idle' })
  const posthog = usePostHog()
  const trimmed = query.trim()
  const filtersKey = JSON.stringify(filters ?? {})

  React.useEffect(() => {
    if (!trimmed) {
      setState({ kind: 'idle' })
      return
    }
    let cancelled = false
    setState({ kind: 'loading' })
    fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: trimmed, filters: filters ?? {} }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `Request failed (${r.status})`)
        }
        return (await r.json()) as SearchResponse
      })
      .then((data) => {
        if (cancelled) return
        setState({ kind: 'ok', data })
        posthog?.capture('search_performed', {
          query: trimmed,
          result_count: data.count,
          db_count: data.dbCount,
          ai_count: data.aiCount,
          no_results: data.noResults,
          ai_first: aiFirst,
          source_filter: sourceFilter,
          // Only stringify filters when they're non-empty so the dashboard doesn't see "{}" everywhere.
          filters: filters && Object.keys(filters).some((k) => {
            const v = (filters as Record<string, unknown>)[k]
            return Array.isArray(v) ? v.length > 0 : Boolean(v)
          }) ? filters : null,
        })
      })
      .catch((err: Error) => {
        if (cancelled) return
        setState({ kind: 'error', message: err.message })
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

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center gap-3 text-base font-bold text-text-secondary">
        <Spinner /> Searching the library and asking Gemini…
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-md border-2 border-border bg-accent-pink p-4 text-sm font-bold text-text-primary shadow-[4px_4px_0px_#1A1A1A]">
        {state.message}
      </div>
    )
  }

  if (state.kind !== 'ok') return null

  const { results } = state.data
  if (state.data.noResults) return <NoResults query={trimmed} />

  const dbTools = results.filter((r) => r.source !== 'gemini')
  const aiTools = results.filter((r) => r.source === 'gemini')

  const showDb = sourceFilter !== 'ai-discovered'
  const showAi = sourceFilter !== 'library'

  const dbSection =
    showDb && dbTools.length > 0 ? (
      <section key="db">
        <SectionHeader title="From the library" count={dbTools.length} tone="accent-blue" />
        <ResultGrid tools={dbTools} query={trimmed} />
      </section>
    ) : null

  const aiSection =
    showAi && aiTools.length > 0 ? (
      <section key="ai">
        <SectionHeader title="AI-discovered" count={aiTools.length} tone="accent-glow" />
        <AiGrid tools={aiTools} query={trimmed} />
      </section>
    ) : null

  const ordered = aiFirst ? [aiSection, dbSection] : [dbSection, aiSection]

  return (
    <div className="space-y-12">
      {ordered}
      {showDb && dbTools.length === 0 && sourceFilter === 'library' && (
        <NoResults query={trimmed} />
      )}
      {showAi && aiTools.length === 0 && sourceFilter === 'ai-discovered' && (
        <p className="text-sm font-bold text-text-secondary">No AI-discovered tools for this query.</p>
      )}
    </div>
  )
}

function SectionHeader({
  title,
  count,
  tone,
}: {
  title: string
  count: number
  tone: 'accent-blue' | 'accent-glow'
}) {
  const bg = tone === 'accent-blue' ? 'bg-accent-blue' : 'bg-accent-glow'
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className={`inline-block rounded-pill border-2 border-border ${bg} px-4 py-1 text-sm font-extrabold text-text-primary shadow-[3px_3px_0px_#1A1A1A]`}>
        {title}
      </span>
      <span className="text-sm font-bold text-text-secondary">
        {count} result{count === 1 ? '' : 's'}
      </span>
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
            // Bubbles up from the inner <Link>; fires before navigation.
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
            // Two events: clicked-the-result (with position) AND website-clicked (downstream behavior).
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
