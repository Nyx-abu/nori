import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-accent-pink pb-20">
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-text-primary">
          We don&apos;t have that category.
        </h2>
        <p className="mt-2 text-base font-bold text-text-secondary">
          It may be misspelled, or we haven&apos;t added it yet.
        </p>
        <Link
          href="/browse"
          className="mt-6 inline-flex h-12 items-center rounded-pill border-2 border-border bg-accent px-6 text-sm font-extrabold text-surface shadow-[4px_4px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-1 hover:shadow-[6px_6px_0px_#1A1A1A]"
        >
          back to browse
        </Link>
      </div>
    </div>
  )
}
