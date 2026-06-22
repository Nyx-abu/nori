'use client'

// P9 decision: profile is client-side because Clerk's useUser() reads the live session and we want immediate hydration without a server round-trip. Workflow list fetched once on mount.
import * as React from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { WorkflowCard, type WorkflowCardData } from '@/components/workflow/WorkflowCard'
import { Spinner } from '@/components/ui/Spinner'

type Tab = 'workflows' | 'saved'

export default function ProfilePage() {
  const { isLoaded, user } = useUser()
  const [tab, setTab] = React.useState<Tab>('workflows')
  const [workflows, setWorkflows] = React.useState<WorkflowCardData[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isLoaded || !user) return
    fetch('/api/workflows/mine')
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `Failed (${r.status})`)
        }
        return (await r.json()) as { workflows: WorkflowCardData[] }
      })
      .then((data) => setWorkflows(data.workflows))
      .catch((e: Error) => setError(e.message))
  }, [isLoaded, user])

  if (!isLoaded) {
    return (
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-24 text-base font-bold text-text-secondary sm:px-6">
        <Spinner /> Loading…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <p className="text-base font-bold text-text-secondary">You need to be signed in.</p>
        <Link
          href="/sign-in"
          className="mt-4 inline-flex h-11 items-center rounded-pill border-2 border-border bg-accent px-5 text-sm font-extrabold text-surface shadow-[3px_3px_0px_#1A1A1A]"
        >
          Sign in
        </Link>
      </div>
    )
  }

  const email = user.emailAddresses[0]?.emailAddress ?? ''
  const name = user.fullName || user.username || email || 'You'

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {/* Mobile pass: stack vertically so the username has the full width — the
          previous flex-wrap layout kept the "+ New workflow" button on the same
          row as the name and collapsed long names character-by-character.
          Avatar shrinks to 56px on mobile to leave even more room for the name.
          Desktop layout is unchanged (avatar + name + button on one row). */}
      <div className="flex flex-col gap-4 rounded-xl border-2 border-border bg-surface p-5 shadow-[6px_6px_0px_#1A1A1A] sm:flex-row sm:items-center sm:p-6">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          {user.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.imageUrl}
              alt={name}
              width={72}
              height={72}
              className="h-14 w-14 shrink-0 rounded-pill border-2 border-border object-cover shadow-[3px_3px_0px_#1A1A1A] sm:h-[72px] sm:w-[72px]"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-pill border-2 border-border bg-accent-glow text-xl font-extrabold text-text-primary shadow-[3px_3px_0px_#1A1A1A] sm:h-[72px] sm:w-[72px] sm:text-2xl">
              {(name[0] ?? '?').toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
              {name}
            </h1>
            {email && (
              <p className="mt-1 break-all text-xs font-bold text-text-secondary sm:text-sm">
                {email}
              </p>
            )}
          </div>
        </div>
        <Link
          href="/workflows/new"
          className="inline-flex h-11 w-full items-center justify-center rounded-pill border-2 border-border bg-accent px-5 text-sm font-extrabold text-surface shadow-[3px_3px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#1A1A1A] sm:w-auto"
        >
          + New workflow
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <TabButton active={tab === 'workflows'} onClick={() => setTab('workflows')}>
          My workflows
        </TabButton>
        <TabButton active={tab === 'saved'} onClick={() => setTab('saved')}>
          Saved tools
        </TabButton>
      </div>

      <div className="mt-6">
        {tab === 'workflows' &&
          (error ? (
            <p className="text-sm font-bold text-text-secondary">{error}</p>
          ) : !workflows ? (
            <div className="flex items-center gap-2 text-sm font-bold text-text-secondary">
              <Spinner /> Loading workflows…
            </div>
          ) : workflows.length === 0 ? (
            <div className="rounded-xl border-4 border-dashed border-border bg-surface p-10 text-center shadow-[4px_4px_0px_#1A1A1A]">
              <p className="text-base font-extrabold text-text-primary">
                You haven&apos;t created any workflows yet.
              </p>
              <Link
                href="/workflows/new"
                className="mt-4 inline-flex h-11 items-center rounded-pill border-2 border-border bg-accent px-5 text-sm font-extrabold text-surface shadow-[3px_3px_0px_#1A1A1A]"
              >
                Create one
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workflows.map((wf) => (
                <WorkflowCard key={wf.id} workflow={wf} showLock />
              ))}
            </div>
          ))}

        {tab === 'saved' && (
          <div className="rounded-xl border-4 border-dashed border-border bg-surface p-10 text-center shadow-[4px_4px_0px_#1A1A1A]">
            <p className="text-base font-extrabold text-text-primary">Coming soon.</p>
            <p className="mt-2 text-sm font-bold text-text-secondary">
              Saving tools to your profile will land in a future release.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-pill border-2 border-border bg-accent-glow px-4 py-2 text-sm font-extrabold text-text-primary shadow-[3px_3px_0px_#1A1A1A]'
          : 'rounded-pill border-2 border-border bg-surface px-4 py-2 text-sm font-extrabold text-text-primary shadow-[2px_2px_0px_#1A1A1A] hover:bg-accent-blue'
      }
    >
      {children}
    </button>
  )
}
