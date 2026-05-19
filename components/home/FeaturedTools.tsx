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
      <div className="scroll-row -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:px-6">
        {shaped.map((tool) => (
          <div
            key={tool.id}
            className="w-[280px] shrink-0 snap-start sm:w-[320px]"
          >
            <ToolCard tool={tool} compact />
          </div>
        ))}
      </div>
    </section>
  )
}
