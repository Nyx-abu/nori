'use client'

import Link from 'next/link'
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs'

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b-4 border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 group">
          <NoriMark />
          <span className="text-2xl font-black tracking-tight text-accent mt-1">
            nori
          </span>
        </Link>
        <nav className="flex items-center gap-2 text-sm font-bold">
          <Link
            href="/search"
            className="rounded-xl px-4 py-2 text-text-primary hover:bg-accent-blue hover:shadow-[2px_2px_0px_#1A1A1A] hover:border-2 hover:border-border border-2 border-transparent transition-all duration-base ease-enter"
          >
            Search
          </Link>
          <Link
            href="/browse"
            className="rounded-xl px-4 py-2 text-text-primary hover:bg-accent-pink hover:shadow-[2px_2px_0px_#1A1A1A] hover:border-2 hover:border-border border-2 border-transparent transition-all duration-base ease-enter"
          >
            Browse
          </Link>
          <Link
            href="/workflows"
            className="rounded-xl px-4 py-2 text-text-primary hover:bg-accent-glow hover:shadow-[2px_2px_0px_#1A1A1A] hover:border-2 hover:border-border border-2 border-transparent transition-all duration-base ease-enter"
          >
            Workflows
          </Link>
          <SignedIn>
            <Link
              href="/profile"
              className="rounded-xl px-4 py-2 text-text-primary hover:bg-surface-2 hover:shadow-[2px_2px_0px_#1A1A1A] hover:border-2 hover:border-border border-2 border-transparent transition-all duration-base ease-enter"
            >
              Profile
            </Link>
            <div className="ml-2">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          <SignedOut>
            <Link
              href="/sign-in"
              className="ml-1 rounded-pill border-2 border-border bg-accent px-5 py-2 text-surface shadow-[2px_2px_0px_#1A1A1A] transition-all duration-base ease-enter hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#1A1A1A] active:translate-y-0 active:shadow-none"
            >
              Sign in
            </Link>
          </SignedOut>
        </nav>
      </div>
    </header>
  )
}

function NoriMark() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      {/* Background flag */}
      <path
        d="M6 12C14 8 20 16 30 12C38 8 44 14 44 14L38 36C38 36 32 30 22 34C12 38 6 32 6 32L6 12Z"
        fill="#2A4B3C"
        stroke="#1A1A1A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Sun */}
      <path
        d="M24 24C24 20.6863 26.6863 18 30 18C33.3137 18 36 20.6863 36 24"
        fill="#D4AF37"
        stroke="#1A1A1A"
        strokeWidth="2.5"
      />
      {/* Sun rays */}
      <line x1="30" y1="13" x2="30" y2="10" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="16" x2="21" y2="14" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="36" y1="16" x2="39" y2="14" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" />
      {/* Wave */}
      <path
        d="M14 26C18 22 22 28 30 28C38 28 42 24 42 24"
        stroke="#D4AF37"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
