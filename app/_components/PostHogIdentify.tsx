'use client'

// Identify the current PostHog session with the Clerk user id so the dashboard can show "who" did
// what, group events by real user across devices, and build funnels (sign-in → search → click).
// On sign-out, posthog.reset() drops the user link and starts a fresh anonymous session.
import { useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { usePostHog } from 'posthog-js/react'

export function PostHogIdentify() {
  const { isLoaded, user } = useUser()
  const posthog = usePostHog()
  const prevUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !posthog) return
    const currentId = user?.id ?? null

    if (currentId && currentId !== prevUserIdRef.current) {
      posthog.identify(currentId, {
        email: user?.primaryEmailAddress?.emailAddress,
        name: user?.fullName ?? user?.username ?? undefined,
      })
    } else if (!currentId && prevUserIdRef.current) {
      // signed in → signed out
      posthog.reset()
    }

    prevUserIdRef.current = currentId
  }, [isLoaded, user, posthog])

  return null
}
