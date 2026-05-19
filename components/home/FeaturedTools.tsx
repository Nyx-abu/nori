import { prisma } from '@/lib/db'
import { shapeTool } from '@/lib/search'
import { ToolCard } from '../tools/ToolCard'

export async function FeaturedTools() {
  const tools = await prisma.aiTool.findMany({
    include: { category: true, tags: true },
    orderBy: { trustScore: 'desc' },
    take: 8,
  })
  const shaped = tools.map((t) => shapeTool(t))

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-text-primary">
          trending this week
        </h2>
        <a
          href="/tools"
          className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-base ease-enter"
        >
          browse all →
        </a>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shaped.map((tool) => (
          <div key={tool.id} className="w-full">
            <ToolCard tool={tool} compact />
          </div>
        ))}
      </div>
    </section>
  )
}
