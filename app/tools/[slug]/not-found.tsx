import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <h2 className="text-2xl font-semibold tracking-tight text-text-primary">
        We don't have this tool yet.
      </h2>
      <p className="mt-2 text-sm text-text-secondary">
        It may be misspelled, or not in our catalog.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center rounded-pill bg-accent px-5 text-sm font-medium text-white transition-colors duration-base ease-enter hover:bg-[#7679ff]"
      >
        back to search
      </Link>
    </div>
  )
}
