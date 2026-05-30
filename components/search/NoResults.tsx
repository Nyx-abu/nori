import Link from 'next/link'

export function NoResults({ query }: { query: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-xl border-4 border-border bg-surface p-10 text-center shadow-[8px_8px_0px_#1A1A1A]">
      <p className="text-2xs font-extrabold uppercase tracking-widest text-text-muted">Empty handed</p>
      <h2 className="mt-2 text-2xl font-extrabold text-text-primary">
        We couldn&apos;t find anything for that
      </h2>
      <p className="mt-3 text-sm font-bold text-text-secondary">
        Nori searched its library and asked AI — no matching tools turned up for{' '}
        <span className="rounded-md border-2 border-border bg-accent-glow px-2 py-0.5 font-extrabold text-text-primary">
          {query.slice(0, 60)}
        </span>
        . Try rephrasing, or browse by category.
      </p>
      <Link
        href="/browse"
        className="mt-6 inline-flex h-12 items-center rounded-pill border-2 border-border bg-accent px-6 text-sm font-extrabold text-surface shadow-[4px_4px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-1 hover:shadow-[6px_6px_0px_#1A1A1A]"
      >
        Browse categories →
      </Link>
    </div>
  )
}
