import { Spinner } from '@/components/ui/Spinner'

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-24 text-sm text-text-secondary sm:px-6">
      <Spinner /> Loading results…
    </div>
  )
}
