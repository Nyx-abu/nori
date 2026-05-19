import { prisma } from '@/lib/db'
import { shapeTool } from '@/lib/search'
import { ToolGrid } from '@/components/tools/ToolGrid'

export const dynamic = 'force-dynamic'

export default async function ToolsIndex() {
  const tools = await prisma.aiTool.findMany({
    include: { category: true, tags: true },
    orderBy: [{ trustScore: 'desc' }, { name: 'asc' }],
  })
  const shaped = tools.map((t) => shapeTool(t))
  return (
    <div className="min-h-screen bg-accent-blue pb-20">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
        all tools
      </h1>
      <p className="mt-1 text-sm text-text-secondary">
        Sorted by trust score, curated by hand.
      </p>
      <div className="mt-8">
        <ToolGrid tools={shaped} />
      </div>
      </div>
    </div>
  )
}
