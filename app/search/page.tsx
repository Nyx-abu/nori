import { Suspense } from 'react'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchResults } from '@/components/search/SearchResults'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: { q?: string; category?: string }
}

export default function SearchPage({ searchParams }: Props) {
  const initialQuery = (searchParams.q ?? '').slice(0, 500)
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
          {initialQuery ? <>results for <span className="text-accent">{initialQuery}</span></> : 'search'}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Semantic match across {/* tool count rendered intentionally simple */} the catalog.
        </p>
      </div>
      <div className="mb-10">
        <SearchBar initialValue={initialQuery} size="md" />
      </div>
      <Suspense fallback={null}>
        <SearchResults query={initialQuery} />
      </Suspense>
    </div>
  )
}
