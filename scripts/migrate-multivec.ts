// One-shot migration from the old single-blob `vector(768)` to the new per-field `halfvec(3072)` triple.
// Preserves AiTool rows (so auto-discovered tools survive) by re-embedding in place instead of nuking the DB.
//
// Run:  npx tsx --env-file=.env scripts/migrate-multivec.ts
// Then: npx prisma db push  (verify schema is aligned; should be a no-op)
import { PrismaClient } from '@prisma/client'
import { embedToolFields, toPgVectorLiteral } from '../lib/embeddings'

const prisma = new PrismaClient()

function cuid(): string {
  return (
    'c' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  )
}

async function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

async function main() {
  console.log('▸ Enabling pgvector')
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;')

  console.log('▸ Migrating ToolEmbedding schema in place')
  // Drop the old single-vector column; add three nullable halfvec columns. We re-embed into them, then
  // set NOT NULL at the end. This preserves the table's relationship to AiTool while changing the shape.
  await prisma.$executeRawUnsafe(`ALTER TABLE "ToolEmbedding" DROP COLUMN IF EXISTS "vector";`)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ToolEmbedding" ADD COLUMN IF NOT EXISTS "nameVec" halfvec(3072);`,
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ToolEmbedding" ADD COLUMN IF NOT EXISTS "taglineVec" halfvec(3072);`,
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ToolEmbedding" ADD COLUMN IF NOT EXISTS "descriptionVec" halfvec(3072);`,
  )

  console.log('▸ Adding tsvector + GIN')
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "AiTool" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(tagline, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'C')
      ) STORED;
  `)
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AiTool_searchVector_idx" ON "AiTool" USING GIN ("searchVector");`,
  )

  // Find AiTool rows missing populated embeddings (covers both: rows that lost their embedding when
  // we dropped `vector`, and rows that never had a ToolEmbedding entry).
  const needsEmbedding = await prisma.$queryRawUnsafe<
    { id: string; name: string; tagline: string; description: string; embId: string | null }[]
  >(`
    SELECT a.id, a.name, a.tagline, a.description, te.id AS "embId"
    FROM "AiTool" a
    LEFT JOIN "ToolEmbedding" te ON te."toolId" = a.id
    WHERE te.id IS NULL OR te."nameVec" IS NULL
  `)

  console.log(`▸ Re-embedding ${needsEmbedding.length} tools`)

  let ok = 0
  let failed = 0
  for (let i = 0; i < needsEmbedding.length; i++) {
    const t = needsEmbedding[i]
    if (!t) continue
    try {
      const vecs = await embedToolFields(t.name, t.tagline, t.description, 'document')
      if (t.embId) {
        await prisma.$executeRawUnsafe(
          `UPDATE "ToolEmbedding"
             SET "nameVec" = $1::halfvec,
                 "taglineVec" = $2::halfvec,
                 "descriptionVec" = $3::halfvec
           WHERE id = $4`,
          toPgVectorLiteral(vecs.name),
          toPgVectorLiteral(vecs.tagline),
          toPgVectorLiteral(vecs.description),
          t.embId,
        )
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "ToolEmbedding" (id, "toolId", "nameVec", "taglineVec", "descriptionVec")
           VALUES ($1, $2, $3::halfvec, $4::halfvec, $5::halfvec)
           ON CONFLICT ("toolId") DO UPDATE
             SET "nameVec" = EXCLUDED."nameVec",
                 "taglineVec" = EXCLUDED."taglineVec",
                 "descriptionVec" = EXCLUDED."descriptionVec"`,
          cuid(),
          t.id,
          toPgVectorLiteral(vecs.name),
          toPgVectorLiteral(vecs.tagline),
          toPgVectorLiteral(vecs.description),
        )
      }
      ok++
      console.log(`  ✓ (${i + 1}/${needsEmbedding.length}) ${t.name}`)
    } catch (e) {
      failed++
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`  ✗ (${i + 1}/${needsEmbedding.length}) ${t.name}: ${msg}`)
    }
    // Gemini free tier = 100 RPM; we burn 3 calls per tool. 2s/tool keeps us at ~90 RPM with margin.
    // Combined with the 429 backoff inside embed() itself, the migration glides through quotas.
    await sleep(2000)
  }

  if (failed === 0) {
    console.log('▸ Enforcing NOT NULL on halfvec columns')
    await prisma.$executeRawUnsafe(`ALTER TABLE "ToolEmbedding" ALTER COLUMN "nameVec" SET NOT NULL;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "ToolEmbedding" ALTER COLUMN "taglineVec" SET NOT NULL;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "ToolEmbedding" ALTER COLUMN "descriptionVec" SET NOT NULL;`)
  } else {
    console.warn(
      `▸ Skipping NOT NULL enforcement — ${failed} embedding(s) failed and would block the constraint.`,
    )
  }

  console.log('▸ Creating HNSW indexes + dropping old IVF index')
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS tool_embedding_vector_idx;`)
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS tool_embedding_name_hnsw_idx
       ON "ToolEmbedding" USING hnsw ("nameVec" halfvec_cosine_ops);`,
  )
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS tool_embedding_tagline_hnsw_idx
       ON "ToolEmbedding" USING hnsw ("taglineVec" halfvec_cosine_ops);`,
  )
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS tool_embedding_description_hnsw_idx
       ON "ToolEmbedding" USING hnsw ("descriptionVec" halfvec_cosine_ops);`,
  )

  console.log(`✓ Migration complete — ${ok} re-embedded, ${failed} failed`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
