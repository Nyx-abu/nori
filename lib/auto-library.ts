// Fix-pass decision: auto-persist discovered Gemini tools so they show up via library search next time even when Gemini is rate-limited. Designed to be fire-and-forget — every failure path is swallowed and logged. Embeddings are generated last so a Gemini-embed outage still leaves the tool in the library (it just won't be vector-searchable until re-seeded).
import { prisma } from './db'
import { PricingType } from '@prisma/client'
import { embed, toPgVectorLiteral } from './embeddings'
import type { DiscoveredTool } from './gemini-discovery'

const SLUG_MAX = 80

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
}

let cachedFallbackCategoryId: string | null = null
async function getFallbackCategoryId(): Promise<string | null> {
  if (cachedFallbackCategoryId) return cachedFallbackCategoryId
  // Prefer "productivity" if present (broad bucket), else the alphabetically first.
  const cat =
    (await prisma.category.findUnique({
      where: { slug: 'productivity' },
      select: { id: true },
    })) ??
    (await prisma.category.findFirst({
      select: { id: true },
      orderBy: { name: 'asc' },
    }))
  cachedFallbackCategoryId = cat?.id ?? null
  return cachedFallbackCategoryId
}

async function resolveCategoryId(categorySlug: string | null): Promise<string | null> {
  if (categorySlug) {
    const c = await prisma.category.findUnique({
      where: { slug: categorySlug },
      select: { id: true },
    })
    if (c) return c.id
  }
  return getFallbackCategoryId()
}

/**
 * Insert a Gemini-discovered tool into the AiTool table + ToolEmbedding. Idempotent on slug —
 * if a tool with the slugified name already exists, this is a no-op and returns null.
 *
 * Resilient to any failure: every error path is caught and logged. The caller should fire-and-forget.
 */
export async function persistDiscoveredTool(tool: DiscoveredTool): Promise<string | null> {
  const slug = slugify(tool.name)
  if (!slug) return null

  try {
    const existing = await prisma.aiTool.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (existing) return null

    const categoryId = await resolveCategoryId(tool.categorySlug)
    if (!categoryId) {
      console.warn('[auto-library] no category available, skipping', tool.name)
      return null
    }

    // tagline doubles as description seed when Gemini gives only a one-liner — embeddings need prose.
    const description = tool.whyRelevant
      ? `${tool.tagline} — ${tool.whyRelevant}`
      : tool.tagline

    const created = await prisma.aiTool.create({
      data: {
        slug,
        name: tool.name,
        tagline: tool.tagline,
        description,
        website: tool.website,
        pricing: tool.pricing as PricingType,
        isOpenSource: tool.isOpenSource,
        isPrivacyFocused: tool.isPrivacyFocused,
        isAutoDiscovered: true,
        platforms: tool.platforms,
        trustScore: 0.5,
        categoryId,
      },
      select: { id: true },
    })

    // Generate embedding so it shows up in semantic search too. Best-effort:
    // if Gemini-embed is rate-limited the tool is still in the library and surfaces via lexical search.
    try {
      const vec = await embed(`${tool.name}. ${tool.tagline}. ${description}`, 'document')
      const lit = toPgVectorLiteral(vec)
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ToolEmbedding" (id, "toolId", vector) VALUES ($1, $2, $3::vector)
         ON CONFLICT ("toolId") DO NOTHING`,
        embeddingIdFor(created.id),
        created.id,
        lit,
      )
    } catch (embedErr) {
      const msg = embedErr instanceof Error ? embedErr.message : String(embedErr)
      console.warn('[auto-library] embed failed for', tool.name, '—', msg)
    }

    return created.id
  } catch (e) {
    // Most likely cause: unique slug collision under a concurrent insert. Safe to ignore.
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[auto-library] persist failed for', tool.name, '—', msg)
    return null
  }
}

function embeddingIdFor(toolId: string): string {
  // ToolEmbedding.id is its own cuid; we generate one inline to avoid pulling in a cuid lib.
  return 'e_' + toolId.slice(-12) + '_' + Math.random().toString(36).slice(2, 10)
}

/** Persist many in parallel; never throws. */
export async function persistDiscoveredTools(tools: DiscoveredTool[]): Promise<void> {
  if (tools.length === 0) return
  await Promise.allSettled(tools.map((t) => persistDiscoveredTool(t)))
}
