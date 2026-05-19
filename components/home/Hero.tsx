'use client'

import { motion } from 'framer-motion'
import { SearchBar } from '../search/SearchBar'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const SUGGESTIONS = [
  'podcast to video short',
  'local offline llm',
  'ui component generator',
  'meeting transcriber',
]

export function Hero() {
  const router = useRouter()

  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-4 py-20 font-sans">
      {/* Playful background blobs */}
      <motion.div
        className="absolute left-0 top-0 h-[600px] w-[600px] rounded-full bg-accent-pink/20 blur-3xl"
        animate={{ x: [-100, 50, -100], y: [-100, 50, -100] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-0 bottom-0 h-[600px] w-[600px] rounded-full bg-accent-blue/20 blur-3xl"
        animate={{ x: [100, -50, 100], y: [100, -50, 100] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* dot grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          backgroundImage:
            'radial-gradient(circle, #EAE5D9 2px, transparent 2px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-12 lg:flex-row">
        
        {/* Left text content */}
        <div className="flex w-full max-w-2xl flex-col items-center text-center lg:items-start lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 50, rotate: -5 }}
            animate={{ opacity: 1, y: 0, rotate: -2 }}
            transition={{ type: 'spring', stiffness: 100, damping: 12 }}
            whileHover={{ scale: 1.05, rotate: 2 }}
            className="mb-8"
          >
            <div className="inline-block rounded-pill border-4 border-border bg-accent px-6 py-2 text-lg font-bold text-surface shadow-[4px_4px_0px_#1A1A1A]">
              Hey there! 👋
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.1 }}
            className="text-5xl font-extrabold tracking-tight text-text-primary sm:text-6xl md:text-7xl lg:text-[80px]"
            style={{ lineHeight: 1.05 }}
          >
            Find the perfect <br/>
            <span className="text-surface inline-block bg-accent-glow px-4 py-2 mt-2 rounded-xl border-4 border-border shadow-[6px_6px_0px_#1A1A1A] rotate-2">AI tool</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.2 }}
            className="mt-8 text-xl font-bold text-text-secondary md:text-2xl"
          >
            Just tell us what you want to do. No digging required.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.3 }}
            className="mt-12 w-full max-w-[600px]"
          >
            <SearchBar size="lg" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
          >
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => router.push(`/search?q=${encodeURIComponent(suggestion)}`)}
                className="rounded-pill border-2 border-border bg-surface px-5 py-2.5 text-sm font-bold text-text-primary transition-all duration-base hover:-translate-y-1 hover:bg-accent-pink hover:shadow-[4px_4px_0px_#1A1A1A] active:translate-y-0 active:shadow-none"
              >
                {suggestion}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Right isometric art */}
        <motion.div
          initial={{ opacity: 0, x: 100, rotate: 10 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 80, damping: 12, delay: 0.4 }}
          className="hidden w-full max-w-lg lg:block"
        >
          <motion.div
            animate={{ y: [-20, 20, -20] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="rotate-[4deg] rounded-[40px] border-4 border-border bg-surface p-6 shadow-[12px_12px_0px_#1A1A1A]">
              <Image
                src="/hero-art.png"
                alt="Isometric colorful robot"
                width={600}
                height={600}
                className="drop-shadow-[15px_15px_0px_rgba(26,26,26,0.15)]"
                priority
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
