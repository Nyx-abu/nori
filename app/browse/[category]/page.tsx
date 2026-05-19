import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { shapeTool } from '@/lib/search'
import { isValidSlug } from '@/lib/sanitize'
import { ToolGrid } from '@/components/tools/ToolGrid'
import { Icon } from '@/components/ui/Icon'

export const dynamic = 'force-dynamic'

type Props = { params: { category: string } }

export async function generateMetadata({ params }: Props) {
  if (!isValidSlug(params.category)) return {}
  const cat = await prisma.category.findUnique({
    where: { slug: params.category },
    select: { name: true },
  })
  if (!cat) return {}
  return { title: `${cat.name} — nori` }
}

export default async function BrowseCategoryPage({ params }: Props) {
  if (!isValidSlug(params.category)) notFound()
  const category = await prisma.category.findUnique({
    where: { slug: params.category },
    include: {
      tools: {
        include: { category: true, tags: true },
        orderBy: [{ trustScore: 'desc' }, { name: 'asc' }],
      },
    },
  })
  if (!category) notFound()

  const shaped = category.tools.map((t) => shapeTool(t))

  return (
    <div className="min-h-screen bg-accent-pink pb-20">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Link
          href="/browse"
          className="mb-6 inline-flex items-center gap-1 text-sm font-extrabold text-text-secondary hover:text-text-primary"
        >
          ← all categories
        </Link>

        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-border bg-accent-glow text-text-primary shadow-[4px_4px_0px_#1A1A1A]">
            <Icon path={category.icon} size={28} strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
              {category.name}
            </h1>
            <p className="mt-2 text-lg font-bold text-text-secondary">
              {shaped.length} tool{shaped.length === 1 ? '' : 's'} in this category
            </p>
          </div>
        </div>

        <div className="mt-10">
          <ToolGrid tools={shaped} emptyMessage="No tools in this category yet." />
        </div>
      </div>
    </div>
  )
}
