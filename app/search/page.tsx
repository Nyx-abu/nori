import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchPageBody } from '@/components/search/SearchPageBody'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Record<string, string | string[] | undefined>
}

function pick(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function pickAll(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value
  if (value) return [value]
  return []
}

export default async function SearchPage({ searchParams }: Props) {
  const initialQuery = pick(searchParams.q).slice(0, 500)
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { name: 'asc' },
  })

  const filters = {
    pricing: pickAll(searchParams.pricing),
    platforms: pickAll(searchParams.platforms),
    privacyFocused: pick(searchParams.privacy) === 'true',
    openSourceOnly: pick(searchParams.openSource) === 'true',
    categorySlug: pick(searchParams.category),
  }
  const source = (pick(searchParams.source) as 'all' | 'library' | 'ai-discovered') || 'all'
  const aiFirst = pick(searchParams.aiFirst) === 'true'

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">
          {initialQuery ? (
            <>
              results for{' '}
              <span className="ml-1 inline-block rounded-md border-2 border-border bg-accent-glow px-3 py-1 rotate-[-1deg] shadow-[3px_3px_0px_#1A1A1A]">
                {initialQuery}
              </span>
            </>
          ) : (
            'search'
          )}
        </h1>
        <p className="mt-2 text-base font-bold text-text-secondary">
          Semantic match across the library + live AI discovery.
        </p>
      </div>
      <div className="mb-6">
        <SearchBar initialValue={initialQuery} size="md" />
      </div>
      <Suspense fallback={null}>
        <SearchPageBody
          query={initialQuery}
          categories={categories}
          filters={filters}
          source={source}
          aiFirst={aiFirst}
        />
      </Suspense>
    </div>
  )
}
