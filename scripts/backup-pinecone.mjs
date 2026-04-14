/**
 * Ask Elijah — Pinecone Backup to Supabase Storage
 *
 * Exports all vectors from Pinecone and uploads the JSON backup
 * to Supabase Storage bucket 'pinecone-backups'.
 *
 * Run this after any major re-ingest:
 *   node scripts/backup-pinecone.mjs
 *
 * To restore: node scripts/restore-pinecone.mjs
 */

import { config } from 'dotenv'
config({ path: '.env.local', override: true })

const PINECONE_HOST = process.env.PINECONE_HOST
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const BUCKET = 'pinecone-backups'
const BATCH_SIZE = 100

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Pinecone: get total vector count ───────────────────────────────────────

async function getIndexStats() {
  const res = await fetch(`${PINECONE_HOST}/describe_index_stats`, {
    method: 'POST',
    headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`Stats failed: ${res.status}`)
  return await res.json()
}

// ── Pinecone: list all vector IDs via pagination ───────────────────────────

async function listAllIds() {
  const ids = []
  let paginationToken = undefined

  while (true) {
    const url = new URL(`${PINECONE_HOST}/vectors/list`)
    url.searchParams.set('limit', '100')
    if (paginationToken) url.searchParams.set('paginationToken', paginationToken)

    const res = await fetch(url.toString(), {
      headers: { 'Api-Key': PINECONE_API_KEY },
    })
    if (!res.ok) throw new Error(`List failed: ${res.status}: ${await res.text()}`)
    const data = await res.json()

    const batch = (data.vectors || []).map(v => v.id)
    ids.push(...batch)

    if (!data.pagination?.next) break
    paginationToken = data.pagination.next
    await sleep(200)
  }

  return ids
}

// ── Pinecone: fetch vectors by IDs ─────────────────────────────────────────

async function fetchVectors(ids) {
  const res = await fetch(`${PINECONE_HOST}/vectors/fetch?ids=${ids.map(encodeURIComponent).join('&ids=')}`, {
    headers: { 'Api-Key': PINECONE_API_KEY },
  })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  const data = await res.json()
  return Object.values(data.vectors || {})
}

// ── Supabase Storage: ensure bucket exists ─────────────────────────────────

async function ensureBucket() {
  // Check if bucket exists
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, {
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY },
  })

  if (res.status === 400 || res.status === 404) {
    // Create bucket
    const create = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
    })
    if (!create.ok && create.status !== 409) {
      throw new Error(`Could not create bucket: ${await create.text()}`)
    }
  }
}

// ── Supabase Storage: upload file ──────────────────────────────────────────

async function uploadToSupabase(filename, content) {
  const body = Buffer.from(JSON.stringify(content))
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      apikey: SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    },
    body,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}: ${await res.text()}`)
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log('\n🔒 Ask Elijah — Pinecone Backup\n')

// Get stats
const stats = await getIndexStats()
const totalVectors = stats.totalVectorCount || stats.total_vector_count || 0
console.log(`  Total vectors in Pinecone: ${totalVectors}`)

// Ensure Supabase bucket exists
console.log(`  Ensuring Supabase bucket '${BUCKET}' exists...`)
await ensureBucket()

// List all IDs
console.log(`  Listing all vector IDs...`)
const allIds = await listAllIds()
console.log(`  Found ${allIds.length} IDs\n`)

// Fetch in batches
const allVectors = []
const totalBatches = Math.ceil(allIds.length / BATCH_SIZE)

for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
  const batch = allIds.slice(i, i + BATCH_SIZE)
  const batchNum = Math.floor(i / BATCH_SIZE) + 1
  process.stdout.write(`  Fetching batch ${batchNum}/${totalBatches}... `)
  try {
    const vectors = await fetchVectors(batch)
    allVectors.push(...vectors)
    process.stdout.write(`${vectors.length} vectors\n`)
  } catch (err) {
    process.stdout.write(`❌ ${err.message}\n`)
  }
  await sleep(300)
}

// Upload to Supabase Storage
const date = new Date().toISOString().split('T')[0]
const filename = `backup-${date}.json`
const backup = {
  created_at: new Date().toISOString(),
  total_vectors: allVectors.length,
  vectors: allVectors,
}

console.log(`\n  Uploading ${allVectors.length} vectors to Supabase Storage as '${filename}'...`)
await uploadToSupabase(filename, backup)

// Also overwrite 'latest.json' so restore always has a single known filename
await uploadToSupabase('latest.json', backup)

console.log(`  ✅ Backup complete: ${filename}`)
console.log(`  ✅ Also saved as: latest.json`)
console.log(`\n  To restore: node scripts/restore-pinecone.mjs\n`)
