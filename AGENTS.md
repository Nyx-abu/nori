# AGENTS.md — Nori

A concise project brief for AI agents. Read this once; you should not need to grep the codebase to get started.

---

## 1. What Nori is

A visual-first AI tool discovery platform. The user types what they want to do in natural language (e.g. _"turn a podcast into a YouTube short"_), Nori generates a Gemini embedding of that query, runs a pgvector cosine search against pre-embedded tool descriptions, and renders the matches. Aesthetic — vibrant, playful, isometric, highly-animated (Framer Motion spring physics). Reference points: Super Hello agency site, Jelly Bean habit tracker.

MVP scope only. No accounts, no reviews, no comparison page, no AI agents, no email.

---

## 2. Stack (pinned, do not bump without approval)

| Layer            | Choice                                                   |
| ---------------- | -------------------------------------------------------- |
| Framework        | Next.js **14.2.18** (App Router, Node runtime)           |
| Language         | TypeScript 5.6 — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Styling          | Tailwind 3.4 — custom tokens in `tailwind.config.ts`     |
| Animation        | Framer Motion 11 (named imports only)                    |
| Auth             | Clerk 5 (auth wired in middleware; **UI not built**)     |
| DB               | Postgres on Neon + `pgvector` extension                  |
| ORM              | Prisma 5.22                                              |
| Embeddings       | Gemini `gemini-embedding-001`, 768-dim Matryoshka cut    |
| Analytics        | PostHog (client-only, 3 manual events)                   |
| Font             | Outfit via `next/font/google` (Playful, rounded sans-serif) |

**Do not install:** icon libs, UI kits, animation helpers, zod, clsx, tailwind-merge, posthog-node. Inline SVG for icons, native input validation, local `cn` helper in `components/ui/cn.ts`.

---

## 3. The search pipeline (the only non-obvious system)

```
user query string
  → sanitizeQuery()                  // strip HTML, normalize, cap 500 chars
  → embed(query, 'query')            // Gemini RETRIEVAL_QUERY task
  → pgvector cosine search           // ORDER BY vector <=> $1::vector LIMIT 20
  → Prisma filter (category/pricing/privacy)
  → shapeTool() × top 10             // adds score = 1 - distance
  → SearchResponse JSON
```

Tool embeddings are pre-computed at seed time from `${name}. ${tagline}. ${description}` with task type `RETRIEVAL_DOCUMENT`. An IVF cosine index (`vector_cosine_ops`, lists=10) is created after seeding.

---

## 4. Folder layout

```
nori/
├── app/
│   ├── layout.tsx                  Clerk + PostHog providers, Inter font, Header/Footer
│   ├── page.tsx                    Hero + FeaturedTools + CategoryGrid + WorkflowShowcase
│   ├── providers.tsx               PostHogProvider client wrapper
│   ├── _components/PostHogPageView Manual $pageview capture
│   ├── search/                     page.tsx + loading.tsx + error.tsx
│   ├── tools/
│   │   ├── page.tsx                All-tools index
│   │   └── [slug]/                 page.tsx + loading + error + not-found
│   └── api/
│       ├── search/route.ts         POST: vector search
│       ├── tools/route.ts          GET: paginated list
│       └── tools/[slug]/route.ts   GET: single tool
├── components/
│   ├── ui/                         Button, Badge, Card, Input, Spinner, Icon, cn
│   ├── search/                     SearchBar (client), SearchResults (client)
│   ├── tools/                      ToolCard, ToolAvatar, ToolGrid, ToolDetail
│   ├── layout/                     Header, Footer
│   └── home/                       Hero, FeaturedTools, CategoryGrid, WorkflowShowcase
├── lib/
│   ├── db.ts                       Prisma singleton (global cache in dev)
│   ├── embeddings.ts               Gemini wrapper + toPgVectorLiteral()
│   ├── search.ts                   vectorSearch() + shapeTool() + searchTools()
│   ├── sanitize.ts                 sanitizeQuery, isValidSlug, clampPage/Limit
│   └── types.ts                    ToolResult, SearchRequest/Response, ApiError
├── prisma/
│   ├── schema.prisma               AiTool, ToolEmbedding, Category, Tag, PricingType
│   └── seed.ts                     17 hand-written tools + embedding generation
├── middleware.ts                   Clerk + in-memory rate limiter
├── next.config.js                  Security headers (X-Frame, nosniff, Referrer-Policy)
├── tailwind.config.ts              Design tokens (colors, type scale, radii, durations)
└── .env                            Real keys — gitignored
```

---

## 5. Data model

- **`AiTool`** — `slug`, `name`, `tagline`, `description`, `website`, `pricing` (enum), `isOpenSource`, `isPrivacyFocused`, `platforms: string[]`, `trustScore`, `categoryId`, M2M `tags`.
- **`ToolEmbedding`** — 1:1 with `AiTool`, holds `vector vector(768)`. Split into its own table so embedding regen does not dirty the tool row.
- **`Category`** — `slug`, `name`, `icon` (SVG `d` string used by `<Icon path={...} />`).
- **`Tag`** — `slug`, `name`.
- **`PricingType`** — `FREE | FREEMIUM | PAID | OPEN_SOURCE`.

---

## 6. Environment variables

| Var                                  | Used by                          |
| ------------------------------------ | -------------------------------- |
| `DATABASE_URL`                       | Prisma at runtime (pgBouncer)    |
| `DIRECT_URL`                         | Prisma migrations only           |
| `GEMINI_API_KEY`                     | `lib/embeddings.ts`              |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`  | Clerk client                     |
| `CLERK_SECRET_KEY`                   | Clerk server / middleware        |
| `NEXT_PUBLIC_POSTHOG_KEY`            | PostHog client init              |
| `NEXT_PUBLIC_POSTHOG_HOST`           | PostHog client init              |

`.env.example` documents the keys. `.env` is gitignored and contains real keys.

---

## 7. Scripts

```
npm run dev          # next dev (http://localhost:3000)
npm run build        # prisma generate + next build
npm run start        # next start
npm run db:push      # push schema to Neon (no migrations folder yet)
npm run db:seed      # tsx prisma/seed.ts — creates pgvector extension, seeds, indexes
```

`postinstall` runs `prisma generate` automatically.

---

## 8. Routes

### Pages
- `/` — Home (Hero / Featured / Categories / Workflow)
- `/search?q=...` — Results page; client component fetches `/api/search`
- `/tools` — All tools, sorted by trust score
- `/tools/[slug]` — Tool detail (client component to fire PostHog events)

### API (all Node runtime, `dynamic = 'force-dynamic'`)
- `POST /api/search` — body `{ query, filters? }` → `{ results, query, count }`. Rate-limited 20/min/IP.
- `GET /api/tools?category=&pricing=&page=&limit=` → `{ tools, total, page }`. Rate-limited 60/min/IP.
- `GET /api/tools/[slug]` → `ToolResult | 404`.

All errors use shape `{ error: string, code: string }`.

---

## 9. PostHog events (the entire taxonomy)

Manual capture only. Do not autocapture, do not add new events without removing one.

```ts
posthog.capture('search_performed',       { query, result_count })
posthog.capture('tool_viewed',            { tool_slug, tool_name })
posthog.capture('tool_website_clicked',   { tool_slug, tool_name })
```

`$pageview` is captured manually in `app/_components/PostHogPageView.tsx`.

---

## 10. Design tokens (only these — do not invent more)

```
bg            #FDFBF7     (Cream white)
surface       #FFFFFF     (Pure white for cards)
surface-2     #F3F0E6     (Slightly darker cream)
border        #1A1A1A     (Thick, dark borders for the pop-art look)
text-primary  #1A1A1A     (Near black)
text-secondary #4A4A4A    (Dark gray)
text-muted    #8A8A8A
accent        #2A4B3C     (Dark green from the Nori logo)
accent-glow   #D4AF37     (Yellow/Gold from the sun logo)
accent-pink   #F19CBB     (Vibrant pink for colorful sections)
accent-blue   #74A4F2     (Playful blue for sections)

font sizes:   12 / 13 / 14 / 16 / 20 / 24 / 32 / 48 / 64 / 80
weights:      400 / 600 / 800
radii:        sm 8 / md 16 / lg 24 / xl 32 / pill 9999
durations:    fast 150 / base 250 / slow 400 / enter 500 / spring 800
easing:       cubic-bezier(0.175, 0.885, 0.32, 1.275) (Bouncy spring)
```

**Design Principle:** Bold, thick dark borders around elements, bright flat colors, isometric illustrations, and highly springy Framer Motion animations.

**Minimum touch target: 44px.** Components honor this via `min-w-[44px]` / `min-h-[44px]`.

---

## 11. Component conventions

- `components/ui/*` and `components/tools/Tool{Card,Grid}.tsx` are **server components by default**.
- Add `'use client'` only when you need hooks, events, browser APIs, or Framer Motion.
- Icons can be inline SVG or `next/image` pngs for illustrations.
- Tool logos are `<ToolAvatar name={...} />` — deterministic hash → gradient + initials.
- `next/image` is ALLOWED for local assets (`public/`).
- Card hover: Heavy bouncy scale `scale(1.05)` with thick shadow displacement (neo-brutalism/pop-art style).
- Decorative artworks: Must be relevant to the AI discovery context (e.g., stylized nodes, search symbols, terminals), rendered as simple graphic elements rather than full scenes, locked in fixed position without floating animations, and placed securely in the background (z-index: -10, pointer-events-none) to avoid obstructing the UI.

---

## 12. Non-obvious decisions / gotchas

- **Embedding model is `gemini-embedding-001`, not `text-embedding-004`.** The original spec said 004, but the API rejects that name. 001 returns 3072 dims natively; we pass `outputDimensionality: 768` (Matryoshka truncation) to keep the `vector(768)` schema. See `lib/embeddings.ts` — the field is set via a runtime cast because SDK 0.21 types don't expose it.
- **No zod / validation library.** All input validation is native TS in `lib/sanitize.ts`. Don't add zod.
- **No icon library.** Inline SVG only. Category icons live as SVG `d` strings in `prisma/seed.ts`.
- **Rate limiter is in-memory.** Resets on cold start — acceptable for MVP. Bucket per IP, separate bucket for `/api/search`.
- **Vector search is raw SQL** (`$queryRawUnsafe` with parameterized `$1::vector`). This is the only raw SQL in the codebase. Wrap any changes in try/catch and keep params parameterized.
- **`shapeTool()`** in `lib/search.ts` is the canonical Prisma-row → API-shape mapper. Use it everywhere (`/api/search`, `/api/tools`, `/api/tools/[slug]`, `<FeaturedTools>`). Do not hand-shape elsewhere.
- **`exactOptionalPropertyTypes: true`** is on. Optional props that may be `undefined` must be conditionally spread (`...(x !== undefined ? { x } : {})`), not passed as `x: x ?? undefined`.
- **`noUncheckedIndexedAccess: true`** is on. `array[0]` is `T | undefined`. Use `?.` or `??` defaults.
- **Build runs `prisma generate` first.** If the schema changes, `prisma generate` must run before `tsc` or `next build`.

---

## 13. How to do common tasks

### Add a new tool
1. Append an entry to the `tools` array in `prisma/seed.ts`. Description should be 2-3 sentences — real prose, since the embedding searches on it.
2. Re-run `npm run db:seed` (it wipes and re-seeds; idempotent).

### Add a new category
1. Append to the `categories` array in `prisma/seed.ts` with a 24×24 stroke-based SVG `d` string.
2. Re-seed.

### Change the embedding model or dimensions
1. Edit `MODEL` and `EMBEDDING_DIMENSIONS` in `lib/embeddings.ts`.
2. Update `vector(768)` in `prisma/schema.prisma` to the new dim.
3. `npm run db:push` to re-create the column.
4. `npm run db:seed` to regenerate vectors.

### Add a new PostHog event
**Don't.** The taxonomy is fixed at three. Remove one before adding one.

### Add a new API route
1. Create `app/api/<name>/route.ts` with `export const runtime = 'nodejs'`.
2. Return `{ error, code }` shapes for failures.
3. The rate limiter in `middleware.ts` applies automatically to anything under `/api/`.

---

## 14. What is intentionally NOT here

If you find yourself wanting to add any of these, stop and confirm with the user:

- User accounts UI / sign-in pages (Clerk is wired but no auth UI exists)
- Comments, ratings, reviews, favorites
- Admin or moderation dashboard
- Email or push notifications
- Comparisons page (mentioned in the spec but deferred)
- Social sharing buttons / og:image generation
- Any autonomous AI agent or LLM-driven workflow
- Server-side PostHog (`posthog-node`)

---

## 15. Smoke test (verifies the install is healthy)

```bash
npm run dev
# then in another shell:
curl http://localhost:3000/                                                   # 200 HTML
curl http://localhost:3000/api/tools | jq '.tools | length'                   # > 0
curl -X POST http://localhost:3000/api/search \
  -H 'content-type: application/json' \
  -d '{"query":"local llm runner"}' | jq '.results[0].slug'                   # "ollama"
curl http://localhost:3000/api/tools/cursor | jq '.name'                      # "Cursor"
```

All four should succeed. If the search call returns an embedding error, the Gemini key is the most likely cause — check `.env`.
