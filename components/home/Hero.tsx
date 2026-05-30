import Link from 'next/link'
import Image from 'next/image'
import { SearchBar } from '../search/SearchBar'

const SUGGESTIONS = [
  'podcast to video short',
  'local offline llm',
  'ui component generator',
  'meeting transcriber',
]

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-4 py-20 font-sans">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          backgroundImage: 'radial-gradient(circle, #EAE5D9 2px, transparent 2px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-12 lg:flex-row">
        <div className="flex w-full max-w-2xl flex-col items-center text-center lg:items-start lg:text-left">
          <div className="mb-8 animate-tilt-in">
            <div className="inline-block rounded-pill border-4 border-border bg-accent px-6 py-2 text-lg font-bold text-surface shadow-[4px_4px_0px_#1A1A1A]">
              Hey there! 👋
            </div>
          </div>

          <h1
            className="animate-pop-in text-[40px] font-extrabold tracking-tight text-text-primary sm:text-[56px] md:text-[68px] lg:text-[80px]"
            style={{ lineHeight: 1.05, animationDelay: '100ms' }}
          >
            Find the perfect <br />
            <span className="text-surface inline-block bg-accent-glow px-4 py-2 mt-2 rounded-xl border-4 border-border shadow-[6px_6px_0px_#1A1A1A] rotate-2">
              AI tool
            </span>
          </h1>

          <p
            className="animate-fade-up mt-8 text-xl font-bold text-text-secondary md:text-2xl"
            style={{ animationDelay: '200ms' }}
          >
            Just tell us what you want to do. No digging required.
          </p>

          <div
            className="animate-fade-up mt-12 w-full max-w-[600px]"
            style={{ animationDelay: '300ms' }}
          >
            <SearchBar size="lg" />
          </div>

          <div
            className="animate-fade-in mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            style={{ animationDelay: '600ms' }}
          >
            {SUGGESTIONS.map((suggestion) => (
              <Link
                key={suggestion}
                href={`/search?q=${encodeURIComponent(suggestion)}`}
                className="rounded-pill border-2 border-border bg-surface px-5 py-2.5 text-sm font-bold text-text-primary transition-all duration-base hover:-translate-y-1 hover:bg-accent-pink hover:shadow-[4px_4px_0px_#1A1A1A] active:translate-y-0 active:shadow-none"
              >
                {suggestion}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden w-full max-w-lg lg:block animate-slide-in" style={{ animationDelay: '400ms' }}>
          <div className="animate-float">
            <div className="rotate-[4deg] rounded-[40px] border-4 border-border bg-surface p-6 shadow-[12px_12px_0px_#1A1A1A]">
              <Image
                src="/hero-art.png"
                alt="Isometric colorful robot"
                width={600}
                height={600}
                className="drop-shadow-[15px_15px_0px_rgba(26,26,26,0.15)]"
                priority
                sizes="(min-width: 1024px) 500px, 0px"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
