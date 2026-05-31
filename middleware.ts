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
type Bucket = { hits: number[]; lastSeen: number }
const buckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000
// Longest rate-limit window currently in use (wf-create = 1h). A bucket idle longer than
// this can't influence any future decision, so the sweep can safely drop it.
const MAX_WINDOW_MS = 60 * 60_000
const SWEEP_EVERY = 200
const MAX_BUCKETS = 50_000

let callsSinceSweep = 0

function sweepIdle(now: number) {
  for (const [key, b] of buckets) {
    if (now - b.lastSeen > MAX_WINDOW_MS) buckets.delete(key)
  }
}

function evictToCap() {
  if (buckets.size <= MAX_BUCKETS) return
  // Hit the hard cap — IP rotation outpaced the idle sweep. Drop oldest-seen entries
  // until back under cap. O(n log n) only on the rare eviction path.
  const sorted = [...buckets.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen)
  const toDrop = buckets.size - MAX_BUCKETS
  for (let i = 0; i < toDrop; i++) {
    const entry = sorted[i]
    if (entry) buckets.delete(entry[0])
  }
}

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

  if (++callsSinceSweep >= SWEEP_EVERY) {
    callsSinceSweep = 0
    sweepIdle(now)
    evictToCap()
  }

  const bucket = buckets.get(key) ?? { hits: [], lastSeen: now }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs)
  bucket.lastSeen = now
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
    // x-forwarded-for chain is client, proxy1, proxy2, …, edge. The first entry is the
    // original client added by the closest trusted proxy. .at(-1) would pin to the edge
    // node and collapse every visitor behind that node into one bucket.
    const ip =
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
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

  let response = NextResponse.next()
  
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.accounts.dev https://us.posthog.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://logo.clearbit.com https://www.google.com https://img.clerk.com",
    "connect-src 'self' https://*.clerk.accounts.dev https://us.posthog.com https://generativelanguage.googleapis.com",
    "frame-ancestors 'none'",
  ].join('; ')

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')

  return response
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
