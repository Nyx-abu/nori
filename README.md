# 🥬 Nori — Visual-First AI Discovery Engine & Infinite Workflow Canvas

```
 _   _  _____  ____  ___ 
| \ | |/  _  \|  _ \|_ _|
|  \| || | | || |_) | | |
| |\  || |_| ||  _ <  | |
|_| \_|\_____/|_| \_\|___|
```

> **A vibrant, playful, pop-art / neobrutalist platform for discovering AI tools and composing them into interactive, multi-node canvas workflows.**

---

## ⚡ The Vibe: Neobrutalist Pop-Art
Nori is designed to stand out. Inspired by modern high-contrast aesthetic pioneers (like *Super Hello* and *Jelly Bean*), the UI ditches boring flat gray grids in favor of a loud, alive, and highly-tactile experience:
*   **Tactile Physics:** Bouncy Framer Motion spring physics on every hover, click, and transition.
*   **Thick Boarders & Offset Shadows:** Bold `#1A1A1A` borders (`border-2` and `border-4`) paired with hard flat offset shadows (`shadow-[Nx_Nx_0px_#1A1A1A]`).
*   **Playful Styling & Wavy Dividers:** A beautiful cream white canvas (`#FDFBF7`) divided into colorful sections (Hero in vibrant Pink, Trending in Gold, Categories in Cream, and Workflows in Sky Blue) using custom neobrutalist **SVG Wave Dividers**.
*   **Static Corner Stickers:** Static, hand-designed retro-terminal, magnifying glass, and neural-node stickers flanking content grids like real physical stickers.

---

## 🚀 Key Features & Prowess

### 1. Dual Search Pipelines (⚡ Semantic Vector + 🏎️ Fast Lexical)
Nori runs two distinct search engines tailored to completely different performance and cost profiles:

```mermaid
graph TD
    %% Global Semantic Search (POST /api/search)
    subgraph Global [Global Semantic Search - api/search]
        Query[User Natural Query] --> Sanitize[Sanitize & Strip HTML]
        Sanitize --> Embed[Gemini gemini-embedding-001]
        Embed --> Vector[Raw SQL pgvector Cosine Search]
        Vector --> ScoreCheck{Cosine Similarity >= 0.62?}
        ScoreCheck -- No --> Empty[NoResults UI State]
        ScoreCheck -- Yes --> Filter[Prisma Candidate Filters]
        Filter --> Parallel[Promise.allSettled]
        Parallel --> DB[Top 10 Curated DB Tools]
        Parallel --> Live[Gemini Live Discovery]
        DB & Live --> Dedupe[Deduplicate by Name DB wins]
        Dedupe --> Persist[Auto-Persist Discovered Tools in BG]
        Dedupe --> Render[Client-Side Render with AI-First Toggle]
    end

    %% Fast Lexical Canvas Drawer (GET /api/tools/search)
    subgraph Drawer [Lexical Canvas Drawer - api/tools/search]
        QInput[Drawer Input keystrokes] --> Debounce[300ms Debounce]
        Debounce --> Contains[Prisma 'contains' scan name/tagline/category]
        Contains --> FastLive[Optional Fast Gemini discovery if q > 1]
        FastLive & Contains --> TokenRank[Deterministic Token-Overlap Ranking]
        TokenRank --> RenderDrawer[Top 25 Ordered results with explanations]
    end
```

*   **Global Semantic Search (`POST /api/search`):**
    *   **Vector Engine:** Natural language queries are sanitized, embedded using `gemini-embedding-001` (768-d Matryoshka cut), and compared against pre-embedded tool rows using raw SQL `$queryRawUnsafe` with cosine distance (`<=>`).
    *   **Calibrated Threshold (`>= 0.62`):** Cosine similarities below `0.62` represent noise/nonsense and cleanly redirect the user to a gorgeous, interactive empty state with category suggestions.
    *   **Hybrid Deduping:** Runs DB vector search and Gemini live discovery in parallel using `Promise.allSettled`, deduping by name where the DB row always takes precedence.
*   **Lexical Canvas Drawer (`GET /api/tools/search`):**
    *   Cheap, fast lexical scan querying fields using Prisma `contains`.
    *   Utilizes a custom **Deterministic Token-Overlap Ranker** (`lib/tool-ranking.ts`) awarding weighted bonuses: exact name match (`+100`), starts-with (`+60`), substring matches (`+40`), per-token bonuses, trust-score boosts, and AI-discovered explanation relevancy rewards.
*   **Shareable `AI-First` Toggle:** Client-side toggle (`aiFirst=true` URL param) flips rendering order instantly on the search page and React Flow drawer, partitioning AI-discovered tools ahead of library tools.

---

### 2. Autonomous Library Growth (AI Live-Discovery & Background Auto-Persist)
When users search for tools outside Nori's curated database, a background engine springs to life:
1.  **Live Discovery:** Nori hits `gemini-flash-latest` with a highly structured JSON-only prompt, returning up to 5 real-world tools matching the query.
2.  **Fire-and-Forget Persistence:** The moment results return, Nori fires a background thread (`void persistDiscoveredTools(...)`) to write new items to Postgres immediately. The HTTP response is **never blocked** by database writes.
3.  **Automatic Seeding & Vectorization:** The system slugifies the tool's name, upserts the row to handle concurrency safely, maps the category slug to standard categories, and launches an embedding process (`ToolEmbedding`) so the newly-discovered tool is instantly fully searchable semantically and lexically.
4.  **Audit Trail:** Saves rows with `isAutoDiscovered: true` and defaults trust scores to `0.5` (curated tools are rated higher).

---

### 3. Infinite React Flow Canvas (Neobrutalist Workflows)
Authenticated users can create and edit shareable, multi-node tool chains on a beautiful React Flow canvas:

```mermaid
graph LR
    %% Infinite Canvas Interaction
    User((Authenticated User)) --> Canvas[Infinite Canvas Client-side]
    Canvas --> NodePicker[Tool Picker Drawer]
    NodePicker --> SearchAPI[api/tools/search]
    SearchAPI --> Node[Visual ToolNode with Logo & Description]
    Node --> EditUseCase[Click-to-edit useCase state]
    Node --> Reorder[Move Left/Right buttons]
    Reorder --> Edges[Auto-wires Edge Connections in order]
    Canvas --> Save[Save button Clerk-authenticated]
    Save --> Transaction[Prisma Transaction: Wipes & rewrites Nodes & Ededges]
```

*   **Custom Tool Nodes:** Features custom `<ToolNode>` layout with editable use cases (inline edit state on click, save on blur/Enter, revert on Escape) and delete confirmations.
*   **Auto-Wiring Topological Edges:** Nodes automatically wire up sequentially via sequential `order` lists and a strict custom edge list (`WorkflowEdge` model). Rearranging nodes instantly rewires the connections client-side.
*   **Clerk-Protected API:** Workflows verify user authentication via `auth()` in Next.js server components (never trust request body user IDs). Private workflows return a **403 Forbidden** instead of a 404 for unauthenticated/unauthorized lookups.
*   **SSR Mount-Gate Guard:** Combats React Flow hydration bugs by utilizing a strict client-side mount gate and `<ReactFlowProvider>` context, showing a playful spinner while mounting.

---

### 4. Resilient Media & Core Component Assets
*   **Resilient Fallback Logo Chain (`<ToolLogo>`):** Combats parallel network latency and rate limits (e.g. Clearbit icon limitations) using a robust visual pipeline:
    $$\text{Clearbit Logo API} \longrightarrow \text{Google Favicon API} \longrightarrow \text{Deterministic Monogram avatar} \ (\text{ToolAvatar})$$
    The system renders a `<ToolAvatar>` background first, fading the actual image in with a smooth CSS transition only *after* a successful `onLoad`.
*   **TLS Warming / DNS Preconnect:** Injects `<link rel="preconnect" href="https://logo.clearbit.com" />` and `<link rel="preconnect" href="https://www.google.com" />` hints into `app/layout.tsx` to pre-warm SSL handshakes for high-concurrency tool grid rendering.
*   **Strict Mobile Responsiveness:**
    *   A full mobile hamburger navigation menu designed to be easily clickable, auto-closing on navigation via pathname keys.
    *   Username layout header wraps gracefully using full width cards and scales down text sizes on phones (`sm` stacks vertically).
    *   **Focus-Zoom Mitigation:** Forms and select components scale to `text-base` (16px) on mobile breakpoints, completely preventing iOS auto-zoom layout disruption.

---

### 5. Enriched Analytics Tracking (PostHog Taxonomy)
Rather than relying on generic and noisy PostHog autocapture, Nori runs a structured, fully explicit tracking catalog:

| Event Name | Key Triggers | Payload Details |
| :--- | :--- | :--- |
| **`search_performed`** | Triggered on natural language query submission | `query`, `result_count`, `db_count`, `ai_count`, `no_results`, `ai_first`, `source_filter`, `filters` |
| **`search_result_clicked`** | Fires when clicking any card on the search results | `tool_slug`, `tool_name`, `source` (`'db'` or `'gemini'`), `position` (0-indexed position within card group), `query` |
| **`tool_viewed`** | Fires on mounting a tool's detail page | `tool_slug`, `tool_name` |
| **`tool_website_clicked`** | Fires on clicking an external link to the tool | `tool_slug`, `tool_name` |
| **`workflow_created`** | Save of a new workflow | `workflow_id`, `node_count`, `is_public`, `tool_names` |
| **`workflow_updated`** | Successful patch of an existing workflow | `workflow_id`, `node_count`, `is_public`, `tool_names` |
| **`workflow_viewed`** | Mounting a workflow detail page | `workflow_id`, `is_owner`, `is_public`, `node_count` |
| **`workflow_deleted`** | Deletion of a workflow | `workflow_id` |

---

## 🛠️ Technology Stack

| Layer | Choice |
| :--- | :--- |
| **Framework** | Next.js **14.2.18** (App Router, Node runtime) |
| **Language** | TypeScript 5.6 (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| **Styling** | Tailwind CSS 3.4 (with customized design tokens in config) |
| **Animation** | Framer Motion 11 |
| **Database & ORM** | Neon Serverless Postgres + `pgvector` + Prisma 5.22 |
| **Authentication** | Clerk 5 (`/sign-in`, `/sign-up`, custom integration) |
| **AI Models** | Gemini (`gemini-embedding-001` for vector embeddings, `gemini-flash-latest` for live discovery) |
| **Canvas UI** | React Flow 11 |

---

## 📦 Directory Structure

```
nori/
├── app/
│   ├── layout.tsx                  # Clerk + PostHog providers, Outfit font, Header/Footer
│   ├── page.tsx                    # Hero + FeaturedTools + CategoryGrid + WorkflowShowcase
│   ├── providers.tsx               # PostHogProvider client wrapper
│   ├── _components/                # PostHog identify/pageview tracker mounting scripts
│   ├── browse/                     # Category landing + paginated browse pages
│   ├── search/                     # Semantic search UI + filtering + AI reordering
│   ├── tools/                      # Tool list + detail views
│   ├── workflows/                  # Public workflow directories + Canvas boards (new & edit)
│   └── api/                        # Next.js Node API Routes (Search, Tools, Workflows)
├── components/
│   ├── ui/                         # Neobrutalist buttons, inputs, badge variants, and logos
│   ├── search/                     # Search bar with autocomplete, filter sheets
│   ├── tools/                      # Tool display grids and detail components
│   ├── workflow/                   # Custom tool nodes and core React Flow elements
│   └── layout/                     # Custom site Header (hamburger aware) and Footer
├── lib/
│   ├── db.ts                       # Singleton Prisma DB client
│   ├── embeddings.ts               # Gemini embedding wrappers (768 dimensions)
│   ├── search.ts                   # Raw pgvector SQL queries & search filters
│   ├── gemini-discovery.ts         # Gemini flash live web-crawler response parsers
│   ├── auto-library.ts             # Background library auto-persistence engine
│   ├── tool-ranking.ts             # Canvas drawer lexical scoring algorithm
│   └── sanitize.ts                 # Stripping HTML, inputs, and slug validation (No Zod)
├── prisma/
│   ├── schema.prisma               # Prisma data schemas (AiTool, Workflow, Edges)
│   └── seed.ts                     # Database seeder (hand-crafted tools + vectors)
└── middleware.ts                   # In-memory sliding rate-limiter & Clerk router
```

---

## 🚀 Getting Started

### 1. Prerequisites & Environment Variables
Copy `.env.example` to `.env` and fill out the required secrets:

```env
# Database Credentials
DATABASE_URL="postgresql://user:password@neon-host/dbname?sslmode=require"
DIRECT_URL="postgresql://user:password@neon-host/dbname?sslmode=require"

# AI Core
GEMINI_API_KEY="AIzaSy..."

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/"

# Analytics
NEXT_PUBLIC_POSTHOG_KEY="phc_..."
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
```

### 2. Quick CLI Run
Install dependencies, sync the DB with Postgres, seed curated vector tools, and fire up the development server:

```bash
# Install dependencies
npm install

# Push Prisma schemas to Neon Database
npm run db:push

# Seed categories, curated tools, and pre-compute raw vectors
npm run db:seed

# Run dev server locally
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view Nori!

---

## 🧪 Quick Integration Testing

Run the following test scripts or `curl` operations to check system health:

```bash
# 1. Verify index response
curl -I http://localhost:3000/

# 2. Get list of tools
curl http://localhost:3000/api/tools | jq '.tools | length'

# 3. Test semantic search (pgvector + cosine search validation)
curl -X POST http://localhost:3000/api/search \
  -H 'content-type: application/json' \
  -d '{"query":"local llm runner"}' | jq '.results[0].slug'

# 4. Check empty / nonsense query redirection (MIN_RELEVANT_SCORE threshold check)
curl -X POST http://localhost:3000/api/search \
  -H 'content-type: application/json' \
  -d '{"query":"xqzjklmnop"}' | jq '.noResults'

# 5. Check fast drawer lexical search
curl 'http://localhost:3000/api/tools/search?q=video' | jq '.results | length'
```

---

🥬 Built with passion, thick borders, and heavy drop shadows by the Nori Team.
