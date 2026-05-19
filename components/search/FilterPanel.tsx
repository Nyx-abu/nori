'use client'

// P5 decision: filter state lives in URL search params (shareable + back-button friendly). Toggles edit URL params via router.replace; SearchResults re-reads `filtersKey` and refires the search. Source filter is the only client-only filter (it hides groups rather than reissuing the search).
import * as React from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '../ui/cn'

const PRICING_OPTIONS = [
  { value: 'FREE', label: 'Free' },
  { value: 'FREEMIUM', label: 'Freemium' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OPEN_SOURCE', label: 'Open source' },
] as const

const PLATFORM_OPTIONS = [
  { value: 'web', label: 'Web' },
  { value: 'mac', label: 'Mac' },
  { value: 'windows', label: 'Windows' },
  { value: 'linux', label: 'Linux' },
  { value: 'api', label: 'API' },
] as const

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'library', label: 'Library only' },
  { value: 'ai-discovered', label: 'AI-discovered only' },
] as const

type Category = { id: string; slug: string; name: string }

type Props = {
  categories: Category[]
}

export function FilterPanel({ categories }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [open, setOpen] = React.useState(false)

  const pricing = params.getAll('pricing')
  const platforms = params.getAll('platforms')
  const privacy = params.get('privacy') === 'true'
  const openSource = params.get('openSource') === 'true'
  const categorySlug = params.get('category') ?? ''
  const source = (params.get('source') as 'all' | 'library' | 'ai-discovered' | null) ?? 'all'
  const aiFirst = params.get('aiFirst') === 'true'

  const activeCount =
    pricing.length +
    platforms.length +
    (privacy ? 1 : 0) +
    (openSource ? 1 : 0) +
    (categorySlug ? 1 : 0) +
    (source !== 'all' ? 1 : 0) +
    (aiFirst ? 1 : 0)

  const update = (mut: (sp: URLSearchParams) => void) => {
    const sp = new URLSearchParams(params.toString())
    mut(sp)
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }

  const toggleMulti = (key: 'pricing' | 'platforms', value: string) => {
    update((sp) => {
      const current = sp.getAll(key)
      sp.delete(key)
      if (current.includes(value)) {
        for (const v of current) if (v !== value) sp.append(key, v)
      } else {
        for (const v of current) sp.append(key, v)
        sp.append(key, value)
      }
    })
  }

  const toggleBool = (key: 'privacy' | 'openSource') => {
    update((sp) => {
      if (sp.get(key) === 'true') sp.delete(key)
      else sp.set(key, 'true')
    })
  }

  const setCategory = (slug: string) => {
    update((sp) => {
      if (slug) sp.set('category', slug)
      else sp.delete('category')
    })
  }

  const setSource = (s: 'all' | 'library' | 'ai-discovered') => {
    update((sp) => {
      if (s === 'all') sp.delete('source')
      else sp.set('source', s)
    })
  }

  const setOrder = (next: 'library' | 'ai') => {
    update((sp) => {
      if (next === 'ai') sp.set('aiFirst', 'true')
      else sp.delete('aiFirst')
    })
  }

  const clearAll = () => {
    update((sp) => {
      const q = sp.get('q')
      const arr = Array.from(sp.keys())
      for (const k of arr) sp.delete(k)
      if (q) sp.set('q', q)
    })
  }

  return (
    <div className="rounded-xl border-2 border-border bg-surface p-4 shadow-[4px_4px_0px_#1A1A1A]">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-pill border-2 border-border bg-accent-blue px-4 py-2 text-sm font-extrabold text-text-primary shadow-[2px_2px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_#1A1A1A]"
        >
          <span>{open ? 'Hide filters' : 'Filters'}</span>
          {activeCount > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill border-2 border-border bg-accent px-1.5 text-2xs font-extrabold text-surface">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="text-sm font-bold text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
          <FilterGroup label="Pricing">
            <div className="flex flex-wrap gap-2">
              {PRICING_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  active={pricing.includes(o.value)}
                  onClick={() => toggleMulti('pricing', o.value)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label="Platforms">
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  active={platforms.includes(o.value)}
                  onClick={() => toggleMulti('platforms', o.value)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label="Category">
            <select
              value={categorySlug}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border-2 border-border bg-surface px-3 py-2 text-base font-bold text-text-primary shadow-[2px_2px_0px_#1A1A1A] focus:outline-none sm:text-sm"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="Source">
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  active={source === o.value}
                  onClick={() => setSource(o.value)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label="Order">
            <div className="flex flex-wrap gap-2">
              <Chip active={!aiFirst} onClick={() => setOrder('library')}>
                Library first
              </Chip>
              <Chip active={aiFirst} onClick={() => setOrder('ai')}>
                AI-discovered first
              </Chip>
            </div>
          </FilterGroup>

          <FilterGroup label="Flags">
            <div className="flex flex-wrap gap-2">
              <Chip active={privacy} onClick={() => toggleBool('privacy')}>
                Privacy-focused
              </Chip>
              <Chip active={openSource} onClick={() => toggleBool('openSource')}>
                Open source only
              </Chip>
            </div>
          </FilterGroup>
        </div>
      )}
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-2xs font-extrabold uppercase tracking-widest text-text-muted">
        {label}
      </p>
      {children}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-pill border-2 border-border px-3 py-1.5 text-xs font-extrabold text-text-primary transition-all duration-base ease-enter shadow-[2px_2px_0px_#1A1A1A]',
        active
          ? 'bg-accent-glow -translate-y-0.5 shadow-[3px_3px_0px_#1A1A1A]'
          : 'bg-surface hover:-translate-y-0.5 hover:bg-accent-pink hover:shadow-[3px_3px_0px_#1A1A1A]',
      )}
    >
      {children}
    </button>
  )
}
