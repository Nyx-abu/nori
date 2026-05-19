import Link from 'next/link'
import { prisma } from '@/lib/db'
import { SignedIn } from '@clerk/nextjs'
import { WorkflowCard, type WorkflowCardData } from '@/components/workflow/WorkflowCard'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

type Props = {
  searchParams: Record<string, string | string[] | undefined>
}

function pick(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? ''
  return v ?? ''
}

export default async function WorkflowsPage({ searchParams }: Props) {
  const pageRaw = parseInt(pick(searchParams.page) || '1', 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 100) : 1

  const [total, rows] = await Promise.all([
    prisma.workflow.count({ where: { isPublic: true } }),
    prisma.workflow.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { nodes: { orderBy: { order: 'asc' } } },
    }),
  ])

  const workflows: WorkflowCardData[] = rows.map((wf) => ({
    id: wf.id,
    title: wf.title,
    description: wf.description,
    isPublic: wf.isPublic,
    authorName: wf.authorName,
    authorImage: wf.authorImage,
    createdAt: wf.createdAt.toISOString(),
    nodeCount: wf.nodes.length,
    firstNodes: wf.nodes.slice(0, 3).map((n) => ({
      toolName: n.toolName,
      toolDomain: n.toolDomain,
    })),
  }))

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasMore = page < totalPages

  return (
    <div className="min-h-screen bg-accent-glow pb-20">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
              Workflows
            </h1>
            <p className="mt-2 text-lg font-bold text-text-secondary">
              Tool chains shared by the community. Steal, remix, learn.
            </p>
          </div>
          <SignedIn>
            <Link
              href="/workflows/new"
              className="inline-flex h-12 items-center rounded-pill border-2 border-border bg-accent px-6 text-sm font-extrabold text-surface shadow-[4px_4px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-1 hover:shadow-[6px_6px_0px_#1A1A1A]"
            >
              + Create a workflow
            </Link>
          </SignedIn>
        </div>

        <div className="mt-10">
          {workflows.length === 0 ? (
            <div className="rounded-xl border-4 border-dashed border-border bg-surface p-12 text-center shadow-[6px_6px_0px_#1A1A1A]">
              <p className="text-lg font-extrabold text-text-primary">No public workflows yet.</p>
              <p className="mt-2 text-sm font-bold text-text-secondary">
                Be the first to publish one.
              </p>
              <SignedIn>
                <Link
                  href="/workflows/new"
                  className="mt-6 inline-flex h-11 items-center rounded-pill border-2 border-border bg-accent px-5 text-sm font-extrabold text-surface shadow-[3px_3px_0px_#1A1A1A]"
                >
                  Create one
                </Link>
              </SignedIn>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {workflows.map((wf) => (
                  <WorkflowCard key={wf.id} workflow={wf} />
                ))}
              </div>
              {hasMore && (
                <div className="mt-10 flex justify-center">
                  <Link
                    href={`/workflows?page=${page + 1}`}
                    className="rounded-pill border-2 border-border bg-surface px-6 py-2.5 text-sm font-extrabold text-text-primary shadow-[3px_3px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-1 hover:bg-accent-pink hover:shadow-[4px_4px_0px_#1A1A1A]"
                  >
                    Load more
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
