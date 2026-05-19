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
import Image from 'next/image'

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
          {/* Static Decorative Corner Elements (Non-obstructive, fixed) */}
          <div className="pointer-events-none fixed -left-4 -top-4 z-[-10] hidden xl:block">
            <Image src="/corner-art-1.png" alt="Decorative AI Element" width={160} height={160} className="drop-shadow-[4px_4px_0px_rgba(26,26,26,0.15)] opacity-90" />
          </div>
          <div className="pointer-events-none fixed -bottom-4 -left-4 z-[-10] hidden xl:block">
            <Image src="/corner-art-2.png" alt="Decorative Data Node" width={160} height={160} className="drop-shadow-[4px_4px_0px_rgba(26,26,26,0.15)] opacity-90" />
          </div>
          <div className="pointer-events-none fixed -right-4 top-32 z-[-10] hidden 2xl:block">
            <Image src="/corner-art-3.png" alt="Decorative Terminal" width={140} height={140} className="drop-shadow-[4px_4px_0px_rgba(26,26,26,0.15)] opacity-90" />
          </div>

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
