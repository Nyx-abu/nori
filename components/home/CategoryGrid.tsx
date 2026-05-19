import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Icon } from '../ui/Icon'

export async function CategoryGrid() {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { tools: true } } },
    orderBy: { name: 'asc' },
  })

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="mb-6 text-xl font-semibold tracking-tight text-text-primary">
        browse by category
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/browse/${c.slug}`}
            className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors duration-base ease-enter hover:border-accent hover:bg-surface-2"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-2 text-accent">
              <Icon path={c.icon} size={20} />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">{c.name}</p>
              <p className="text-2xs text-text-muted">
                {c._count.tools} tool{c._count.tools === 1 ? '' : 's'}
              </p>
            </div>
            <span className="text-text-muted transition-colors duration-base ease-enter group-hover:text-accent">
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
