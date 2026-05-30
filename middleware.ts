// P2 decision: kept the existing rate-limit buckets but split route matching into public/protected. Workflow mutations + profile require auth; everything else stays public.
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// NOTE: Clerk uses path-to-regexp v6 which doesn't support negative lookaheads.
// Protected routes are checked first, so listing /workflows/(.*) as public is safe —
// /workflows/new and /workflows/edit/* still match isProtectedRoute and require auth.
const isPublicRoute = createRouteMatcher([
  '/',
  '/about',
  '/search(.*)',
  '/browse(.*)',
  '/tools(.*)',
  '/workflows',
  '/workflows/(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/search(.*)',
  '/api/tools(.*)',
  '/api/workflows/public(.*)',
])

const isProtectedRoute = createRouteMatcher([
  '/workflows/new',
  '/workflows/edit/(.*)',
  '/profile(.*)',
  '/api/workflows/create(.*)',
  '/api/workflows/delete(.*)',
  '/api/workflows/update(.*)',
  '/api/workflows/mine(.*)',
])

// in-memory sliding window — resets on cold start (acceptable for MVP)
type Bucket = { hits: number[] }
const buckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000

function rateLimitKey(ip: string, path: string) {
  // /api/search and /api/search/discover get separate buckets so the paired-call pattern from the
  // frontend (one search fires both) doesn't halve the user's effective query budget.
  if (path.startsWith('/api/search/discover')) return `${ip}:discover`
  if (path.startsWith('/api/search')) return `${ip}:search`
  if (path.startsWith('/api/workflows/create')) return `${ip}:wf-create`
  return `${ip}:other`
}

function limitFor(path: string) {
  if (path.startsWith('/api/search/discover')) return { count: 20, windowMs: 60_000 }
  if (path.startsWith('/api/search')) return { count: 20, windowMs: 60_000 }
  if (path.startsWith('/api/workflows/create')) return { count: 10, windowMs: 60 * 60_000 } // 10/hr
  return { count: 60, windowMs: 60_000 }
}

function isRateLimited(ip: string, path: string): boolean {
  const key = rateLimitKey(ip, path)
  const now = Date.now()
  const { count: limit, windowMs } = limitFor(path)
  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs)
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

  if (isProtectedRoute(req)) {
    auth().protect()
  } else if (!isPublicRoute(req)) {
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
