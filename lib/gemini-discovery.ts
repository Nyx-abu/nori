// P4 decision: Gemini discovery is a *best-effort* augmentation. Every failure path (parse, validation, network) returns []. The route uses Promise.allSettled, so a Gemini outage never fails the DB-search half.
// Fix-pass: errors now log (was silent). Prompt asks Gemini to choose a categorySlug from the live category list so auto-persist can place the tool correctly.
// Multi-tag pass: prompt now also receives the existing Tag list and asks for tagSlugs (chosen from existing) + newTagSlugs (suggested new). Categories stay 1:1 for routing; multi-functional classification is expressed via tags.
import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from './db'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

export type DiscoveredTool = {
  name: string
  tagline: string
  website: string
  pricing: 'FREE' | 'FREEMIUM' | 'PAID' | 'OPEN_SOURCE'
  isPrivacyFocused: boolean
  isOpenSource: boolean
  platforms: string[]
  whyRelevant: string
  /** Slug of one of the existing categories, chosen by Gemini. May be null if it couldn't pick. */
  categorySlug: string | null
  /** Existing tag slugs Gemini judged to apply. Always validated against the live Tag table. */
  tagSlugs: string[]
  /** Slugified new tag suggestions Gemini wants to introduce — auto-created on persist. */
  newTagSlugs: string[]
  source: 'gemini'
}

const PRICING_VALUES = ['FREE', 'FREEMIUM', 'PAID', 'OPEN_SOURCE'] as const

type CategoryRef = { slug: string; name: string }
type TagRef = { slug: string; name: string }

async function getCategoryRefs(): Promise<CategoryRef[]> {
  try {
    return await prisma.category.findMany({
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    })
  } catch {
    return []
  }
}

async function getTagRefs(): Promise<TagRef[]> {
  try {
    return await prisma.tag.findMany({
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    })
  } catch {
    return []
  }
}

// Mirrors slugify() in auto-library.ts. Kept inline to avoid an import cycle —
// gemini-discovery is imported by auto-library, not the other way around.
function slugifyTag(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export async function discoverToolsWithGemini(
  query: string,
  existingToolNames: string[],
): Promise<DiscoveredTool[]> {
  if (!process.env.GEMINI_API_KEY) return []

  // Model picks reflect what's available on the current key — 2.0-flash hits free_tier=0, 1.5-flash is 404'd. flash-latest currently routes to a working model.
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' })
  const excludeList = existingToolNames.slice(0, 10).join(', ')

  const [categories, tags] = await Promise.all([getCategoryRefs(), getTagRefs()])
  const categoryList = categories.length
    ? categories.map((c) => `"${c.slug}" (${c.name})`).join(', ')
    : 'none — leave categorySlug null'

  // Cap to keep the prompt tight; with ~200 tags this still fits comfortably under 2k tokens.
  const tagList = tags.length
    ? tags.slice(0, 200).map((t) => `"${t.slug}"`).join(', ')
    : 'none yet'

  const prompt = `You are an AI tool discovery engine. A user is searching for: ${JSON.stringify(query)}

Return a JSON array of up to 5 real, currently available AI tools that best match this query.

Rules:
- Only include REAL tools that actually exist as of your knowledge cutoff
- Do NOT include these tools (already shown): ${excludeList || 'none'}
- Do NOT invent tools — if fewer than 5 real ones exist, return fewer
- If the query is nonsensical or no relevant AI tools exist, return an empty array []
- Prioritize specificity — match the user's actual intent precisely
- For pricing: use exactly one of: FREE, FREEMIUM, PAID, OPEN_SOURCE
- For categorySlug: pick ONE that fits best from this list — ${categoryList}. If none fit, use null.
- For tagSlugs: pick UP TO 5 from this existing tag list that describe the tool's capabilities — ${tagList}. Use only slugs from the list. Empty array if none fit.
- For newTagSlugs: if the tool needs a tag that doesn't exist in the list, suggest UP TO 3 new ones in kebab-case (lowercase, hyphens, no spaces). Each new slug describes a single functional capability the tool offers (e.g. "speech-to-text", "code-review", "voice-clone"). Empty array if existing tags already cover it.
- A tool can wear many tags — assign tags for every distinct capability so the tool surfaces in multiple browse contexts. Prefer reusing existing tags over inventing new ones.

Return ONLY valid JSON. No markdown, no explanation, no backticks.

JSON schema per item:
{
  "name": "string",
  "tagline": "string — one sentence, max 80 chars",
  "website": "string — full URL with https://",
  "pricing": "FREE | FREEMIUM | PAID | OPEN_SOURCE",
  "isPrivacyFocused": boolean,
  "isOpenSource": boolean,
  "platforms": ["web" | "mac" | "windows" | "linux" | "ios" | "android" | "api"],
  "whyRelevant": "string — one sentence explaining why this matches the query",
  "categorySlug": "string | null",
  "tagSlugs": ["string", ...],
  "newTagSlugs": ["string", ...]
}`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const clean = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    const parsed: unknown = JSON.parse(clean)
    if (!Array.isArray(parsed)) return []

    const validCategorySlugs = new Set(categories.map((c) => c.slug))
    const validTagSlugs = new Set(tags.map((t) => t.slug))

    const out: DiscoveredTool[] = []
    for (const raw of parsed) {
      if (typeof raw !== 'object' || raw === null) continue
      const item = raw as Record<string, unknown>
      if (typeof item.name !== 'string') continue
      if (typeof item.tagline !== 'string') continue
      if (typeof item.website !== 'string' || !item.website.startsWith('https://')) continue
      if (typeof item.pricing !== 'string' || !PRICING_VALUES.includes(item.pricing as typeof PRICING_VALUES[number])) continue
      if (!Array.isArray(item.platforms)) continue

      const rawSlug =
        typeof item.categorySlug === 'string' && item.categorySlug.length > 0
          ? item.categorySlug
          : null
      const categorySlug = rawSlug && validCategorySlugs.has(rawSlug) ? rawSlug : null

      // Existing-tag filter: drop anything Gemini hallucinated.
      const tagSlugs = Array.isArray(item.tagSlugs)
        ? item.tagSlugs
            .filter((s): s is string => typeof s === 'string')
            .map((s) => s.toLowerCase().trim())
            .filter((s) => validTagSlugs.has(s))
            .slice(0, 5)
        : []

      // New-tag suggestions: re-slugify to a safe shape and drop collisions with existing tags.
      const newTagSlugs = Array.isArray(item.newTagSlugs)
        ? item.newTagSlugs
            .filter((s): s is string => typeof s === 'string')
            .map(slugifyTag)
            .filter((s) => s.length > 0 && !validTagSlugs.has(s))
            .filter((s, i, arr) => arr.indexOf(s) === i)
            .slice(0, 3)
        : []

      out.push({
        name: item.name.slice(0, 100),
        tagline: item.tagline.slice(0, 120),
        website: item.website.slice(0, 300),
        pricing: item.pricing as DiscoveredTool['pricing'],
        isPrivacyFocused: Boolean(item.isPrivacyFocused),
        isOpenSource: Boolean(item.isOpenSource),
        platforms: item.platforms.filter((p): p is string => typeof p === 'string').slice(0, 8),
        whyRelevant: typeof item.whyRelevant === 'string' ? item.whyRelevant.slice(0, 200) : '',
        categorySlug,
        tagSlugs,
        newTagSlugs,
        source: 'gemini' as const,
      })
      if (out.length >= 5) break
    }
    return out
  } catch (e) {
    // Surface the error so quota/model issues are visible in dev. Production still gets [] returned.
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[gemini-discovery] returning empty result:', msg)
    return []
  }
}
