/**
 * Backfill kb_sources rows for Craig Manning videos already in Pinecone.
 *
 * The main ingestion script wrote vectors successfully but the kb_sources
 * insert warned because the table didn't exist in Supabase yet. Once the
 * add-kb-sources.sql migration has been applied, run this script once to
 * populate the admin inventory from the Pinecone vectors.
 *
 * Idempotent — uses upsert on id_prefix.
 *
 * Usage: node scripts/backfill-craig-manning-sources.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local', override: true })

const {
  PINECONE_HOST,
  PINECONE_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env

for (const [name, value] of Object.entries({
  PINECONE_HOST,
  PINECONE_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
})) {
  if (!value) {
    console.error(`❌ Missing env var: ${name}`)
    process.exit(1)
  }
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Verify table exists before doing any work
async function verifyTable() {
  const { error } = await supabase.from('kb_sources').select('id').limit(1)
  if (error && error.message.includes("Could not find the table")) {
    console.error(
      "\n❌ kb_sources table doesn't exist yet.\n" +
      "\n   Run this SQL in your Supabase dashboard → SQL editor first:\n" +
      "   (File: supabase/migrations/add-kb-sources.sql)\n"
    )
    process.exit(1)
  }
  if (error) {
    console.error('❌ Supabase check failed:', error.message)
    process.exit(1)
  }
}

// Walk every Pinecone vector id, keep only craigmanning_* prefixes, group by video.
async function listCraigPrefixes() {
  const prefixes = new Map() // prefix -> {count, sampleId}
  let paginationToken

  do {
    const url = new URL(`${PINECONE_HOST}/vectors/list`)
    url.searchParams.set('prefix', 'craigmanning_')
    url.searchParams.set('limit', '100')
    if (paginationToken) url.searchParams.set('paginationToken', paginationToken)

    const res = await fetch(url.toString(), { headers: { 'Api-Key': PINECONE_API_KEY } })
    if (!res.ok) throw new Error(`Pinecone list failed: ${res.status} ${await res.text()}`)
    const data = await res.json()

    for (const v of data.vectors || []) {
      // id format: craigmanning_<videoId>_<chunkIdx>
      const m = v.id.match(/^(craigmanning_[A-Za-z0-9_-]+?)_(\d+)$/)
      if (!m) continue
      const prefix = m[1]
      const existing = prefixes.get(prefix)
      if (existing) existing.count += 1
      else prefixes.set(prefix, { count: 1, sampleId: v.id })
    }

    paginationToken = data.pagination?.next
  } while (paginationToken)

  return prefixes
}

// Fetch metadata for one sample vector per prefix so we can recover title + url.
async function fetchMetadata(sampleIds) {
  const metaByPrefix = new Map()
  const BATCH = 100
  for (let i = 0; i < sampleIds.length; i += BATCH) {
    const chunk = sampleIds.slice(i, i + BATCH)
    const params = chunk.map((id) => `ids=${encodeURIComponent(id)}`).join('&')
    const res = await fetch(`${PINECONE_HOST}/vectors/fetch?${params}`, {
      headers: { 'Api-Key': PINECONE_API_KEY },
    })
    if (!res.ok) throw new Error(`Pinecone fetch failed: ${res.status}`)
    const data = await res.json()
    for (const [id, vec] of Object.entries(data.vectors || {})) {
      const m = id.match(/^(craigmanning_[A-Za-z0-9_-]+?)_(\d+)$/)
      if (m) metaByPrefix.set(m[1], vec.metadata || {})
    }
  }
  return metaByPrefix
}

async function main() {
  console.log('\n📦 Backfilling kb_sources for Craig Manning videos\n')

  await verifyTable()

  console.log('  Scanning Pinecone for craigmanning_* vectors...')
  const prefixes = await listCraigPrefixes()
  console.log(`  Found ${prefixes.size} unique video prefixes`)

  if (prefixes.size === 0) {
    console.log('\n  Nothing to backfill. Did you run ingest-craig-manning.mjs first?\n')
    return
  }

  console.log('  Fetching metadata for each video...')
  const sampleIds = Array.from(prefixes.values()).map((v) => v.sampleId)
  const metadata = await fetchMetadata(sampleIds)

  let inserted = 0, updated = 0, skipped = 0
  for (const [prefix, info] of prefixes) {
    const meta = metadata.get(prefix) || {}
    const title = meta.source_title || prefix
    const url = meta.source_url || null
    const topic = meta.topic || 'mental-game'

    // Check if already exists
    const { data: existing } = await supabase
      .from('kb_sources')
      .select('id')
      .eq('id_prefix', prefix)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('kb_sources')
        .update({
          source_title: title,
          source_url: url,
          chunk_count: info.count,
          topic,
        })
        .eq('id', existing.id)
      if (error) { skipped++; console.log(`  ⚠️  ${prefix}: ${error.message}`) }
      else { updated++; console.log(`  🔄 updated: ${title.slice(0, 50)}`) }
    } else {
      const { error } = await supabase.from('kb_sources').insert({
        source_title: title,
        source_type: 'youtube',
        source_url: url,
        topic,
        level: null,
        chunk_count: info.count,
        id_prefix: prefix,
      })
      if (error) { skipped++; console.log(`  ⚠️  ${prefix}: ${error.message}`) }
      else { inserted++; console.log(`  ✅ inserted: ${title.slice(0, 50)}`) }
    }
  }

  console.log(`\n✅ Done. ${inserted} inserted, ${updated} updated, ${skipped} skipped.\n`)
}

main().catch((err) => {
  console.error('\n❌ Fatal:', err)
  process.exit(1)
})
