// Phase 1 decision: Clerk middleware handles auth on all routes; rate limiting is layered before Clerk's protect so abusive callers don't even hit auth.
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/search(.*)',
  '/tools(.*)',
  '/api/search(.*)',
  '/api/tools(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

// in-memory sliding window — resets on cold start (acceptable for MVP per spec)
type Bucket = { hits: number[] }
const buckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000

function rateLimitKey(ip: string, path: string) {
  // /api/search has its own bucket; everything else shares one
  return path.startsWith('/api/search') ? `${ip}:search` : `${ip}:other`
}

function limitFor(path: string) {
  return path.startsWith('/api/search') ? 20 : 60
}

function isRateLimited(ip: string, path: string): boolean {
  const key = rateLimitKey(ip, path)
  const now = Date.now()
  const limit = limitFor(path)
  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((t) => now - t < WINDOW_MS)
  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket)
    return true
  }
  bucket.hits.push(now)
  buckets.set(key, bucket)
  return false
}

export default clerkMiddleware((auth, req) => {
  const path = req.nextUrl.pathname

  if (path.startsWith('/api/')) {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'anonymous'
    if (isRateLimited(ip, path)) {
      return NextResponse.json(
        { error: 'Too many requests', code: 'RATE_LIMITED' },
        { status: 429 },
      )
    }
  }

  if (!isPublicRoute(req)) {
    auth().protect()
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
