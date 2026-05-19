'use client'

import { Button } from '@/components/ui/Button'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <h2 className="text-xl font-semibold text-text-primary">
        Something broke during search.
      </h2>
      <p className="mt-2 text-sm text-text-secondary">
        {error.message || 'Unknown error.'}
      </p>
      <div className="mt-6">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}
