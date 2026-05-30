// Fix-pass decision: auto-persist discovered Gemini tools so they show up via library search next time even when Gemini is rate-limited. Designed to be fire-and-forget — every failure path is swallowed and logged. Embeddings are generated last so a Gemini-embed outage still leaves the tool in the library (it just won't be vector-searchable until re-seeded).
import { prisma } from './db'
import { PricingType } from '@prisma/client'
import { embedToolFields, toPgVectorLiteral } from './embeddings'
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

    // Resolve tags: existing slugs are connected as-is, new slugs are upserted on the fly.
    // Doing this before the tool create keeps the connect-by-id list simple, and concurrent
    // discoveries with overlapping new tags converge thanks to the unique slug constraint.
    const tagIds = await resolveTagIds(tool.tagSlugs, tool.newTagSlugs)

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
        ...(tagIds.length ? { tags: { connect: tagIds.map((id) => ({ id })) } } : {}),
      },
      select: { id: true },
    })

    // Per-field embeddings so the tool shows up in semantic search via any of name/tagline/description ranks.
    // Best-effort: if Gemini-embed is rate-limited the tool is still in the library and surfaces via the
    // tsvector lexical leg of RRF.
    try {
      const vecs = await embedToolFields(tool.name, tool.tagline, description, 'document')
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ToolEmbedding" (id, "toolId", "nameVec", "taglineVec", "descriptionVec")
         VALUES ($1, $2, $3::halfvec, $4::halfvec, $5::halfvec)
         ON CONFLICT ("toolId") DO NOTHING`,
        embeddingIdFor(created.id),
        created.id,
        toPgVectorLiteral(vecs.name),
        toPgVectorLiteral(vecs.tagline),
        toPgVectorLiteral(vecs.description),
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

/**
 * Look up existing tag ids by slug, and upsert any new slugs Gemini suggested.
 * Returns the union of tag ids ready to be connect()'ed on AiTool.
 *
 * Failure modes are swallowed: a tag that can't be created (race, db error) just
 * doesn't end up on the tool. The tool still persists.
 */
async function resolveTagIds(
  existingSlugs: string[],
  newSlugs: string[],
): Promise<string[]> {
  const slugsToFind = existingSlugs.filter((s) => typeof s === 'string' && s.length > 0)
  const found = slugsToFind.length
    ? await prisma.tag.findMany({
        where: { slug: { in: slugsToFind } },
        select: { id: true, slug: true },
      })
    : []
  const ids = new Set(found.map((t) => t.id))

  for (const slug of newSlugs) {
    if (!slug) continue
    const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase())
    try {
      // Prisma's `upsert` is not atomic in Postgres — it does a SELECT then INSERT, which
      // races with sibling persistDiscoveredTool calls firing the same new tag concurrently.
      // We catch the P2002 (unique constraint) and re-fetch the row that the other tx wrote.
      const row = await prisma.tag.upsert({
        where: { slug },
        create: { slug, name },
        update: {},
        select: { id: true },
      })
      ids.add(row.id)
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code === 'P2002') {
        const existing = await prisma.tag.findUnique({ where: { slug }, select: { id: true } })
        if (existing) {
          ids.add(existing.id)
          continue
        }
      }
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[auto-library] tag upsert failed for', slug, '—', msg)
    }
  }
  return Array.from(ids)
}
