import { Spinner } from '@/components/ui/Spinner'

export default function Loading() {
  return (
    <div className="min-h-screen bg-accent-pink pb-20">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-24 text-base font-bold text-text-primary sm:px-6">
        <Spinner /> Loading category…
      </div>
    </div>
  )
}
