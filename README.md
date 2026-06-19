# 🥬 Nori — Visual-First AI Discovery Engine & Infinite Workflow Canvas

```
 _   _  _____  ____  ___ 
| \ | |/  _  \|  _ \|_ _|
|  \| || | | || |_) | | |
| |\  || |_| ||  _ <  | |
|_| \_|\_____/|_| \_\|___|
```

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Nori CI](https://github.com/Nyx-abu/nori/actions/workflows/ci.yml/badge.svg)](https://github.com/Nyx-abu/nori/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-14.2.18-black?logo=next.js)](https://nextjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwind-css)](https://tailwindcss.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org)
[![React Flow](https://img.shields.io/badge/React_Flow-11-ff007f?logo=react)](https://reactflow.dev)
[![Clerk](https://img.shields.io/badge/Auth-Clerk_5-6c47ff?logo=clerk)](https://clerk.com)
[![Database](https://img.shields.io/badge/Database-Neon_Postgres-00e599?logo=postgresql)](https://neon.tech)
[![Last Updated](https://img.shields.io/badge/Last_Updated-June_2026-brightgreen)](#)

> **Nori is a visual-first AI tool discovery platform and infinite canvas workflow builder.** Search for AI tools using multi-vector semantic retrieval with RRF fusion, discover new tools in real-time via Gemini live discovery, and compose them into shareable, multi-node step-by-step workflows — all on an interactive React Flow canvas.

Featuring a vibrant, high-contrast **Neobrutalist Pop-Art** design language with springy Framer Motion physics, Nori is built for maximum responsiveness, visual engagement, and robust reliability under high load.

---

## ⚡ Design Philosophy: Neobrutalist Pop-Art

Nori intentionally rejects flat, generic minimalist styles in favor of a tactile, alive, and highly responsive user interface:
*   **Tactile Feedback & Physics:** Custom Framer Motion spring physics trigger bouncy, physical-feeling transformations on hover, click, and transition.
*   **Thick Strokes & Offset Shadows:** Defined by `#1A1A1A` borders (`border-2` and `border-4`) paired with flat offset drop shadows (`shadow-[Nx_Nx_0px_#1A1A1A]`) that make elements pop off the screen.
*   **Structured Color Palette:** Soft cream white canvas (`#FDFBF7`) contrasted with bold, curated highlight zones (Vibrant Pink, Gold, Sky Blue) separated by neobrutalist SVG wavy dividers (`<WaveDivider>`).
*   **Viewport Corner Stickers:** Hand-designed retro-terminal, magnifying glass, and neural-node cards pinned statically adjacent to layout grids to simulate real sticker decoration without interfering with pointer events.
*   **Mobile Form Layout Protection:** All text inputs, textareas, and select menus scale to at least `text-base` (16px) on mobile viewports to prevent iOS browser auto-zoom layout distortion.

---

## 🚀 Architectural Blueprint & Pipelines

Nori split its operations into specialized engines to maintain extreme responsiveness and support massive search scalability.

### 1. Global Semantic Search & Fusion Pipeline (`POST /api/search`)

The global search utilizes a hybrid dense-vector and sparse-lexical retrieval pipeline, executed inside a single, highly optimized Neon Postgres database transaction.

```mermaid
graph TD
    %% Global Semantic Search (POST /api/search)
    subgraph Global [Global Semantic Search - api/search]
        Query[User Natural Query] --> Sanitize[Sanitize & Strip HTML]
        Sanitize --> QueryLen{Query < 4 Tokens?}
        QueryLen -- Yes --> HyDE[HyDE Query Expansion: Gemini Flash]
        QueryLen -- No --> RawQuery[Original Query]
        HyDE --> Embed[Generate Query Vector: gemini-embedding-001]
        RawQuery --> Embed
        Embed --> DBTransaction[Begin Transaction: SET ef_search = 100]
        DBTransaction --> CTE[4-Way Parallel Retrieval CTE]
        CTE --> R1[1. Name Vector Cosine Distance]
        CTE --> R2[2. Tagline Vector Cosine Distance]
        CTE --> R3[3. Description Vector Cosine Distance]
        CTE --> R4[4. tsvector ts_rank_cd Lexical Search]
        R1 & R2 & R3 & R4 --> RFF[Reciprocal Rank Fusion - RRF]
        RFF --> RerankCheck{Jina Reranker Key Present?}
        RerankCheck -- Yes --> Jina[Jina Cross-Encoder Reranking]
        RerankCheck -- No --> FallbackRRF[Fallback to RRF Order]
        Jina --> Sigmoid{Sigmoid Score >= 0.3?}
        Sigmoid -- Yes --> Top10[Take Top-10 Curated DB Tools]
        Sigmoid -- No --> Drop[Drop Candidate]
        FallbackRRF --> Top10
        Top10 --> Shape[shapeTool Mapper]
        Shape --> Response[Return Results + Telemetry Meta]
        
        %% Fallbacks
        Embed -.->|Embedding Failure| LexicalFallback[Lexical-Only Fallback: tsvector]
        LexicalFallback --> Shape
    end
```

#### Multi-Vector Representation
Unlike standard vector search, which encodes an entire tool row into a single diluted vector, Nori uses a **three-column vector schema** (`ToolEmbedding` model):
*   `nameVec`: Vector representation of the tool's name.
*   `taglineVec`: Vector representation of the tool's tagline.
*   `descriptionVec`: Vector representation of the tool's full description.

All vectors are 3072 dimensions, generated using `gemini-embedding-001`, and stored in Neon Postgres as `halfvec(3072)` columns (reducing memory requirements to ~6KB per tool). HNSW cosine indexes (`halfvec_cosine_ops`) are maintained on all three columns.

#### Reciprocal Rank Fusion (RRF)
To merge lexical match relevance with semantic meaning, Nori runs a 4-way parallel retrieval using Common Table Expressions (CTEs), ranking candidates based on the formula:
$$RRF(d) = \sum_{m \in M} \frac{1}{60 + r_m(d)}$$
Where:
*   $M$ represents the 4 ranking lists (`nameVec` HNSW, `taglineVec` HNSW, `descriptionVec` HNSW, and weighted `tsvector` lexical rank).
*   $r_m(d)$ is the 1-based rank of document $d$ in ranker list $m$.

To prevent HNSW search degradation when applying pre-filters (e.g., categories, platforms, pricing models), filters are pushed down into the HNSW search boundary. `ef_search` is set locally to `100` within the transaction scope to recover recall.

#### HyDE Query Expansion
Short search queries (< 4 tokens) carry weak semantic weight. Nori intercepts these queries and utilizes `gemini-flash-latest` to generate a 2-sentence hypothetical ideal tool description (HyDE). The hypothetical content is concatenated with the original query before embedding:
$$\text{Query}_{\text{expanded}} = \text{Query}_{\text{original}} + ". " + \text{Query}_{\text{hypothetical}}$$
This is cached in Upstash Redis for 7 days to eliminate latency overhead for common terms.

#### Jina Cross-Encoder Reranking
The top 20 candidates returned by RRF are piped to Jina's `jina-reranker-v2-base-multilingual` cross-encoder. It evaluates the query against the complete textual metadata (name, tagline, description, category, and tags). Candidates with a calibrated sigmoid relevance score below `0.3` are discarded. If Jina is rate-limited or unconfigured, Nori gracefully falls back to the RRF rank order.

#### Lexical-Only Fallback
If the Gemini embedding service experiences downtime, `searchTools` triggers a fail-safe fallback using weighted `tsvector` prefix scanning, ensuring that users can search Nori even during upstream AI outages.

---

### 2. Live Discovery & Autonomous Library Growth (`POST /api/search/discover`)

To bypass the limits of pre-seeded library databases, Nori runs a live web-discovery cycle in parallel:

```mermaid
graph LR
    %% Live Discovery Lifecycle
    Query[User Query] --> GeminiDiscovery[Gemini Flash Live Discovery]
    GeminiDiscovery --> Parse[JSON Parsing & validation]
    Parse --> Dedupe{Case-Insensitive Deduplication vs DB}
    Dedupe -- Exists in DB --> Discard[Discard Discovery]
    Dedupe -- New Tool --> ReturnClient[Stream to Client Results]
    ReturnClient --> Persist[Background Task: persistDiscoveredTools]
    Persist --> Seed[1. Slugify & Write to AiTool table]
    Seed --> Category[2. Resolve Category & tags]
    Category --> Vectorize[3. Generate nameVec / taglineVec / descriptionVec]
    Vectorize --> EmbedWrite[4. Write halfvec rows & trigger HNSW updates]
```

1.  **Parallel Execution:** The frontend search client fires both the database search and the live discovery in parallel. The database results render instantly, while AI results stream in 2-3 seconds later.
2.  **Structured Generation:** `gemini-flash-latest` runs a highly structured, JSON-schema constrained generation, returning up to 5 real tools matching the query.
3.  **Fire-and-Forget Auto-Persistence:** Discovered tools are returned to the client and immediately dispatched to a non-blocking background thread (`lib/auto-library.ts`). The API response completes without waiting on DB writes.
4.  **Database Vectorization:** The background job slugifies the name, upserts the row to handle race conditions, maps the AI category to a database category ID, and runs embedding generations so the new tool is indexed semantically and lexically. Auto-discovered tools default to a trust score of `0.5` (curated tools are rated higher).

---

### 3. Infinite React Flow Canvas (`/workflows`)

Authenticated users can construct, arrange, and save multi-node tool chains on a digital canvas:

```mermaid
graph TD
    %% React Flow Canvas architecture
    subgraph Canvas [Infinite Canvas Lifecycle]
        Init[Hydration Mount-Gate Guard] --> ReactFlow[ReactFlowProvider Container]
        ReactFlow --> CustomNode[Custom ToolNode Components]
        ReactFlow --> EdgeGen[Memoized Sequence Edge Generator]
        ReactFlow --> Drawer[Fast Lexical Tool Drawer]
    end
    
    Drawer --> LexicalSearch[api/tools/search]
    LexicalSearch --> Ranking[Deterministic Token-Overlap Ranking]
    Ranking --> DragNode[Add Node to Canvas]
    
    DragNode --> ClickEdit[Click-to-Edit Inline Use Case]
    ClickEdit --> Reorder[Move Left / Move Right Controls]
    Reorder --> Save[Save Workflow]
    Save --> Transaction[Prisma Transaction: Wipe & Re-write nodes]
```

*   **Fast Lexical Canvas Search (`GET /api/tools/search`):** Powered by prefix-matching tsqueries. If the query exceeds 1 character, it performs a fast Gemini discovery scan. Results are ordered using a deterministic token-overlap ranker (`lib/tool-ranking.ts`), awarding bonuses for exact matches, substring alignment, and AI relevancy.
*   **Custom Node Nodes:** Custom `<ToolNode>` layout with editable use cases (inline edit state on click, save on blur/Enter, revert on Escape) and delete confirmations.
*   **Memoized Sequence Wiring:** Nodes auto-wire sequentially via a computed `order` index. Repositioning or reordering nodes using canvas arrows instantly rebuilds the edge array client-side using `useMemo`.
*   **Prisma Write Transactions:** Saving a workflow executes a single transactional database write that wipes existing nodes/edges and rewires the active structure, preventing orphaned records.
*   **Next.js Hydration Mount-Gate:** React Flow utilizes browser layout APIs (`ResizeObserver`, `document`) that trigger hydration errors during Next.js SSR passes. Nori blocks rendering behind a client-side `mounted` state gate, showing a stylized loading spinner until the DOM is hydrated.

---

### 4. Resilient Logo Loading & TLS Warming

*   **Robust Fallback Pipeline (`<ToolLogo>`):** Combats network latency and logo service rate-limiting by executing a cascading image loading strategy:
    $$\text{Clearbit Logo API} \longrightarrow \text{Google Favicon API} \longrightarrow \text{Deterministic Monogram Avatar}$$
    The component draws a SVG gradient monogram `<ToolAvatar>` as a background placeholder, fading in the web image via CSS transitions once `onLoad` fires.
*   **TLS Warming / DNS Preconnect:** Injects `<link rel="preconnect" href="https://logo.clearbit.com" />` and `<link rel="preconnect" href="https://www.google.com" />` hints into the layout document to pre-warm handshakes for grids containing dozens of external tool logos.

---

## 📊 Analytics Schema (PostHog Event Catalog)

Nori implements an explicit, structured event taxonomy rather than relying on noisy autocapture:

| Event Name | Trigger Context | Payload Parameters |
| :--- | :--- | :--- |
| **`search_performed`** | Emitted when a semantic or fallback search is completed | `query`, `result_count`, `db_count`, `ai_count`, `no_results`, `ai_first`, `source_filter`, `filters` |
| **`search_result_clicked`** | Emitted when a tool card is clicked on search results | `tool_slug`, `tool_name`, `source` (`'db'` \| `'gemini'`), `position`, `query` |
| **`tool_viewed`** | Emitted when a user loads a tool details page | `tool_slug`, `tool_name` |
| **`tool_website_clicked`** | Emitted when a user redirects to the tool's external website | `tool_slug`, `tool_name` |
| **`workflow_created`** | Emitted when a user saves a new workflow to the canvas | `workflow_id`, `node_count`, `is_public`, `tool_names` |
| **`workflow_updated`** | Emitted when an owner saves changes to a workflow | `workflow_id`, `node_count`, `is_public`, `tool_names` |
| **`workflow_viewed`** | Emitted when a workflow detail page is mounted | `workflow_id`, `is_owner`, `is_public`, `node_count` |
| **`workflow_deleted`** | Emitted when a workflow is removed | `workflow_id` |

---

## 🛠️ Technology Stack & Dependencies

| Layer | Choice | Version |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router, Node.js Runtime) | `14.2.18` |
| **Language** | TypeScript | `5.6` |
| **Styling** | Tailwind CSS | `3.4` |
| **Animation** | Framer Motion (named imports) | `11` |
| **Authentication** | Clerk | `5` |
| **Database & ORM** | Serverless Postgres (Neon) + `pgvector` & Prisma | `5.22` |
| **Vector Engine** | `gemini-embedding-001` (3072 dimensions) | Beta |
| **Discovery Model** | `gemini-flash-latest` | Latest |
| **Rerank Model** | Jina `jina-reranker-v2-base-multilingual` | Latest |
| **Canvas Core** | React Flow | `11` |
| **Analytics** | PostHog (Client-side manual tracking) | `1.181.0` |

---

## 📂 Directory Layout

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
│   ├── embeddings.ts               # Gemini embedding wrappers (3072 dimensions)
│   ├── search.ts                   # Raw pgvector SQL queries & search filters
│   ├── gemini-discovery.ts         # Gemini flash live web-crawler response parsers
│   ├── auto-library.ts             # Background library auto-persistence engine
│   ├── tool-ranking.ts             # Canvas drawer lexical scoring algorithm
│   └── sanitize.ts                 # Stripping HTML, inputs, and slug validation (No Zod)
├── prisma/
│   ├── schema.prisma               # Prisma data schemas (AiTool, Workflow, Edges)
│   └── seed.ts                     # Database seeder (hand-crafted tools + vectors)
├── scripts/
│   ├── eval-search.ts              # Mathematical query relevance evaluation suite
│   └── migrate-multivec.ts         # Prisma migration helper for multivec support
└── middleware.ts                   # In-memory sliding rate-limiter & Clerk router
```

---

## 🚀 Getting Started

### 1. Configure the Environment
Clone `.env.example` to `.env` and fill out the required credentials:

```env
# Database Credentials
DATABASE_URL="postgresql://user:password@neon-host/dbname?sslmode=require"
DIRECT_URL="postgresql://user:password@neon-host/dbname?sslmode=require"

# Gemini Core
GEMINI_API_KEY="AIzaSy..."

# Jina Cross-Encoder Reranker
JINA_API_KEY="jina_..."

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/"

# Upstash Redis (HyDE Query Cache)
UPSTASH_REDIS_REST_URL="https://...upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."

# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY="phc_..."
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
```

### 2. Local Setup & Initialization

```bash
# Install package dependencies
npm install

# Push local Prisma changes to the Neon Postgres database
npm run db:push

# Generate Prisma Client & execute seed scripts to populate vectors
npm run db:seed

# Launch the development server
npm run dev
```

Visit `http://localhost:3000` to interact with your local instance of Nori.

---

## 🧪 Relevancy Evaluation Suite

To maintain high search relevancy without relying on subjective tuning, Nori includes a mathematical evaluation script that runs search relevance benchmarks:

```bash
npm run eval:search
```

The script evaluates a catalog of hand-labeled queries representing direct intent, adjacent intent, tag-style queries, and nonsense terms. It outputs:
*   **nDCG@10 (Normalized Discounted Cumulative Gain):** Validates rank order, ensuring the most relevant tools appear at the top.
*   **P@10 (Precision at 10):** Measures the density of relevant results in the top 10 positions.
*   **R@10 (Recall at 10):** Measures the retrieval coverage relative to all known relevant items in the library.
*   **HyDE & Rerank telemetry:** Outlines exactly when HyDE triggered and how the Jina reranker behaved.

---

## ⚙️ CI/CD Pipeline

Nori utilizes **GitHub Actions** for continuous integration to maintain strict code quality standards:
*   **Quality Gates**: Code style formatting and lints (`npm run lint`), TypeScript typing verification (`npx tsc --noEmit`), and production compiling (`npm run build`) run automatically on all PRs.
*   **Database Integrations**: Spins up a local Docker container running PostgreSQL with the `pgvector` extension, pushes the schema, and generates the Prisma client.
*   **Search Relevance Auditing**: Runs search quality benchmarks (`npm run eval:search`) dynamically if `GEMINI_API_KEY` and `JINA_API_KEY` are provided in repository secrets.
*   **Security Auditing**: Audits package dependencies for vulnerabilities (`npm audit`).

---

## 🤝 Contribution Guidelines

We welcome contributions from the open-source community! To maintain Nori's code quality and performance profiles, please adhere to these guidelines:

1.  **Strict Styling Isolation:** Do not install third-party UI component libraries (e.g. Radix, Shadcn) or styling utilities. Use native CSS, tailwind utility classes, or custom SVG components.
2.  **No Zod or Heavy Parsers:** Input verification should remain light. Write custom validation blocks in `lib/sanitize.ts` using native strings and regular expressions.
3.  **Strict TypeScript:** Keep strict type-checking on (`noUncheckedIndexedAccess`, `strict`, `exactOptionalPropertyTypes`). Ensure optional properties are handled safely.
4.  **Logo Loading Architecture:** When building components that display tool logos, always wrap the image source inside a `<ToolLogo>` tag to benefit from preconnect DNS hooks and monogram failover cascades.
5.  **React Flow Mount Guards:** Never instantiate `<ReactFlow>` outside of a mount-gate check (verifying that the DOM has hydrated) to prevent layout breakages.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
