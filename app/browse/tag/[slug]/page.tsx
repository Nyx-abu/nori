// Tag-based browse mirror of /browse/[category]. Surfaces the dynamic taxonomy that grows
// as Gemini suggests new tags during discovery — without breaking the hand-curated category routes.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { shapeTool } from '@/lib/search'
import { isValidSlug } from '@/lib/sanitize'
import { ToolGrid } from '@/components/tools/ToolGrid'

export const dynamic = 'force-dynamic'

type Props = { params: { slug: string } }

export async function generateMetadata({ params }: Props) {
  if (!isValidSlug(params.slug)) return {}
  const tag = await prisma.tag.findUnique({
    where: { slug: params.slug },
    select: { name: true },
  })
  if (!tag) return {}
  return { title: `${tag.name} — nori` }
}

export default async function BrowseTagPage({ params }: Props) {
  if (!isValidSlug(params.slug)) notFound()
  const tag = await prisma.tag.findUnique({
    where: { slug: params.slug },
    include: {
      tools: {
        include: { category: true, tags: true },
        orderBy: [{ trustScore: 'desc' }, { name: 'asc' }],
      },
    },
  })
  if (!tag) notFound()

  const shaped = tag.tools.map((t) => shapeTool(t))

  return (
    <div className="min-h-screen bg-accent-blue pb-20">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Link
          href="/browse"
          className="mb-6 inline-flex items-center gap-1 text-sm font-extrabold text-text-secondary hover:text-text-primary"
        >
          ← all categories
        </Link>

        <div className="flex items-start gap-4">
          <span className="flex h-14 items-center justify-center rounded-pill border-2 border-border bg-accent-glow px-5 text-base font-extrabold text-text-primary shadow-[4px_4px_0px_#1A1A1A]">
            #{tag.name}
          </span>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
              {tag.name}
            </h1>
            <p className="mt-2 text-base font-bold text-text-secondary sm:text-lg">
              {shaped.length} tool{shaped.length === 1 ? '' : 's'} tagged with this capability
            </p>
          </div>
        </div>

        <div className="mt-10">
          <ToolGrid tools={shaped} emptyMessage="No tools tagged with this capability yet." />
        </div>
      </div>
    </div>
  )
}
