'use client'

// Phase 4 decision: SearchBar uses controlled input with debounced *value snapshot* (not auto-submit). Search fires only on Enter/click — debounce here just memorizes the typed query so the placeholder rotator pauses while typing.
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Spinner } from '../ui/Spinner'
import { cn } from '../ui/cn'

const EXAMPLES = [
  'turn a podcast into a YouTube short',
  'find a local LLM that runs on my MacBook',
  'generate product photos for a Shopify store',
  'transcribe and search a 90-minute meeting',
  'an AI pair programmer that lives in my terminal',
  'image model that can render readable text',
  'research papers on retrieval-augmented generation',
  'tools for editing dialogue that sound studio-grade',
]

type Props = {
  initialValue?: string
  size?: 'lg' | 'md'
  autoFocus?: boolean
  className?: string
}

export function SearchBar({
  initialValue = '',
  size = 'lg',
  autoFocus = false,
  className,
}: Props) {
  const router = useRouter()
  const [value, setValue] = React.useState(initialValue)
  const [submitting, setSubmitting] = React.useState(false)
  const [placeholderIndex, setPlaceholderIndex] = React.useState(0)

  // pause rotation while user is typing
  const userTyping = value.trim().length > 0

  // 300ms debounce — used to snapshot the value when typing pauses (avoids rotating placeholder mid-keystroke)
  const debouncedRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => {
    return () => {
      if (debouncedRef.current) clearTimeout(debouncedRef.current)
    }
  }, [])

  // rotate placeholder every 3s — pauses when typing
  React.useEffect(() => {
    if (userTyping) return
    const id = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % EXAMPLES.length)
    }, 3000)
    return () => clearInterval(id)
  }, [userTyping])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = value.trim().slice(0, 500)
    if (!q || submitting) return
    setSubmitting(true)
    router.push(`/search?q=${encodeURIComponent(q)}`)
    // brief loading state — router.push is fast in most cases
    setTimeout(() => setSubmitting(false), 400)
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    if (debouncedRef.current) clearTimeout(debouncedRef.current)
    debouncedRef.current = setTimeout(() => {
      // intentionally empty — debounce is just a UX pause hook for now
    }, 300)
  }

  const heightClass = size === 'lg' ? 'h-14' : 'h-11'
  const textClass = size === 'lg' ? 'text-lg' : 'text-base'

  return (
    <form
      onSubmit={onSubmit}
      className={cn('relative w-full', className)}
      role="search"
    >
      <div
        className={cn(
          'group relative flex items-center gap-3 rounded-pill border-4 border-border bg-surface px-6',
          'shadow-[6px_6px_0px_#1A1A1A]',
          'transition-all duration-base ease-enter',
          'hover:-translate-y-1 hover:shadow-[8px_8px_0px_#1A1A1A] focus-within:-translate-y-1 focus-within:shadow-[8px_8px_0px_#1A1A1A]',
          heightClass,
        )}
      >
        <SearchIcon />
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={value}
            onChange={onChange}
            autoFocus={autoFocus}
            maxLength={500}
            className={cn(
              'w-full bg-transparent font-bold text-text-primary outline-none placeholder:text-transparent',
              textClass,
            )}
            aria-label="Describe what you want to do"
          />
          {!userTyping && (
            <div
              className={cn(
                'pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center font-bold overflow-hidden',
                textClass,
                'text-text-muted',
              )}
              aria-hidden="true"
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={placeholderIndex}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{
                    duration: 0.4,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="block w-full truncate"
                >
                  {EXAMPLES[placeholderIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={!value.trim() || submitting}
          className={cn(
            'flex items-center gap-2 rounded-pill border-2 border-border bg-accent px-5 py-2.5 text-sm font-bold text-surface shadow-[2px_2px_0px_#1A1A1A]',
            'transition-all duration-base ease-enter hover:-translate-y-0.5 hover:bg-accent-blue hover:shadow-[4px_4px_0px_#1A1A1A] active:translate-y-0 active:shadow-[0px_0px_0px_#1A1A1A]',
            'disabled:bg-surface-2 disabled:text-text-muted disabled:shadow-none disabled:cursor-not-allowed disabled:hover:translate-y-0',
            'min-h-[40px] min-w-[50px]',
          )}
          aria-label="Search"
        >
          {submitting ? <Spinner size={16} className="text-surface" /> : 'Search'}
        </button>
      </div>
    </form>
  )
}

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-secondary"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  )
}
