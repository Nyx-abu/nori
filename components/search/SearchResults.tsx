'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { ToolCard } from '../tools/ToolCard'
import { Spinner } from '../ui/Spinner'
import type { SearchResponse, ToolResult } from '@/lib/types'
import { usePostHog } from 'posthog-js/react'

type Props = {
  query: string
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; data: SearchResponse }
  | { kind: 'error'; message: string }

export function SearchResults({ query }: Props) {
  const [state, setState] = React.useState<State>({ kind: 'idle' })
  const posthog = usePostHog()
  const trimmed = query.trim()

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
      body: JSON.stringify({ query: trimmed }),
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
        })
      })
      .catch((err: Error) => {
        if (cancelled) return
        setState({ kind: 'error', message: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [trimmed, posthog])

  if (!trimmed) {
    return (
      <p className="text-sm text-text-secondary">
        Type something above to find AI tools by what they do.
      </p>
    )
  }

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <Spinner /> Searching…
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] p-4 text-sm text-[#fca5a5]">
        {state.message}
      </div>
    )
  }

  if (state.kind === 'ok') {
    return <ResultGrid results={state.data.results} />
  }

  return null
}

function ResultGrid({ results }: { results: ToolResult[] }) {
  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center text-sm text-text-secondary">
        No matches. Try describing the task in different words.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((tool, i) => (
        <motion.div
          key={tool.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: i * 0.04,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <ToolCard tool={tool} />
        </motion.div>
      ))}
    </div>
  )
}
