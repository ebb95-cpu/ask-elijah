/**
 * Ask Elijah — Newsletter Ingestion into Pinecone
 * Ingests all 87 Beehiiv newsletters
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

const PINECONE_HOST = process.env.PINECONE_HOST
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY
const BEEHIIV_PUB_ID = 'pub_9471ed24-57d1-43c6-be5b-ee779941c348'

const MIN_CHARS = 200

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function stripHtml(html = '') {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function chunkText(text, size = 500, overlap = 80) {
  const words = text.split(/\s+/)
  const chunks = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + size).join(' ')
    if (chunk.length > 100) chunks.push(chunk)
    i += size - overlap
  }
  return chunks
}

async function embed(text) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [text], model: 'voyage-3-lite' }),
  })
  if (!res.ok) throw new Error(`Voyage ${res.status}`)
  const data = await res.json()
  return data.data[0].embedding
}

async function upsert(vectors) {
  const res = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors }),
  })
  if (!res.ok) throw new Error(`Pinecone ${res.status}: ${await res.text()}`)
}

async function fetchAllIssues() {
  let page = 1
  let all = []
  while (true) {
    const url = `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/posts?status=confirmed&expand[]=free_web_content&limit=50&page=${page}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}` }
    })
    if (!res.ok) { console.log(`Beehiiv error: ${res.status}`); break }
    const data = await res.json()
    const issues = data.data || []
    if (issues.length === 0) break
    all = all.concat(issues)
    console.log(`  Fetched page ${page}: ${issues.length} issues`)
    if (!data.next_page) break
    page++
    await sleep(500)
  }
  return all
}

console.log('\n🚀 Ask Elijah — Newsletter Ingestion\n')

const issues = await fetchAllIssues()
console.log(`\nFound ${issues.length} total issues\n`)

let ok = 0, skipped = 0, errors = 0

for (let i = 0; i < issues.length; i++) {
  const issue = issues[i]
  const title = issue.title || `Issue ${i + 1}`
  const label = title.slice(0, 52).padEnd(54, '.')
  const url = issue.web_url || ''

  // Get text content
  const rawHtml =
    issue.free_web_content ||
    issue.content?.free?.web ||
    ''

  const text = stripHtml(rawHtml)

  if (text.length < MIN_CHARS) {
    console.log(`[${i + 1}/${issues.length}] ${label} ⏭️  too short (${text.length} chars)`)
    skipped++
    continue
  }

  const chunks = chunkText(text)
  const vectors = []

  for (let j = 0; j < chunks.length; j++) {
    try {
      const values = await embed(chunks[j])
      vectors.push({
        id: `nl_${issue.id}_${j}`,
        values,
        metadata: {
          text: chunks[j],
          source_type: 'newsletter',
          source_title: title,
          source_url: url,
          chunk_index: j,
        },
      })
      await sleep(100)
    } catch (e) {
      // skip chunk
    }
  }

  if (vectors.length === 0) {
    console.log(`[${i + 1}/${issues.length}] ${label} ❌ embed failed`)
    errors++
    continue
  }

  try {
    for (let j = 0; j < vectors.length; j += 50) {
      await upsert(vectors.slice(j, j + 50))
    }
    console.log(`[${i + 1}/${issues.length}] ${label} ✅ ${vectors.length} chunks`)
    ok++
  } catch (e) {
    console.log(`[${i + 1}/${issues.length}] ${label} ❌ ${e.message}`)
    errors++
  }

  await sleep(200)
}

console.log(`\n✅ Done.`)
console.log(`   Ingested: ${ok} newsletters`)
console.log(`   Skipped:  ${skipped}`)
console.log(`   Errors:   ${errors}\n`)
