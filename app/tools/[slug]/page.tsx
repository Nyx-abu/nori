import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { shapeTool } from '@/lib/search'
import { isValidSlug } from '@/lib/sanitize'
import { ToolDetail } from '@/components/tools/ToolDetail'

export const dynamic = 'force-dynamic'

type Props = { params: { slug: string } }

export default async function ToolPage({ params }: Props) {
  if (!isValidSlug(params.slug)) notFound()
  const row = await prisma.aiTool.findUnique({
    where: { slug: params.slug },
    include: { category: true, tags: true },
  })
  if (!row) notFound()
  const tool = shapeTool(row)
  return <ToolDetail tool={tool} />
}

export async function generateMetadata({ params }: Props) {
  if (!isValidSlug(params.slug)) return {}
  const row = await prisma.aiTool.findUnique({
    where: { slug: params.slug },
    select: { name: true, tagline: true },
  })
  if (!row) return {}
  return {
    title: `${row.name} — nori`,
    description: row.tagline,
  }
}
