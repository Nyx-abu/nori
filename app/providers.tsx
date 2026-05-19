'use client'

// Phase 5 decision: PostHog initialized in a client provider. Manual pageview capture (not auto) keeps the 3-event budget enforced from the spec.
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
    if (!key) return
    if (typeof window === 'undefined') return
    if ((posthog as unknown as { __loaded?: boolean }).__loaded) return
    const config: Record<string, unknown> = {
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
    }
    if (host) config.api_host = host
    posthog.init(key, config)
  }, [])
  return <PHProvider client={posthog}>{children}</PHProvider>
}
