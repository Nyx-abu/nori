'use client'

// P5 decision: thin client wrapper that owns the FilterPanel + SearchResults pair. The body re-renders when the URL params change because it lives below <Suspense> in the server page, which re-renders on param change.
import { FilterPanel } from './FilterPanel'
import { SearchResults } from './SearchResults'

type Category = { id: string; slug: string; name: string }

type Props = {
  query: string
  categories: Category[]
  filters: {
    pricing: string[]
    platforms: string[]
    privacyFocused: boolean
    openSourceOnly: boolean
    categorySlug: string
  }
  source: 'all' | 'library' | 'ai-discovered'
  aiFirst: boolean
}

export function SearchPageBody({ query, categories, filters, source, aiFirst }: Props) {
  return (
    <div className="space-y-8">
      <FilterPanel categories={categories} />
      <SearchResults
        query={query}
        filters={{
          pricing: filters.pricing,
          platforms: filters.platforms,
          privacyFocused: filters.privacyFocused,
          openSourceOnly: filters.openSourceOnly,
          categorySlug: filters.categorySlug,
        }}
        sourceFilter={source}
        aiFirst={aiFirst}
      />
    </div>
  )
}
