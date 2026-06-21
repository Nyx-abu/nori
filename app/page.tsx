import { Suspense } from 'react'
import { Hero } from '@/components/home/Hero'
import { FeaturedTools } from '@/components/home/FeaturedTools'
import { CategoryGrid } from '@/components/home/CategoryGrid'
import { WorkflowShowcase } from '@/components/home/WorkflowShowcase'
import { WaveDivider } from '@/components/ui/WaveDivider'
import Image from 'next/image'

export const revalidate = 300

function SectionSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 ${height}`}>
      <div className="h-full w-full animate-pulse rounded-xl bg-black/5" />
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="bg-accent-pink">
        <Hero />
      </div>

      <WaveDivider topColor="hsl(var(--accent-pink))" bottomColor="hsl(var(--accent-glow))" />

      <div className="bg-accent-glow pb-16">
        {/* Decorative Art 1 flanking Featured Tools */}
        <div className="relative mx-auto max-w-6xl h-0">
          <div className="pointer-events-none absolute -left-48 top-16 z-0 hidden xl:block">
            <div className="rotate-[-6deg] rounded-3xl border-4 border-border bg-surface p-4 shadow-[8px_8px_0px_#1A1A1A]">
              <Image
                src="/corner-art-1.png"
                alt="AI search magnifying glass"
                width={160}
                height={160}
                loading="lazy"
                sizes="160px"
              />
              <p className="mt-2 text-center text-xs font-black text-text-primary tracking-wide">AI Discovery</p>
            </div>
          </div>
        </div>
        <Suspense fallback={<SectionSkeleton height="h-96" />}>
          <FeaturedTools />
        </Suspense>
      </div>

      <WaveDivider topColor="hsl(var(--accent-glow))" bottomColor="hsl(var(--background))" />

      <div className="bg-background pb-16">
        {/* Decorative Art 2 flanking Category Grid */}
        <div className="relative mx-auto max-w-6xl h-0">
          <div className="pointer-events-none absolute -right-48 top-12 z-0 hidden xl:block">
            <div className="rotate-[6deg] rounded-3xl border-4 border-border bg-surface p-4 shadow-[8px_8px_0px_#1A1A1A]">
              <Image
                src="/corner-art-2.png"
                alt="Neural network nodes"
                width={160}
                height={160}
                loading="lazy"
                sizes="160px"
              />
              <p className="mt-2 text-center text-xs font-black text-text-primary tracking-wide">Semantic Vector</p>
            </div>
          </div>
        </div>
        <Suspense fallback={<SectionSkeleton height="h-72" />}>
          <CategoryGrid />
        </Suspense>
      </div>

      <WaveDivider topColor="hsl(var(--background))" bottomColor="hsl(var(--accent-blue))" />

      <div className="bg-accent-blue pb-20 pt-8">
        {/* Decorative Art 3 flanking Workflow Showcase */}
        <div className="relative mx-auto max-w-6xl h-0">
          <div className="pointer-events-none absolute -left-48 top-8 z-0 hidden xl:block">
            <div className="rotate-[-4deg] rounded-3xl border-4 border-border bg-surface p-4 shadow-[8px_8px_0px_#1A1A1A]">
              <Image
                src="/corner-art-3.png"
                alt="Retro computer terminal"
                width={150}
                height={150}
                loading="lazy"
                sizes="150px"
              />
              <p className="mt-2 text-center text-xs font-black text-text-primary tracking-wide">Agent Terminal</p>
            </div>
          </div>
        </div>
        <Suspense fallback={<SectionSkeleton height="h-64" />}>
          <WorkflowShowcase />
        </Suspense>
      </div>
    </div>
  )
}
