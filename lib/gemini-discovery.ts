// P4 decision: Gemini discovery is a *best-effort* augmentation. Every failure path (parse, validation, network) returns []. The route uses Promise.allSettled, so a Gemini outage never fails the DB-search half.
// Fix-pass: errors now log (was silent). Prompt asks Gemini to choose a categorySlug from the live category list so auto-persist can place the tool correctly.
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
  source: 'gemini'
}

const PRICING_VALUES = ['FREE', 'FREEMIUM', 'PAID', 'OPEN_SOURCE'] as const

type CategoryRef = { slug: string; name: string }

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

export async function discoverToolsWithGemini(
  query: string,
  existingToolNames: string[],
): Promise<DiscoveredTool[]> {
  if (!process.env.GEMINI_API_KEY) return []

  // Model picks reflect what's available on the current key — 2.0-flash hits free_tier=0, 1.5-flash is 404'd. flash-latest currently routes to a working model.
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' })
  const excludeList = existingToolNames.slice(0, 10).join(', ')

  const categories = await getCategoryRefs()
  const categoryList = categories.length
    ? categories.map((c) => `"${c.slug}" (${c.name})`).join(', ')
    : 'none — leave categorySlug null'

  const prompt = `You are an AI tool discovery engine. A user is searching for: "${query}"

Return a JSON array of up to 5 real, currently available AI tools that best match this query.

Rules:
- Only include REAL tools that actually exist as of your knowledge cutoff
- Do NOT include these tools (already shown): ${excludeList || 'none'}
- Do NOT invent tools — if fewer than 5 real ones exist, return fewer
- If the query is nonsensical or no relevant AI tools exist, return an empty array []
- Prioritize specificity — match the user's actual intent precisely
- For pricing: use exactly one of: FREE, FREEMIUM, PAID, OPEN_SOURCE
- For categorySlug: pick ONE that fits best from this list — ${categoryList}. If none fit, use null.

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
  "categorySlug": "string | null"
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

    const validSlugs = new Set(categories.map((c) => c.slug))
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
      const categorySlug = rawSlug && validSlugs.has(rawSlug) ? rawSlug : null

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
