/**
 * Ask Elijah — Restore Pinecone from Supabase Storage
 *
 * Downloads the latest backup from Supabase and re-upserts
 * all vectors back into Pinecone.
 *
 * Usage:
 *   node scripts/restore-pinecone.mjs              — restores latest.json
 *   node scripts/restore-pinecone.mjs backup-2026-04-14.json  — specific backup
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

const PINECONE_HOST = process.env.PINECONE_HOST
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const BUCKET = 'pinecone-backups'
const UPSERT_BATCH = 50

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

const filename = process.argv[2] || 'latest.json'

console.log(`\n🔄 Ask Elijah — Pinecone Restore\n`)
console.log(`  Restoring from: ${filename}\n`)

// Download backup from Supabase
console.log('  Downloading backup from Supabase Storage...')
const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`, {
  headers: {
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    apikey: SUPABASE_SERVICE_KEY,
  },
})
if (!res.ok) throw new Error(`Could not download backup: ${res.status}: ${await res.text()}`)

const backup = await res.json()
console.log(`  Backup date: ${backup.created_at}`)
console.log(`  Total vectors: ${backup.total_vectors}\n`)

const vectors = backup.vectors || []
const totalBatches = Math.ceil(vectors.length / UPSERT_BATCH)
let upserted = 0, errors = 0

for (let i = 0; i < vectors.length; i += UPSERT_BATCH) {
  const batch = vectors.slice(i, i + UPSERT_BATCH)
  const batchNum = Math.floor(i / UPSERT_BATCH) + 1
  process.stdout.write(`  Upserting batch ${batchNum}/${totalBatches}... `)

  try {
    const upsertRes = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
      method: 'POST',
      headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ vectors: batch }),
    })
    if (!upsertRes.ok) throw new Error(`${upsertRes.status}: ${await upsertRes.text()}`)
    upserted += batch.length
    process.stdout.write(`✅\n`)
  } catch (err) {
    process.stdout.write(`❌ ${err.message}\n`)
    errors++
  }

  await sleep(300)
}

console.log(`\n  ✅ Restored: ${upserted} vectors`)
if (errors > 0) console.log(`  ⚠️  Failed batches: ${errors}`)
console.log('\n✅ Done.\n')
