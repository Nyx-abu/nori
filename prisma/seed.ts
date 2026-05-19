import { PrismaClient, PricingType } from '@prisma/client'
import { embed, toPgVectorLiteral } from '../lib/embeddings'

const prisma = new PrismaClient()

type CategorySeed = { slug: string; name: string; icon: string }
type ToolSeed = {
  slug: string
  name: string
  tagline: string
  description: string
  website: string
  pricing: PricingType
  isOpenSource?: boolean
  isPrivacyFocused?: boolean
  platforms: string[]
  trustScore: number
  category: string // slug
  tags: string[] // slugs
}

const categories: CategorySeed[] = [
  {
    slug: 'video',
    name: 'Video',
    icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  },
  {
    slug: 'coding',
    name: 'Coding',
    icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  },
  {
    slug: 'image',
    name: 'Image',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    slug: 'productivity',
    name: 'Productivity',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
  {
    slug: 'research',
    name: 'Research',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  },
  {
    slug: 'audio',
    name: 'Audio',
    icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
  },
  {
    slug: 'local-ai',
    name: 'Local AI',
    icon: 'M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7M9 21V9h6v12',
  },
]

const tags = [
  'creative',
  'realtime',
  'self-hosted',
  'collaboration',
  'enterprise',
  'developer',
  'editor',
  'cli',
  'ide',
  'voice',
  'transcription',
  'agent',
  'image-gen',
  'video-gen',
  'search',
  'notes',
  'rag',
  'open-source',
  'on-device',
]

const tools: ToolSeed[] = [
  {
    slug: 'runway',
    name: 'Runway',
    tagline: 'Generative video that feels cinematic',
    description:
      'Runway is a creative suite built around AI video generation, with text-to-video, image-to-video, and motion brush tooling used by professional editors and indie filmmakers. The Gen-3 family of models produces shots with realistic motion and physics, while the timeline-style editor folds prompts into a familiar post-production workflow.',
    website: 'https://runwayml.com',
    pricing: PricingType.FREEMIUM,
    platforms: ['web'],
    trustScore: 0.91,
    category: 'video',
    tags: ['creative', 'video-gen', 'editor'],
  },
  {
    slug: 'pika',
    name: 'Pika',
    tagline: 'Playful text-to-video for short-form creators',
    description:
      'Pika is a video generation app focused on quick, expressive clips for social and storytelling. It pairs a fast text-to-video model with effects like lip-sync, region edits, and inpaint, designed for creators who iterate on dozens of shots a day rather than long-form productions.',
    website: 'https://pika.art',
    pricing: PricingType.FREEMIUM,
    platforms: ['web'],
    trustScore: 0.84,
    category: 'video',
    tags: ['creative', 'video-gen'],
  },
  {
    slug: 'kling',
    name: 'Kling',
    tagline: 'High-fidelity AI video with strong motion coherence',
    description:
      'Kling is a video generation model known for stable, physically plausible motion across longer clips than most competitors. It supports image-to-video and reference images, making it useful for storyboarding, ad concepts, and stylized animation work.',
    website: 'https://klingai.com',
    pricing: PricingType.FREEMIUM,
    platforms: ['web'],
    trustScore: 0.82,
    category: 'video',
    tags: ['video-gen', 'creative'],
  },
  {
    slug: 'cursor',
    name: 'Cursor',
    tagline: 'The AI-native code editor built on VS Code',
    description:
      'Cursor is a forked VS Code experience where AI is woven into editing rather than bolted on. It combines a strong inline tab-completion model with an agentic chat that can plan, edit across files, run terminals, and use your codebase as context, aimed at engineers who want to stay in flow without leaving the editor.',
    website: 'https://cursor.com',
    pricing: PricingType.FREEMIUM,
    platforms: ['mac', 'windows', 'linux'],
    trustScore: 0.95,
    category: 'coding',
    tags: ['developer', 'ide', 'agent'],
  },
  {
    slug: 'copilot',
    name: 'GitHub Copilot',
    tagline: 'AI pair programmer inside your IDE',
    description:
      'GitHub Copilot offers inline code suggestions, chat, and command-line assistance powered by frontier models across VS Code, JetBrains, and Neovim. It is widely deployed in enterprises thanks to GitHub-grade access controls, audit logs, and policy-bound model routing.',
    website: 'https://github.com/features/copilot',
    pricing: PricingType.PAID,
    platforms: ['mac', 'windows', 'linux'],
    trustScore: 0.93,
    category: 'coding',
    tags: ['developer', 'ide', 'enterprise'],
  },
  {
    slug: 'aider',
    name: 'Aider',
    tagline: 'AI pair programming in your terminal',
    description:
      'Aider is a command-line tool that pairs a code-aware model with your git repo so you can describe changes and have them applied as commits. It works with multiple LLM providers, runs on your machine, and is loved by engineers who prefer a CLI workflow over an IDE-bound agent.',
    website: 'https://aider.chat',
    pricing: PricingType.OPEN_SOURCE,
    isOpenSource: true,
    platforms: ['mac', 'windows', 'linux'],
    trustScore: 0.88,
    category: 'coding',
    tags: ['developer', 'cli', 'open-source'],
  },
  {
    slug: 'midjourney',
    name: 'Midjourney',
    tagline: 'Distinctive aesthetic image generation',
    description:
      'Midjourney is an image generation service known for a unified, painterly aesthetic and strong prompt understanding. Originally Discord-only, it now ships a web app with mood boards, style references, and persistent characters, geared at designers and concept artists.',
    website: 'https://midjourney.com',
    pricing: PricingType.PAID,
    platforms: ['web'],
    trustScore: 0.92,
    category: 'image',
    tags: ['creative', 'image-gen'],
  },
  {
    slug: 'flux',
    name: 'Flux',
    tagline: 'Open-weight image model with sharp prompt fidelity',
    description:
      'Flux is the family of image generation models from Black Forest Labs, available both as a hosted API and as open weights for local inference. It excels at text rendering, human anatomy, and prompt adherence, and has become the de facto base model for fine-tuning communities.',
    website: 'https://blackforestlabs.ai',
    pricing: PricingType.FREEMIUM,
    isOpenSource: true,
    platforms: ['web', 'api', 'linux'],
    trustScore: 0.9,
    category: 'image',
    tags: ['image-gen', 'open-source', 'developer'],
  },
  {
    slug: 'ideogram',
    name: 'Ideogram',
    tagline: 'Image generation that actually renders text',
    description:
      'Ideogram is an image generation tool specialized in legible typography inside images, making it a favorite for posters, ad mockups, and logos. The app includes magic prompt, a community feed, and a remix-friendly canvas for iterating on poster-style compositions.',
    website: 'https://ideogram.ai',
    pricing: PricingType.FREEMIUM,
    platforms: ['web'],
    trustScore: 0.83,
    category: 'image',
    tags: ['image-gen', 'creative'],
  },
  {
    slug: 'notion-ai',
    name: 'Notion AI',
    tagline: 'Q&A and writing assistance across your workspace',
    description:
      'Notion AI brings retrieval-augmented Q&A, drafting, and summarization directly into the Notion documents, databases, and meetings teams already use. Because it grounds answers in your workspace, it works best as a knowledge layer for organizations that have standardized on Notion.',
    website: 'https://notion.so/product/ai',
    pricing: PricingType.PAID,
    platforms: ['web', 'mac', 'windows', 'ios', 'android'],
    trustScore: 0.86,
    category: 'productivity',
    tags: ['notes', 'rag', 'collaboration'],
  },
  {
    slug: 'mem',
    name: 'Mem',
    tagline: 'A self-organizing AI notebook',
    description:
      'Mem is a personal notes app that uses AI to auto-organize, link, and surface what you wrote weeks ago when it becomes relevant again. It is aimed at busy operators, founders, and analysts who capture quickly and want context retrieved without manually maintaining a tagging system.',
    website: 'https://mem.ai',
    pricing: PricingType.FREEMIUM,
    platforms: ['web', 'mac', 'ios'],
    trustScore: 0.78,
    category: 'productivity',
    tags: ['notes', 'rag'],
  },
  {
    slug: 'perplexity',
    name: 'Perplexity',
    tagline: 'Answer engine with citations',
    description:
      'Perplexity is a search-style AI that returns short, sourced answers with inline citations and follow-up question chips. It is widely used as a replacement for traditional web search when the user wants a written answer they can verify against the linked sources.',
    website: 'https://perplexity.ai',
    pricing: PricingType.FREEMIUM,
    platforms: ['web', 'ios', 'android', 'mac'],
    trustScore: 0.89,
    category: 'research',
    tags: ['search', 'rag'],
  },
  {
    slug: 'elicit',
    name: 'Elicit',
    tagline: 'AI research assistant for academic papers',
    description:
      'Elicit helps researchers triage and extract structured findings from large bodies of academic literature. It searches a corpus of millions of papers, pulls out methodology and outcomes into tables, and lets users compare studies side by side in ways traditional citation search cannot.',
    website: 'https://elicit.com',
    pricing: PricingType.FREEMIUM,
    platforms: ['web'],
    trustScore: 0.85,
    category: 'research',
    tags: ['search', 'rag'],
  },
  {
    slug: 'elevenlabs',
    name: 'ElevenLabs',
    tagline: 'Realistic AI voices and voice cloning',
    description:
      'ElevenLabs offers state-of-the-art text-to-speech, dubbing, and voice cloning used in audiobooks, games, and product narration. The platform exposes a polished web studio and a developer API, and supports voice design that lets creators sculpt a voice from descriptive prompts.',
    website: 'https://elevenlabs.io',
    pricing: PricingType.FREEMIUM,
    platforms: ['web', 'api'],
    trustScore: 0.92,
    category: 'audio',
    tags: ['voice', 'creative'],
  },
  {
    slug: 'adobe-podcast',
    name: 'Adobe Podcast',
    tagline: 'AI audio cleanup that sounds like a studio',
    description:
      'Adobe Podcast (Project Shasta) cleans up speech recordings to broadcast-quality audio using ML denoising and enhancement. It is widely used by podcasters and remote interviewers to salvage recordings made in untreated rooms or on consumer microphones.',
    website: 'https://podcast.adobe.com',
    pricing: PricingType.FREEMIUM,
    platforms: ['web'],
    trustScore: 0.84,
    category: 'audio',
    tags: ['voice', 'transcription'],
  },
  {
    slug: 'ollama',
    name: 'Ollama',
    tagline: 'Run open-source LLMs locally with one command',
    description:
      'Ollama makes it trivial to download and run open-weight language models on your own machine, exposing them through a clean local API that mirrors common SDK shapes. It is the default starting point for developers, privacy-conscious users, and anyone working offline with models like Llama and Qwen.',
    website: 'https://ollama.com',
    pricing: PricingType.OPEN_SOURCE,
    isOpenSource: true,
    isPrivacyFocused: true,
    platforms: ['mac', 'windows', 'linux'],
    trustScore: 0.93,
    category: 'local-ai',
    tags: ['self-hosted', 'open-source', 'on-device', 'developer'],
  },
  {
    slug: 'lm-studio',
    name: 'LM Studio',
    tagline: 'A desktop app for running and chatting with local LLMs',
    description:
      'LM Studio is a polished desktop application for discovering, downloading, and chatting with local language models, with built-in model server mode for development. It is popular with engineers who want a friendly UI on top of llama.cpp without giving up the privacy of fully local inference.',
    website: 'https://lmstudio.ai',
    pricing: PricingType.FREE,
    isPrivacyFocused: true,
    platforms: ['mac', 'windows', 'linux'],
    trustScore: 0.87,
    category: 'local-ai',
    tags: ['self-hosted', 'on-device', 'developer'],
  },
]

async function main() {
  console.log('▸ Enabling pgvector extension')
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;')

  console.log('▸ Resetting embedding/tag joins for idempotency')
  // safe order — joins/embeddings first so foreign keys don't block
  await prisma.toolEmbedding.deleteMany()
  // disconnect all tags via a no-op update pattern is unnecessary because the join table is owned by Prisma; deleting tools cascades the implicit join
  await prisma.aiTool.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.category.deleteMany()

  console.log('▸ Seeding categories')
  const categoryByslug = new Map<string, string>()
  for (const c of categories) {
    const row = await prisma.category.create({ data: c })
    categoryByslug.set(c.slug, row.id)
  }

  console.log('▸ Seeding tags')
  const tagByslug = new Map<string, string>()
  for (const slug of tags) {
    const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase())
    const row = await prisma.tag.create({ data: { slug, name } })
    tagByslug.set(slug, row.id)
  }

  console.log(`▸ Seeding ${tools.length} tools`)
  for (const t of tools) {
    const categoryId = categoryByslug.get(t.category)
    if (!categoryId) throw new Error(`unknown category ${t.category}`)
    const tagIds = t.tags
      .map((s) => tagByslug.get(s))
      .filter((x): x is string => Boolean(x))
      .map((id) => ({ id }))

    const tool = await prisma.aiTool.create({
      data: {
        slug: t.slug,
        name: t.name,
        tagline: t.tagline,
        description: t.description,
        website: t.website,
        pricing: t.pricing,
        isOpenSource: t.isOpenSource ?? false,
        isPrivacyFocused: t.isPrivacyFocused ?? false,
        platforms: t.platforms,
        trustScore: t.trustScore,
        categoryId,
        tags: { connect: tagIds },
      },
    })

    console.log(`  · ${t.name} — generating embedding`)
    const text = `${t.name}. ${t.tagline}. ${t.description}`
    const vec = await embed(text, 'document')
    const lit = toPgVectorLiteral(vec)

    // ensure table column type is vector(768); CREATE if Prisma's Unsupported migration was skipped
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ToolEmbedding" (id, "toolId", vector) VALUES ($1, $2, $3::vector)`,
      cuid(),
      tool.id,
      lit,
    )
  }

  console.log('▸ Creating IVF index for cosine search')
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS tool_embedding_vector_idx ON "ToolEmbedding" USING ivfflat (vector vector_cosine_ops) WITH (lists = 10);`,
  )

  console.log('✓ Seed complete')
}

// tiny inline cuid — avoids dragging in an extra dep just for seed-side ids
function cuid(): string {
  return (
    'c' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
