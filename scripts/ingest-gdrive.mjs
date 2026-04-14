/**
 * Ask Elijah — Google Drive Lead Magnet Ingestion
 *
 * Scans the lead magnets Google Drive folder, downloads all PDFs,
 * extracts text, and ingests into Pinecone as source_type: 'lead_magnet'.
 *
 * Folder: https://drive.google.com/drive/folders/1yWan7qgBSyAU19nundmdo9Bog9SJwEFs
 * Subfolders: Mental, Nutrition, Workouts, Overseas Hooper
 *
 * Setup:
 *   1. Go to console.cloud.google.com
 *   2. Create a project → Enable Google Drive API
 *   3. Create a Service Account → Download JSON key
 *   4. Save key as scripts/gdrive-key.json
 *   5. Share the Google Drive folder with the service account email
 *   6. Add GDRIVE_KEY_FILE=scripts/gdrive-key.json to .env.local
 *
 * Usage:
 *   node scripts/ingest-gdrive.mjs
 */

import { config } from 'dotenv'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')
config({ path: '.env.local', override: true })

const __dirname = dirname(fileURLToPath(import.meta.url))

const PINECONE_HOST = process.env.PINECONE_HOST
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const GDRIVE_KEY_FILE = process.env.GDRIVE_KEY_FILE || join(__dirname, 'gdrive-key.json')

const ROOT_FOLDER_ID = '1yWan7qgBSyAU19nundmdo9Bog9SJwEFs'
const CHUNK_SIZE = 500  // words per chunk
const CHUNK_OVERLAP = 80
const MIN_CHARS = 200

// Beehiiv product URLs for known lead magnets (add more as needed)
// Key: partial PDF title match (lowercase), Value: Beehiiv download URL
const BEEHIIV_URLS = {
  'pro reset': 'https://elijahbryant.pro/pro-reset',
  // Add more: 'guide title': 'https://beehiiv.com/...'
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.length >= MIN_CHARS) chunks.push(chunk)
    i += chunkSize - overlap
  }
  return chunks
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60)
}

function findBeehiivUrl(title) {
  const t = title.toLowerCase()
  for (const [key, url] of Object.entries(BEEHIIV_URLS)) {
    if (t.includes(key)) return url
  }
  return null
}

// ── Google Drive Auth ────────────────────────────────────────────────────────

async function getAuthClient() {
  if (!existsSync(GDRIVE_KEY_FILE)) {
    throw new Error(`Service account key not found at ${GDRIVE_KEY_FILE}.\nRun: node scripts/gdrive-setup.mjs for setup instructions.`)
  }
  const keyData = JSON.parse(await readFile(GDRIVE_KEY_FILE, 'utf8'))
  const auth = new google.auth.GoogleAuth({
    credentials: keyData,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
  return auth
}

// ── List all PDFs recursively ────────────────────────────────────────────────

async function listPdfsInFolder(drive, folderId, folderName = 'Root') {
  const files = []

  // List items in this folder
  let pageToken = undefined
  while (true) {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 100,
      pageToken,
    })

    for (const file of res.data.files || []) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        // Recurse into subfolder — use folder name as category
        const subFiles = await listPdfsInFolder(drive, file.id, file.name)
        files.push(...subFiles)
      } else if (file.mimeType === 'application/pdf') {
        files.push({ id: file.id, name: file.name, category: folderName })
      }
    }

    if (!res.data.nextPageToken) break
    pageToken = res.data.nextPageToken
    await sleep(200)
  }

  return files
}

// ── Download PDF as Buffer ───────────────────────────────────────────────────

async function downloadPdf(drive, fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  )
  return Buffer.from(res.data)
}

// ── Topic Tagging ────────────────────────────────────────────────────────────

const TOPICS = ['confidence', 'pressure', 'consistency', 'focus', 'slump', 'coaching', 'team', 'mindset', 'motivation', 'identity', 'nutrition', 'recovery', 'workout', 'film', 'recruiting']

let _anthropic = null
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}

async function tagContent(title, text) {
  try {
    const res = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 20,
      messages: [{
        role: 'user',
        content: `You are tagging a basketball performance guide written by Elijah Bryant.

Guide title: "${title}"
Content preview: ${text.slice(0, 800)}

Pick the ONE best topic from this list: ${TOPICS.join(', ')}

Reply with just the single topic word. Nothing else.`,
      }],
    })
    const tag = res.content[0]?.text?.trim().toLowerCase()
    return TOPICS.includes(tag) ? tag : null
  } catch (err) {
    console.warn(`  ⚠️  Tag failed: ${err.message?.slice(0, 80)}`)
    return null
  }
}

// ── Embed + Upsert ─────────────────────────────────────────────────────────

async function embed(text) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: [text], model: 'voyage-3-lite' }),
  })
  if (!res.ok) throw new Error(`Voyage error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.data[0].embedding
}

async function upsertVectors(vectors) {
  const res = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors }),
  })
  if (!res.ok) throw new Error(`Pinecone error ${res.status}: ${await res.text()}`)
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log('\n📚 Ask Elijah — Google Drive Lead Magnet Ingestion\n')

let auth
try {
  auth = await getAuthClient()
} catch (err) {
  console.error(`\n❌ ${err.message}\n`)
  process.exit(1)
}

const drive = google.drive({ version: 'v3', auth })

// List all PDFs
console.log('  Scanning Google Drive folder...')
let allFiles = []
try {
  allFiles = await listPdfsInFolder(drive, ROOT_FOLDER_ID, 'Lead Magnets')
} catch (err) {
  console.error(`\n❌ Failed to list Drive files: ${err.message}`)
  console.error('  Make sure you\'ve shared the folder with the service account email.\n')
  process.exit(1)
}

console.log(`  Found ${allFiles.length} PDFs\n`)

if (allFiles.length === 0) {
  console.log('  No PDFs found. Make sure the folder is shared with the service account.\n')
  process.exit(0)
}

let totalOk = 0, totalSkipped = 0, totalErrors = 0

for (let i = 0; i < allFiles.length; i++) {
  const { id, name, category } = allFiles[i]
  const label = name.slice(0, 55).padEnd(57, '.')

  process.stdout.write(`  [${i + 1}/${allFiles.length}] ${label} `)

  // Download PDF
  let pdfBuffer
  try {
    pdfBuffer = await downloadPdf(drive, id)
  } catch (err) {
    process.stdout.write(`❌ download failed: ${err.message.slice(0, 50)}\n`)
    totalErrors++
    await sleep(500)
    continue
  }

  // Extract text
  let text = ''
  try {
    const parsed = await pdfParse(pdfBuffer)
    text = (parsed.text || '')
      .replace(/\s+/g, ' ')
      .trim()
  } catch (err) {
    process.stdout.write(`❌ pdf parse failed: ${err.message.slice(0, 50)}\n`)
    totalErrors++
    continue
  }

  if (text.length < MIN_CHARS) {
    process.stdout.write(`⏭️  too short (${text.length} chars)\n`)
    totalSkipped++
    continue
  }

  const chunks = chunkText(text)
  if (chunks.length === 0) {
    process.stdout.write(`⏭️  no chunks\n`)
    totalSkipped++
    continue
  }

  const beehiivUrl = findBeehiivUrl(name)

  // Tag the whole document once (based on title + first chunk)
  const topic = await tagContent(name, chunks[0] || text)

  const vectors = []

  for (let j = 0; j < chunks.length; j++) {
    try {
      const values = await embed(chunks[j])
      const metadata = {
        text: chunks[j],
        source_type: 'lead_magnet',
        source_title: name,
        category: category,
        chunk_index: j,
      }
      if (topic) metadata.topic = topic
      if (beehiivUrl) metadata.beehiiv_url = beehiivUrl

      vectors.push({
        id: `lm_${slugify(name)}_${j}`,
        values,
        metadata,
      })
      await sleep(100)
    } catch { /* skip chunk */ }
  }

  if (vectors.length === 0) {
    process.stdout.write(`❌ embed failed\n`)
    totalErrors++
    continue
  }

  try {
    for (let j = 0; j < vectors.length; j += 50) {
      await upsertVectors(vectors.slice(j, j + 50))
    }
    const topicNote = topic ? ` #${topic}` : ''
    const beehiivNote = beehiivUrl ? ' (beehiiv linked)' : ''
    process.stdout.write(`✅ ${vectors.length} chunks [${category}]${topicNote}${beehiivNote}\n`)
    totalOk++
  } catch (err) {
    process.stdout.write(`❌ upsert: ${err.message.slice(0, 60)}\n`)
    totalErrors++
  }

  await sleep(400)
}

console.log(`\n  ✅ Ingested: ${totalOk} PDFs`)
console.log(`  ⏭️  Skipped:  ${totalSkipped}`)
console.log(`  ❌ Errors:   ${totalErrors}`)
console.log('\n✅ Done.\n')
