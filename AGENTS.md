# AGENTS.md — Nori

A concise project brief for AI agents. Read this once; you should not need to grep the codebase to get started.

---

## 1. What Nori is

A visual-first AI tool discovery platform. The user types what they want to do in natural language (e.g. _"turn a podcast into a YouTube short"_), Nori embeds the query and runs a pgvector cosine search against pre-embedded tool descriptions, then augments with a Gemini "live discovery" call for tools not yet in the library. Authenticated users can save tools into shareable **workflows** built on an infinite React Flow canvas. Aesthetic — vibrant, playful, pop-art / neobrutalist: thick dark borders, hard offset shadows, springy Framer Motion physics. References: Super Hello, Jelly Bean habit tracker.

MVP scope. No comments, ratings, follows, comparisons, email, admin dashboard.

---

## 2. Stack (pinned — do not bump without approval)

| Layer        | Choice                                                              |
| ------------ | ------------------------------------------------------------------- |
| Framework    | Next.js **14.2.18** (App Router, Node runtime)                      |
| Language     | TypeScript 5.6 — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Styling      | Tailwind 3.4 — tokens in `tailwind.config.ts`                       |
| Animation    | Framer Motion 11 (named imports only)                               |
| Auth         | Clerk 5 — `/sign-in`, `/sign-up`, `<UserButton>` in Header          |
| DB           | Postgres (Neon) + `pgvector`                                        |
| ORM          | Prisma 5.22                                                         |
| Embeddings   | Gemini `gemini-embedding-001` (768-d Matryoshka cut)                |
| Live discovery | Gemini `gemini-flash-latest` (generateContent)                    |
| Canvas       | reactflow 11                                                        |
| Analytics    | PostHog (client-only, 3 manual events)                              |
| Font         | Outfit via `next/font/google`                                       |

**Do not install:** icon libs, UI kits, animation helpers, zod, clsx, tailwind-merge, posthog-node, additional canvas libs. Inline SVG for icons, native input validation, local `cn` helper in `components/ui/cn.ts`.

---

## 3. The search pipelines (there are two — keep them straight)

### `POST /api/search` — global semantic search (the homepage / search page)

```
user query string
  → sanitizeQuery()                  // strip HTML, normalize, cap 500 chars
  → embed(query, 'query')            // Gemini RETRIEVAL_QUERY task
  → pgvector cosine search           // ORDER BY vector <=> $1::vector LIMIT 20
  → filter score >= MIN_RELEVANT_SCORE (0.62)
  → Prisma filter (category/pricing/platforms/privacy/openSourceOnly)
  → shapeTool() × top 10
  → also runs discoverToolsWithGemini in parallel (Promise.allSettled)
  → dedupe by name (case-insensitive); DB wins
  → { results: [...db, ...gemini], dbCount, aiCount, noResults }
```

### `GET /api/tools/search` — in-canvas drawer search (lexical, fast)

```
q (optional)
  → Prisma `contains` against name/tagline/description/category.name
  → orderBy trustScore desc, take 20
  → if q.length > 1, also discoverToolsWithGemini()
  → dedupe (DB wins)
  → rankToolsForQuery(combined, q) (lib/tool-ranking.ts)
  → { results: top 25, query }
```

Embedding work happens **only** in `/api/search`. The drawer is keystroke-driven and uses cheap lexical ranking — never call Gemini-embed there.

Tool embeddings are pre-computed at seed time from `${name}. ${tagline}. ${description}` with task type `RETRIEVAL_DOCUMENT`. An IVF cosine index (`vector_cosine_ops`, lists=10) is created after seeding.

---

## 4. Folder layout

```
nori/
├── app/
│   ├── layout.tsx                  Clerk + PostHog providers, Outfit font, Header/Footer
│   ├── page.tsx                    Hero + FeaturedTools + CategoryGrid + WorkflowShowcase
│   ├── providers.tsx               PostHogProvider client wrapper
│   ├── _components/PostHogPageView Manual $pageview capture
│   ├── error.tsx                   App-level error boundary
│   ├── global-error.tsx            Top-level error boundary (no app layout)
│   ├── sign-in/[[...sign-in]]/     Clerk catch-all
│   ├── sign-up/[[...sign-up]]/     Clerk catch-all
│   ├── search/                     page + loading + error
│   ├── browse/
│   │   ├── page.tsx                Category landing + paginated all-tools
│   │   └── [category]/             page + loading + not-found
│   ├── tools/
│   │   ├── page.tsx                All-tools index
│   │   └── [slug]/                 page + loading + error + not-found
│   ├── workflows/
│   │   ├── page.tsx                Public workflows grid
│   │   ├── new/page.tsx            Canvas (protected)
│   │   ├── [id]/page.tsx           Detail view
│   │   └── edit/[id]/page.tsx      Canvas re-using same component (protected)
│   ├── profile/page.tsx            "My workflows" + tabs (protected, client)
│   └── api/
│       ├── search/route.ts                  POST: semantic + Gemini merge
│       ├── tools/route.ts                   GET: paginated list
│       ├── tools/[slug]/route.ts            GET: single tool
│       ├── tools/search/route.ts            GET: drawer search (lexical + Gemini)
│       └── workflows/
│           ├── create/route.ts              POST (auth) — create
│           ├── public/route.ts              GET — public, paginated
│           ├── mine/route.ts                GET (auth) — current user's
│           └── [id]/route.ts                GET / DELETE / PATCH (auth + ownership)
├── components/
│   ├── ui/                         Button, Badge, Card, Input, Spinner, Icon, ToolLogo, WaveDivider, cn
│   ├── search/                     SearchBar, SearchResults, SearchPageBody, FilterPanel, NoResults
│   ├── tools/                      ToolCard, ToolAvatar, ToolGrid, ToolDetail
│   ├── workflow/                   ToolNode, WorkflowCanvas, WorkflowCard, WorkflowDetail
│   ├── layout/                     Header (client, Clerk-aware), Footer
│   └── home/                       Hero, FeaturedTools, CategoryGrid, WorkflowShowcase
├── lib/
│   ├── db.ts                       Prisma singleton (global cache in dev)
│   ├── embeddings.ts               Gemini wrapper + toPgVectorLiteral()
│   ├── search.ts                   vectorSearch() + shapeTool() + searchTools()
│   ├── gemini-discovery.ts         "live discovery" — generateContent + JSON parse + categorySlug
│   ├── auto-library.ts             persistDiscoveredTool — slugify, upsert, embed, log
│   ├── tool-ranking.ts             Lexical ranker for the drawer
│   ├── logo.ts                     getDomainFromUrl + clearbit/favicon URL helpers
│   ├── sanitize.ts                 sanitizeQuery, isValidSlug, clampPage/Limit, stripHtml, sanitizeWorkflowInput
│   └── types.ts                    ToolResult, SearchRequest/Response, ApiError
├── prisma/
│   ├── schema.prisma               AiTool, ToolEmbedding, Category, Tag, Workflow, WorkflowNode, PricingType
│   └── seed.ts                     17 hand-written tools + embedding generation
├── middleware.ts                   Clerk (public/protected matchers) + in-memory rate limiter
├── next.config.js                  Security headers (X-Frame, nosniff, Referrer-Policy)
├── tailwind.config.ts              Design tokens
└── .env                            Real keys — gitignored
```

---

## 5. Data model

- **`AiTool`** — `slug`, `name`, `tagline`, `description`, `website`, `pricing` (enum), `isOpenSource`, `isPrivacyFocused`, `isAutoDiscovered`, `platforms: string[]`, `trustScore`, `categoryId`, M2M `tags`.
- **`ToolEmbedding`** — 1:1 with `AiTool`, holds `vector vector(768)`. Split so embedding regen doesn't dirty the tool row.
- **`Category`** — `slug`, `name`, `icon` (SVG `d` string).
- **`Tag`** — `slug`, `name`.
- **`Workflow`** — `title`, `description?`, `isPublic`, `authorId` (Clerk userId), `authorName`, `authorImage?`, has many `WorkflowNode`. Indexed on authorId, isPublic, createdAt.
- **`WorkflowNode`** — `workflowId` (cascade), `order` (logical chain index), `toolName`, `toolSlug?`, `toolDomain?`, `useCase`, `positionX/Y`.
- **`PricingType`** — `FREE | FREEMIUM | PAID | OPEN_SOURCE`.

---

## 6. Environment variables

| Var                                    | Used by                          |
| -------------------------------------- | -------------------------------- |
| `DATABASE_URL`                         | Prisma at runtime (pgBouncer)    |
| `DIRECT_URL`                           | Prisma migrations only           |
| `GEMINI_API_KEY`                       | embeddings + gemini-discovery    |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`    | Clerk client                     |
| `CLERK_SECRET_KEY`                     | Clerk server / middleware        |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`        | `/sign-in`                       |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`        | `/sign-up`                       |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`  | `/`                              |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`  | `/`                              |
| `NEXT_PUBLIC_POSTHOG_KEY`              | PostHog client init              |
| `NEXT_PUBLIC_POSTHOG_HOST`             | PostHog client init              |

---

## 7. Scripts

```
npm run dev          # next dev (http://localhost:3000)
npm run build        # prisma generate + next build
npm run start        # next start
npm run db:push      # push schema to Neon
npm run db:seed      # tsx prisma/seed.ts — pgvector extension, seed, IVF index
```

`postinstall` runs `prisma generate` automatically.

---

## 8. Routes

### Pages
- `/` — Home (Hero / Featured / Categories / WorkflowShowcase)
- `/search?q=...&pricing=...&platforms=...&privacy=true&openSource=true&category=...&source=...&aiFirst=true` — Filters live in URL params. `aiFirst=true` renders the AI-discovered section above the library section.
- `/browse` — Category grid + paginated all-tools (12/page)
- `/browse/[category]` — Per-category listing
- `/tools` — All tools sorted by trust score
- `/tools/[slug]` — Tool detail (client, PostHog events)
- `/workflows` — Public workflows grid + Load more
- `/workflows/[id]` — Workflow detail (public OR owner-only for private)
- `/workflows/new` — Canvas (auth required)
- `/workflows/edit/[id]` — Canvas (auth + ownership)
- `/profile` — My workflows + Saved tools tab (auth required, client)
- `/sign-in`, `/sign-up` — Clerk catch-all

### API (all Node runtime, `dynamic = 'force-dynamic'`)
- `POST /api/search` — semantic + Gemini merge. Rate-limited 20/min/IP.
- `GET /api/tools` — paginated list. Rate-limited 60/min/IP.
- `GET /api/tools/[slug]` — single tool.
- `GET /api/tools/search?q=` — lexical drawer search + Gemini augmentation.
- `POST /api/workflows/create` — auth + sanitize. Rate-limited 10/hr/IP.
- `GET /api/workflows/public?page=&limit=` — public list.
- `GET /api/workflows/mine` — auth, current user's workflows.
- `GET|DELETE|PATCH /api/workflows/[id]` — ownership-checked. **Private → 403 for non-owners (NOT 404).**

All errors use `{ error: string, code: string }`.

---

## 9. PostHog events (fixed taxonomy of three)

```ts
posthog.capture('search_performed',       { query, result_count })
posthog.capture('tool_viewed',            { tool_slug, tool_name })
posthog.capture('tool_website_clicked',   { tool_slug, tool_name })
```

`$pageview` is captured manually in `app/_components/PostHogPageView.tsx`. **Do not add new events.**

---

## 10. Design tokens (only these — do not invent more)

```
bg            #FDFBF7     Cream white
surface       #FFFFFF
surface-2     #F3F0E6
border        #1A1A1A     thick dark stroke
text-primary  #1A1A1A
text-secondary #4A4A4A
text-muted    #8A8A8A
accent        #2A4B3C     dark green (Nori logo)
accent-glow   #D4AF37     gold/yellow
accent-pink   #F19CBB
accent-blue   #74A4F2

font sizes:   12 / 13 / 14 / 16 / 20 / 24 / 32 / 48 / 64 / 80
weights:      400 / 600 / 800
radii:        sm 8 / md 16 / lg 24 / xl 32 / pill 9999
durations:    fast 150 / base 250 / slow 400 / enter 500
easing:       cubic-bezier(0.175, 0.885, 0.32, 1.275)  (Bouncy spring)
```

**Design rules:** thick `border-2`/`border-4`, hard offset shadows like `shadow-[Nx_Nx_0px_#1A1A1A]`, bold-extrabold weights, `hover:-translate-y-1` lift, colored section backgrounds separated by `<WaveDivider>` on the homepage. Minimum touch target 44px.

---

## 11. Component conventions

- Server components by default. `'use client'` only when needed (hooks, events, browser APIs, Framer Motion, Clerk hooks).
- **Logos:** always `<ToolLogo name domain />` (not bare `<img>`). Falls Clearbit → Google favicon → `<ToolAvatar>` (deterministic gradient monogram). Never broken images.
- **Icons:** inline SVG via `<Icon path={...} />` or hand-written. Category icons are SVG `d` strings in `prisma/seed.ts`.
- **Buttons:** thick border, offset shadow, hover lift. The accent button uses `bg-accent text-surface`.
- **`next/image`** allowed for local `public/` assets (hero-art, corner-art).

---

## 12. Non-obvious decisions / gotchas

- **Two Gemini paths, two model names:**
  - Embeddings → `gemini-embedding-001` with `outputDimensionality: 768` (Matryoshka cut). Set via runtime cast (SDK 0.21 type doesn't expose the field).
  - Live discovery → `gemini-flash-latest`. `gemini-2.0-flash` is free-tier=0 on dev keys; `gemini-1.5-flash` 404s.
- **Search relevance threshold:** `lib/search.ts` filters out matches with cosine similarity below **0.62**. Nonsense queries score ~0.58; this prevents the "everything looks relevant" failure mode. Tuned for the 768-d Matryoshka cut — if you change the embedding model, recalibrate.
- **Drawer search ≠ global search.** `/api/tools/search` is lexical + Gemini, **no embeddings**. `/api/search` is semantic. Don't unify them — they have different cost profiles.
- **AI-first toggle is render-only.** Both the global search (URL: `?aiFirst=true`) and the canvas drawer (session state) reorder results client-side. The API always returns merged results in library-first order; toggling never re-fetches. `rankToolsForQuery(..., { aiFirst: true })` partitions Gemini ahead of DB while preserving within-group lexical order.
- **Gemini results auto-persist to the library.** After every successful `discoverToolsWithGemini` call, the route fires `void persistDiscoveredTools(discovered)` (in `lib/auto-library.ts`). The library grows organically — second search of the same query surfaces the same tools via DB/semantic search even if Gemini is rate-limited. Rows are marked `isAutoDiscovered: true` and trust-scored 0.5. Embedding generation is best-effort; lexical search still works if the embed call fails.
- **Gemini free tier is 20 req/day per model.** If `aiCount` is consistently 0, check the dev console for `[gemini-discovery] returning empty result: ... 429 Too Many Requests`. The per-minute window rolls every ~30 s; the per-day window resets at 00:00 PT. Auto-persist is exactly the mitigation — once tools are in the library, quota doesn't matter.
- **`nodeTypes` for React Flow must be declared at module scope** in `WorkflowCanvas.tsx`. Re-creating the object on each render makes React Flow drop nodes (classic "blank canvas" bug). The same applies to `edgeTypes`.
- **ReactFlow needs a mount gate.** `WorkflowCanvas` waits for a `useEffect`-set `mounted` flag before rendering `<ReactFlow>`, and the renderer is wrapped in `<ReactFlowProvider>`. ReactFlow uses `ResizeObserver` and `document`, which Next.js still SSRs through even with `'use client'` — without the gate, hydration drops nodes silently. Don't remove this guard.
- **Canvas height** is `calc(100vh - 64px)` (global header is `h-16`). Don't rely on `flex-1` alone for the React Flow wrapper — some browsers give it 0 height.
- **`<ToolLogo>` always paints a `<ToolAvatar>` placeholder** behind the `<img>`, fading the image in only after `onLoad`. Don't remove the placeholder — the trending grid fires 8+ Clearbit requests in parallel and the placeholder is what makes first paint look populated. `app/layout.tsx` also has `<link rel="preconnect">` to `logo.clearbit.com` and `www.google.com` to warm TLS.
- **Clerk uses path-to-regexp v6** — no negative lookaheads in route matchers. Use overlapping public+protected matchers and rely on the middleware's "protected wins" ordering.
- **Private workflow access:** `[id]/route.ts` returns **403** to non-owners (not 404). The owner sees their own existence.
- **`authorId` is always read from Clerk's `auth()`** — never from request body.
- **No zod / validation library.** All validation in `lib/sanitize.ts` (`sanitizeQuery`, `sanitizeWorkflowInput`, `stripHtml`, `isValidSlug`, `clampPage`, `clampLimit`).
- **Vector search is raw SQL** (`$queryRawUnsafe` with `$1::vector`). The only raw SQL in the codebase. Keep params parameterized.
- **`shapeTool()`** is the canonical Prisma → API mapper. Use it everywhere DB tools surface in JSON. Sets `source: 'db'` and derives `domain` server-side.
- **Rate limiter is in-memory** sliding window: search 20/min, workflow-create 10/hr, other 60/min. Resets on cold start (MVP-acceptable).
- **`exactOptionalPropertyTypes: true`** — optional props that may be undefined must be conditionally spread (`...(x !== undefined ? { x } : {})`), and `where: condition ? clause : undefined` is rejected by Prisma's strict types — use `...(condition ? { where: clause } : {})`.
- **`noUncheckedIndexedAccess: true`** — `array[0]` is `T | undefined`.
- **Build runs `prisma generate` first.** Re-run it any time the schema changes.

---

## 13. How to do common tasks

### Add a new tool
1. Append to `tools` array in `prisma/seed.ts`. 2–3 sentence description (embedding searches on it).
2. `npm run db:seed` (wipes + re-seeds — idempotent).

### Add a new category
1. Append to `categories` in `prisma/seed.ts` with a 24×24 stroke-based SVG `d` string.
2. `npm run db:seed`.

### Add a tool to the workflow canvas
Use the in-canvas drawer (`+ Add tool`). It calls `/api/tools/search`. To extend the drawer, edit `ToolPickerDrawer` inside `WorkflowCanvas.tsx`.

### Change the embedding model or dimensions
1. Edit `MODEL` and `EMBEDDING_DIMENSIONS` in `lib/embeddings.ts`.
2. Update `vector(768)` in `prisma/schema.prisma` to the new dim.
3. `npm run db:push` to re-create the column.
4. `npm run db:seed` to regenerate vectors.
5. Recalibrate `MIN_RELEVANT_SCORE` in `lib/search.ts`.

### Change the live-discovery Gemini model
Edit the `getGenerativeModel` call in `lib/gemini-discovery.ts`. Confirm the model is in the response of `GET https://generativelanguage.googleapis.com/v1beta/models?key=...` first.

### Add a new API route
1. Create `app/api/<name>/route.ts` with `export const runtime = 'nodejs'`.
2. Return `{ error, code }` shapes for failures with correct status codes (400/401/403/404/429/500).
3. The middleware rate limiter applies automatically to anything under `/api/`. Add a custom bucket in `middleware.ts` if a different limit is needed.

### Add a new PostHog event
**Don't.** Taxonomy is fixed at three. Remove one before adding one.

---

## 14. What is intentionally NOT here

- Comments, ratings, reviews, likes, follows
- Workflow forking, cloning, analytics
- Admin or moderation dashboard
- Email or push notifications
- Comparisons page (deferred)
- Social sharing buttons / og:image generation
- Saved-tools UI on `/profile` (placeholder shows "coming soon")
- Any autonomous AI agent or LLM-driven workflow execution
- Server-side PostHog (`posthog-node`)
- Mobile PWA manifest

---

## 15. Smoke test (verifies the install is healthy)

```bash
npm run dev
# in another shell:
curl http://localhost:3000/                                                                  # 200
curl http://localhost:3000/api/tools | jq '.tools | length'                                  # > 0
curl -X POST http://localhost:3000/api/search \
  -H 'content-type: application/json' \
  -d '{"query":"local llm runner"}' | jq '.results[0].slug'                                  # "ollama" or "lm-studio"
curl -X POST http://localhost:3000/api/search \
  -H 'content-type: application/json' \
  -d '{"query":"xqzjklmnop"}' | jq '.noResults'                                              # true
curl 'http://localhost:3000/api/tools/search?q=video' | jq '.results | length'               # > 0
curl http://localhost:3000/api/workflows/public | jq '.workflows | length'                   # >= 0
curl http://localhost:3000/api/tools/cursor | jq '.name'                                     # "Cursor"
```

If `/api/search` returns an embedding error, check `GEMINI_API_KEY`. If the live-discovery half consistently returns `aiCount: 0`, the key is most likely rate-limited (429) — the route silently falls back to library-only.
