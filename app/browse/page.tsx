// P6 decision: /browse is the discovery landing. Category cards link to /browse/[slug]; a paginated all-tools section lives below for "browse everything" UX.
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { shapeTool } from '@/lib/search'
import { ToolGrid } from '@/components/tools/ToolGrid'
import { Icon } from '@/components/ui/Icon'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

type Props = {
  searchParams: Record<string, string | string[] | undefined>
}

function pick(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? ''
  return v ?? ''
}

export default async function BrowsePage({ searchParams }: Props) {
  const pageRaw = parseInt(pick(searchParams.page) || '1', 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 100) : 1

  const [categories, total, tools] = await Promise.all([
    prisma.category.findMany({
      include: { _count: { select: { tools: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.aiTool.count(),
    prisma.aiTool.findMany({
      include: { category: true, tags: true },
      orderBy: [{ trustScore: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])

  const shaped = tools.map((t) => shapeTool(t))
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-accent-blue pb-20">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
          Browse{' '}
          <span className="ml-2 inline-block rounded-md border-2 border-border bg-accent-glow px-3 py-1 rotate-[-2deg] shadow-[4px_4px_0px_#1A1A1A]">
            everything
          </span>
        </h1>
        <p className="mt-3 text-base font-bold text-text-secondary sm:text-lg">
          Pick a category, or scroll the full catalog.
        </p>

        <section className="mt-10">
          <h2 className="mb-4 text-xl font-extrabold tracking-tight text-text-primary">Categories</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/browse/${c.slug}`}
                className="group flex items-center gap-3 rounded-xl border-2 border-border bg-surface p-4 shadow-[4px_4px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-1 hover:bg-accent-pink hover:shadow-[6px_6px_0px_#1A1A1A]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-md border-2 border-border bg-accent-glow text-text-primary shadow-[2px_2px_0px_#1A1A1A]">
                  <Icon path={c.icon} size={20} strokeWidth={2} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-extrabold text-text-primary">{c.name}</p>
                  <p className="text-2xs font-bold text-text-secondary">
                    {c._count.tools} tool{c._count.tools === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="text-text-primary">→</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-extrabold tracking-tight text-text-primary">All tools</h2>
            <p className="text-sm font-bold text-text-secondary">
              page {page} of {totalPages} · {total} total
            </p>
          </div>
          <ToolGrid tools={shaped} />

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              {page > 1 && (
                <Link
                  href={`/browse?page=${page - 1}`}
                  className="rounded-pill border-2 border-border bg-surface px-5 py-2 text-sm font-extrabold text-text-primary shadow-[3px_3px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-0.5 hover:bg-accent-glow"
                >
                  ← previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/browse?page=${page + 1}`}
                  className="rounded-pill border-2 border-border bg-accent px-5 py-2 text-sm font-extrabold text-surface shadow-[3px_3px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-0.5"
                >
                  next →
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
