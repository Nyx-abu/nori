// Phase 5 decision: layout pulls fonts via next/font, wraps app in Clerk + PostHog, and renders Header/Footer once for the whole tree.
import './globals.css'
import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import { Suspense } from 'react'
import { ClerkProvider } from '@clerk/nextjs'
import { PostHogProvider } from './providers'
import { PostHogPageView } from './_components/PostHogPageView'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'nori — find AI tools by what they do',
  description:
    'Describe what you want to do, get semantically matched AI tool recommendations. Built around embeddings, not keyword search.',
  metadataBase: new URL('https://nori.app'),
  openGraph: {
    title: 'nori',
    description: 'find AI tools by what they do',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={outfit.variable}>
        <body className="relative min-h-screen bg-background font-sans text-text-primary antialiased overflow-x-hidden">
          <PostHogProvider>
            <Suspense fallback={null}>
              <PostHogPageView />
            </Suspense>
            <Header />
            <main>{children}</main>
            <Footer />
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
