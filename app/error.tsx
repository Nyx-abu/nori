'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('app error', error instanceof Error ? error.message : String(error))
  }, [error])
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <div className="rounded-xl border-4 border-border bg-surface p-8 shadow-[6px_6px_0px_#1A1A1A]">
        <h2 className="text-2xl font-extrabold tracking-tight text-text-primary">
          Something went wrong.
        </h2>
        <p className="mt-2 text-sm font-bold text-text-secondary">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="mt-6 inline-flex h-11 items-center rounded-pill border-2 border-border bg-accent px-5 text-sm font-extrabold text-surface shadow-[3px_3px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#1A1A1A]"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
