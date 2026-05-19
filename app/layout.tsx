// Phase 5 decision: layout pulls fonts via next/font, wraps app in Clerk + PostHog, and renders Header/Footer once for the whole tree.
import './globals.css'
import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import { Suspense } from 'react'
import { ClerkProvider } from '@clerk/nextjs'
import { PostHogProvider } from './providers'
import { PostHogPageView } from './_components/PostHogPageView'
import { PostHogIdentify } from './_components/PostHogIdentify'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Nori — Discover AI Tools',
  description: 'Find the perfect AI tool for any task. Semantic search powered by AI.',
  metadataBase: new URL('https://nori.app'),
  openGraph: {
    title: 'Nori — Discover AI Tools',
    description: 'Find the perfect AI tool for any task. Semantic search powered by AI.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={outfit.variable}>
        <head>
          {/* Warm TLS for the two logo sources so first paint isn't waiting on DNS+TLS for 8+ parallel <img> requests on the trending grid. */}
          <link rel="preconnect" href="https://logo.clearbit.com" crossOrigin="" />
          <link rel="preconnect" href="https://www.google.com" crossOrigin="" />
          <link rel="dns-prefetch" href="https://logo.clearbit.com" />
          <link rel="dns-prefetch" href="https://www.google.com" />
        </head>
        <body className="relative min-h-screen bg-background font-sans text-text-primary antialiased overflow-x-hidden">
          <PostHogProvider>
            <Suspense fallback={null}>
              <PostHogPageView />
            </Suspense>
            <PostHogIdentify />
            <Header />
            <main>{children}</main>
            <Footer />
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
