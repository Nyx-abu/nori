# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed (Canvas SSR + logo first-paint)
- **Workflow canvas: nodes now render reliably.** Added a `mounted` mount-gate around `<ReactFlow>` in `WorkflowCanvas.tsx` plus wrapped it in `<ReactFlowProvider>`. ReactFlow needs `ResizeObserver` / `document`, which Next.js's `'use client'` doesn't shield from the server pass — without the gate, the renderer hydrated against the server placeholder and silently dropped nodes (the "blank canvas" the user kept seeing). While not mounted, the canvas area shows a "Loading canvas…" Spinner.
- **`ToolLogo` no longer flashes empty.** The component now always paints a `<ToolAvatar>` monogram underneath, with the real `<img>` fading in only after `onLoad` fires. So the trending grid shows logos from the first frame; if Clearbit is slow/throttled, the user sees the monogram instead of nothing. The Clearbit → Google favicon → ToolAvatar fallback chain is preserved; `<img>` gets a `key={src}` so `onLoad` re-fires on each fallback attempt.
- **Preconnect + DNS-prefetch hints** in `app/layout.tsx` for `https://logo.clearbit.com` and `https://www.google.com`. Warms TLS so the 8+ parallel logo requests on the trending grid don't all queue behind a cold handshake.

### Added (Auto-library — Gemini results persist on discovery)
- **`AiTool.isAutoDiscovered`** boolean (defaults `false`) — flags rows inserted by the live-discovery write path so curated vs. auto-added tools can be audited or filtered later. `npx prisma db push` applied.
- **`lib/auto-library.ts`** — `persistDiscoveredTool` slugifies the name, upserts on `slug` (idempotent under concurrent inserts), maps Gemini's `categorySlug` to a real `Category.id` (falls back to `productivity`, then first category), then fires an embedding write into `ToolEmbedding` so the tool joins both lexical and semantic search. Every failure path is caught and logged — designed for fire-and-forget.
- **`persistDiscoveredTools(...)`** is invoked as `void persist...` from both `POST /api/search` and `GET /api/tools/search` immediately after Gemini returns. The HTTP response never waits on it.
- **Gemini prompt now requests a `categorySlug`** chosen from the live category list. Invalid or null values fall through to the helper's default.
- **`[gemini-discovery] returning empty result: <reason>`** is now logged (previously silent). Makes 429 / 404 / parse failures visible during local dev.
- **Trust score for auto-added rows defaults to `0.5`** — below the curated baseline but enough to surface near the top of vector results for an exact-match query.

### Added (AI-first toggle)
- **Order toggle in `FilterPanel`** — new "Order" group with `Library first` / `AI-discovered first` chips. State lives in the URL as `?aiFirst=true` so it's shareable and survives back/forward. Active state contributes to the filter count and is cleared by "Clear all".
- **`SearchResults` reorders sections** based on the `aiFirst` prop — Gemini section renders above the library section when true. No extra fetch: the API still returns merged results and the client just swaps render order.
- **Drawer toggle** in `WorkflowCanvas` `ToolPickerDrawer` — compact `Library first` / `AI first` pills below the search input. Session-local state (drawer is transient). Reorders results instantly via `rankToolsForQuery(..., { aiFirst })`.
- **`rankToolsForQuery` accepts `{ aiFirst }`** in `lib/tool-ranking.ts`. When true, results are partitioned (Gemini above DB) after the lexical score sort — within-group order is preserved.

### Fixed (Workflow Canvas & Drawer Search)
- **React Flow nodes now render reliably.** `nodeTypes` moved to module scope in `components/workflow/WorkflowCanvas.tsx` so React Flow doesn't re-register custom node renderers between renders (the "blank canvas / disappearing nodes" bug).
- **Explicit canvas height.** Wrapper now uses `calc(100vh - 64px)` instead of relying on `flex-1` alone — eliminates the 0-height container case in some chromium variants. React Flow also gets `fitViewOptions={{ padding: 0.3 }}`, `minZoom: 0.3`, `maxZoom: 2`, `defaultEdgeOptions={{ animated: true }}`.
- **First-node placement** is now `{ x: 100, y: 100 }`; each subsequent node stacks `+180px` below.
- **Edges** auto-rebuild from chain order via `useMemo`; reordering with `← / →` immediately rewires connections.
- **`ToolNode` click-to-edit.** Internal `editing` state replaces the always-on input. Click the use-case line to edit; blur or Enter saves; Escape reverts. Move controls renamed `onMoveLeft` / `onMoveRight` (legacy `onMoveUp`/`onMoveDown` kept as aliases). Delete confirms via `window.confirm`.

### Added (Workflow Canvas & Drawer Search)
- **`GET /api/tools/search`** — new fast lexical route powering the in-canvas tool drawer. Prisma `contains` against name/tagline/description/category.name, optional Gemini augmentation (`gemini-flash-latest`), case-insensitive dedupe (DB wins), top 25 ranked results.
- **`lib/tool-ranking.ts`** — deterministic token-overlap ranker: exact name (+100), startsWith (+60), contains (+40), per-token bonuses in name/tagline/whyRelevant, Gemini explanation reward, small DB trust bonus.
- **Canvas drawer** preloads the full library on open (empty query → trustScore desc), then debounces 300ms per keystroke, then re-ranks. Gemini results render `whyRelevant` text below the tagline. Click outside or `close` button dismisses.

### Added (Major Expansion — Auth, Workflows, Browse, Filters, Discovery)
- **Auth UI.** Clerk catch-all routes at `/sign-in/[[...sign-in]]` and `/sign-up/[[...sign-up]]`. Header gained `<SignedIn>` / `<SignedOut>` blocks with `<UserButton>` + a `Profile` link. `Clerk` environment keys (`SIGN_IN_URL`, `SIGN_UP_URL`, `AFTER_SIGN_IN_URL`, `AFTER_SIGN_UP_URL`) added to `.env.example` and `.env`.
- **Workflow data model.** `Workflow` and `WorkflowNode` Prisma models with cascade deletes, indexed on `authorId`/`isPublic`/`createdAt`. Nodes carry `toolDomain` so Gemini-discovered tools (no DB row) still render in the chain.
- **Workflow API.**
  - `POST /api/workflows/create` — Clerk-authed, sanitized via `sanitizeWorkflowInput`, transactional create. `authorId` always comes from `auth()`, never the body. Rate-limited 10/hr per IP in `middleware.ts`.
  - `GET /api/workflows/public` — paginated public list with first-3 node previews.
  - `GET /api/workflows/mine` — authed, current user's workflows (public + private).
  - `GET / DELETE / PATCH /api/workflows/[id]` — ownership-checked. Private workflows return **403** (not 404) to non-owners; PATCH wipes-and-rewrites nodes in a Prisma transaction.
- **Workflow pages.**
  - `/workflows` — public grid with "Load more" pagination, `<SignedIn>`-gated "Create" CTA.
  - `/workflows/new` — full-screen React Flow canvas with title/description/public toggle, drawer-based tool picker.
  - `/workflows/edit/[id]` — same canvas component, hydrated with the existing workflow (auth + ownership server-side).
  - `/workflows/[id]` — read-only chain view with `↓` step arrows; owners see inline Edit/Delete.
  - `/profile` — Clerk `useUser()` page with "My workflows" (lock indicator for private) + "Saved tools (coming soon)" tabs.
- **Browse experience.**
  - `/browse` — category grid + paginated all-tools (12/page) on `bg-accent-blue`.
  - `/browse/[category]` — per-category listing on `bg-accent-pink` with category icon + tool count.
  - Homepage `CategoryGrid` cards now route to `/browse/[slug]` (previously `/search?category=`).
- **Search filters.** New `FilterPanel` keeps filter state in URL params (pricing, platforms, privacy, openSource, category, source). `/api/search` and `searchTools()` accept the expanded filter set.
- **Live AI discovery.** `lib/gemini-discovery.ts` calls Gemini `gemini-flash-latest` with a structured JSON-only prompt, returns up to 5 real tools not in the library. `/api/search` runs DB + Gemini in `Promise.allSettled` and merges with case-insensitive name dedupe (DB wins). Gemini result cards open the website directly (no detail page) and show `whyRelevant` as a subtitle.
- **No-results state.** `MIN_RELEVANT_SCORE = 0.62` cutoff in `lib/search.ts` rejects baseline-similarity matches; nonsense queries trigger the `NoResults` empty state with a "Browse categories" CTA.
- **Tool logos with fallback.** `lib/logo.ts` (`getDomainFromUrl`, Clearbit/favicon URL helpers) + `components/ui/ToolLogo.tsx` with Clearbit → Google favicon → `ToolAvatar` chain. `domain` field added to `ToolResult` and derived server-side in `shapeTool()`. All tool cards (search results, browse, drawer, workflow nodes) use `<ToolLogo>` instead of bare `<img>` — no more broken images.
- **Error boundaries.** `app/error.tsx` and `app/global-error.tsx` styled to the cream/neobrutalist look.

### Changed
- **Middleware split into public / protected matchers** with overlapping `/workflows/(.*)` rules — Clerk's path-to-regexp v6 rejects negative lookaheads, so the middleware prioritizes the protected matcher when a route appears in both lists.
- **Rate-limit buckets:** search 20/min, workflow-create 10/hr, other 60/min — all per-IP, in-memory sliding window.
- **`shapeTool()`** now derives `domain` from `website` and tags every result with `source: 'db'`.
- **Layout metadata** updated to `Nori — Discover AI Tools` per the expansion spec.

### Earlier Pop-Art Pass
- **Badge Contrast & Pop-Art Refinements:**
  - Fixed color contrast readability issues in the `Badge.tsx` component. The `accent` (Image/Category) tag now uses pure black text with a bold weight on the gold background, complete with a neo-brutalist dark shadow.
  - Applied the same high-contrast, thick-border shadow treatment to all badge variants (neutral, success, warning).
- **Responsive Corner Artworks Refined:**
  - Regenerated corner artworks to feature relevant, project-specific AI graphic elements (Stylized Magnifying Glass, Neural Nodes, Retro Terminal) instead of random full scenes.
  - Pinned the illustrations *adjacent to the core content blocks* (`FeaturedTools`, `CategoryGrid`, `WorkflowShowcase`) in `app/page.tsx` instead of floating in viewport corners. They flank the content beautifully on wide screens like physical card stickers, wrapped in matching pop-art card frames and drop shadows with labels.
  - Removed all floating/hover scale animations and translucency, locked them in static positions, and secured them with `pointer-events-none` and a background `z-0` index to prevent any UI obstruction.
  - Maintained full responsiveness by hiding them on smaller screens (`hidden xl:block`).
- **Section Styling & Wavy Dividers:**
  - Separated the homepage into beautifully colored, distinct sections (Pink for Hero, Yellow for Trending, Cream for Categories, Blue for Workflows) using our pop-art design tokens.
  - Implemented a custom `WaveDivider` SVG component with a thick, neo-brutalist black border to transition between the colored sections playfully.
  - Wrapped the main Hero artwork in the matching thick-bordered card design for consistency.
- **Vertical Trending Layout:**
  - Fixed UI cutoff and obstruction issues by migrating the `FeaturedTools` container from a horizontal scrolling row to a structured, fully-responsive vertical CSS grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`).
- **Browse Page Styling:**
  - Applied a lovely full-screen `bg-accent-blue` theme to the `/tools` browse page to maintain the vibrant aesthetic across the site.
- **Bug Fixes:**
  - Fixed an issue where the animated placeholder text in the `SearchBar` would wrap onto multiple lines on mobile screens. The text now properly truncates with an ellipsis.
  - Fixed an issue where the "Open source" badge was appearing twice on tool cards that had both `pricing="OPEN_SOURCE"` and `isOpenSource=true`.

- **Total Aesthetic Pivot (Pop-Art Isometric):**
  - Updated `AGENTS.md` and `tailwind.config.ts` to replace the dark minimal theme with a vibrant, playful, cream-based palette (`#FDFBF7`, `#2A4B3C`, pinks, and blues).
  - Replaced the `Inter` font with `Outfit` for a more rounded, friendly typography.
  - Redesigned the `Hero.tsx` layout to feature a neo-brutalist pop-art style with thick borders, bright shadow drops, bouncy Framer Motion spring physics, and an embedded isometric robot artwork (`hero-art.png`).
  - Redesigned `SearchBar.tsx` to include hard, thick shadows and bouncy hover states.
  - Updated `Header.tsx` to feature the new green/gold wavy Nori logo mark as an inline SVG.

