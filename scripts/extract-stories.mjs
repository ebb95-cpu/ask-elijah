/**
 * Ask Elijah — Personal Story Extraction (Whisper-powered)
 *
 * Downloads audio from YouTube videos via yt-dlp, transcribes with
 * OpenAI Whisper (word-for-word accurate), then uses Claude to extract
 * Elijah's personal stories and upserts them to Pinecone.
 *
 * Usage:
 *   node scripts/extract-stories.mjs                 — newsletters + YouTube
 *   node scripts/extract-stories.mjs --newsletters   — newsletters only
 *   node scripts/extract-stories.mjs --youtube       — YouTube only
 */

import { execSync, exec } from 'child_process'
import { existsSync, unlinkSync, mkdirSync } from 'fs'
import { readFile } from 'fs/promises'
import { join, basename } from 'path'
import { tmpdir } from 'os'
import Anthropic from '@anthropic-ai/sdk'
import FormData from 'form-data'
import { createReadStream } from 'fs'
import { config } from 'dotenv'
config({ path: '.env.local' })

const PINECONE_HOST = process.env.PINECONE_HOST
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const BEEHIIV_PUB_ID = 'pub_9471ed24-57d1-43c6-be5b-ee779941c348'

const YOUTUBE_CHANNELS = [
  { handle: 'ElijahBryant3', label: 'Elijah Bryant' },
  { handle: 'ConsistencyClubFilm', label: 'Consistency Club Film' },
]

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
const TMP_DIR = join(tmpdir(), 'ask-elijah-audio')

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60)
}

// ── Whisper Transcription ───────────────────────────────────────────────────

const FFMPEG = '/Users/elijahbryant/bin/ffmpeg'
const MAX_WHISPER_BYTES = 24 * 1024 * 1024 // 24MB

async function transcribeChunk(chunkPath) {
  const form = new FormData()
  form.append('file', createReadStream(chunkPath))
  form.append('model', 'whisper-1')
  form.append('language', 'en')
  form.append('response_format', 'text')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
    body: form,
  })

  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`)
  return await res.text()
}

async function transcribeWithWhisper(audioPath) {
  const { statSync, readdirSync } = await import('fs')
  const fileSize = statSync(audioPath).size

  if (fileSize <= MAX_WHISPER_BYTES) return await transcribeChunk(audioPath)

  // Split into 10-minute chunks and transcribe each
  const chunkDir = join(TMP_DIR, `chunks_${Date.now()}`)
  mkdirSync(chunkDir, { recursive: true })
  try {
    execSync(
      `${FFMPEG} -i "${audioPath}" -f segment -segment_time 600 -c copy "${join(chunkDir, 'chunk_%03d.mp3')}" -y -loglevel quiet`,
      { timeout: 120000 }
    )
    const chunks = readdirSync(chunkDir).filter(f => f.endsWith('.mp3')).sort()
    const transcripts = []
    for (const chunk of chunks) {
      try {
        const text = await transcribeChunk(join(chunkDir, chunk))
        if (text?.trim()) transcripts.push(text.trim())
        await sleep(500)
      } catch { /* skip chunk */ }
    }
    return transcripts.join(' ')
  } finally {
    try { execSync(`rm -rf "${chunkDir}"`) } catch {}
  }
}

async function downloadAndTranscribe(videoId, title) {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })
  const audioPath = join(TMP_DIR, `${videoId}.mp3`)
  if (existsSync(audioPath)) unlinkSync(audioPath)

  try {
    // Download at low bitrate so even long videos stay small
    execSync(
      `yt-dlp -x --audio-format mp3 --audio-quality 5 --postprocessor-args "ffmpeg:-ar 16000 -ac 1 -b:a 64k" --ffmpeg-location /Users/elijahbryant/bin -o "${audioPath}" "https://youtube.com/watch?v=${videoId}" --quiet`,
      { timeout: 300000 }
    )
  } catch (err) {
    throw new Error(`yt-dlp failed: ${err.message?.slice(0, 100)}`)
  }

  if (!existsSync(audioPath)) throw new Error('Audio file not created')

  let transcript
  try {
    transcript = await transcribeWithWhisper(audioPath)
  } finally {
    if (existsSync(audioPath)) unlinkSync(audioPath)
  }
  return transcript
}

// ── Story Extraction via Claude ─────────────────────────────────────────────

async function extractStories(text, sourceTitle) {
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are extracting personal stories from Elijah Bryant's content. Elijah is an NBA + EuroLeague champion basketball player who coaches mental performance.

A personal story must:
- Be a specific experience Elijah lived through (a game, a moment, a period in his career or life)
- Include emotional detail or a lesson he learned
- Be self-contained enough to be useful without the surrounding text

From the text below, extract ALL personal stories. For each one:
1. Write the story as a clean, self-contained paragraph (2-6 sentences), in Elijah's first-person voice
2. Assign ONE topic: confidence, pressure, consistency, focus, slump, coaching, team, mindset, motivation, identity
3. Assign ONE trigger (the emotional root) or null: fear_of_failure, embarrassment, external_pressure, self_doubt, frustration, loss_of_motivation, overthinking

Return a JSON array only. No markdown. No explanation.
Format: [{"story": "...", "topic": "...", "trigger": "..."}]
Return [] if no personal stories are present.

SOURCE: ${sourceTitle}
TEXT:
${text.slice(0, 6000)}`,
      }],
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '[]'
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn(`  ⚠️  Claude extraction failed: ${err.message}`)
    return []
  }
}

// ── Embed + Upsert ─────────────────────────────────────────────────────────

async function embed(text) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: [text], model: 'voyage-3-lite' }),
  })
  if (!res.ok) throw new Error(`Voyage error ${res.status}`)
  const data = await res.json()
  return data.data[0].embedding
}

async function upsertStory(id, story, sourceTitle, topic, trigger) {
  const values = await embed(story)
  const metadata = {
    text: story,
    source_type: 'personal_story',
    source_title: sourceTitle,
  }
  if (topic) metadata.topic = topic
  if (trigger) metadata.trigger = trigger

  const res = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors: [{ id, values, metadata }] }),
  })
  if (!res.ok) throw new Error(`Pinecone upsert error ${res.status}`)
}

// ── YouTube ─────────────────────────────────────────────────────────────────

function getChannelVideos(handle) {
  const output = execSync(
    `yt-dlp --flat-playlist --print "%(id)s|%(title)s" --ffmpeg-location /Users/elijahbryant/bin "https://www.youtube.com/@${handle}/videos" 2>/dev/null`,
    { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
  ).toString().trim()

  return output.split('\n')
    .filter(Boolean)
    .map(line => {
      const sep = line.indexOf('|')
      const videoId = line.slice(0, sep).trim()
      const title = line.slice(sep + 1).trim()
      return { videoId, title }
    })
    .filter(v => v.videoId?.length === 11)
}

function isShortForm(title = '') {
  const t = title.toLowerCase()
  return t.includes('#shorts') || t.includes('#short') || t.includes('shorts |') || t.includes('| shorts') || t.startsWith('#')
}

async function processYouTube() {
  console.log('\n📺 Extracting stories from YouTube (Whisper transcription)...\n')
  let totalStories = 0

  for (const channel of YOUTUBE_CHANNELS) {
    console.log(`  Channel: ${channel.label}`)
    let videos = []
    try {
      videos = await getChannelVideos(channel.handle)
    } catch (err) {
      console.log(`  ❌ Could not fetch channel: ${err.message}`)
      continue
    }
    console.log(`  Found ${videos.length} videos\n`)

    for (let i = 0; i < videos.length; i++) {
      const { videoId, title } = videos[i]
      if (isShortForm(title)) continue

      const label = (title || videoId).slice(0, 50)
      process.stdout.write(`  [${i + 1}/${videos.length}] ${label}... `)

      let transcript
      try {
        transcript = await downloadAndTranscribe(videoId, title)
      } catch (err) {
        process.stdout.write(`skipped (${err.message.slice(0, 60)})\n`)
        await sleep(500)
        continue
      }

      if (!transcript || transcript.length < 200) {
        process.stdout.write(`skipped (transcript too short)\n`)
        continue
      }

      const stories = await extractStories(transcript, title || `YouTube: ${videoId}`)

      if (stories.length === 0) {
        process.stdout.write(`no stories\n`)
        await sleep(300)
        continue
      }

      let saved = 0
      for (let j = 0; j < stories.length; j++) {
        const { story, topic, trigger } = stories[j]
        if (!story?.trim()) continue
        try {
          await upsertStory(`story_yt_${videoId}_${j}`, story.trim(), title || `YouTube: ${videoId}`, topic, trigger)
          saved++
          await sleep(150)
        } catch (err) {
          console.warn(`\n  ⚠️  Upsert failed: ${err.message}`)
        }
      }

      process.stdout.write(`${saved} stories saved\n`)
      totalStories += saved
      await sleep(500)
    }
  }

  console.log(`\n  ✅ Total stories from YouTube: ${totalStories}`)
}

// ── Newsletters ─────────────────────────────────────────────────────────────

async function fetchAllNewsletters() {
  let page = 1, all = []
  while (true) {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/posts?status=confirmed&expand[]=free_web_content&limit=50&page=${page}`,
      { headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}` } }
    )
    if (!res.ok) break
    const data = await res.json()
    const issues = data.data || []
    if (issues.length === 0) break
    all = all.concat(issues)
    if (!data.next_page) break
    page++
    await sleep(400)
  }
  return all
}

async function processNewsletters() {
  console.log('\n📧 Extracting stories from newsletters...\n')
  const issues = await fetchAllNewsletters()
  console.log(`  Found ${issues.length} issues\n`)

  let totalStories = 0

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i]
    const title = issue.title || `Issue ${i + 1}`
    const label = title.slice(0, 50)
    const rawHtml = issue.free_web_content || issue.content?.free?.web || ''
    const text = rawHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()

    if (text.length < 200) continue

    process.stdout.write(`  [${i + 1}/${issues.length}] ${label}... `)

    const stories = await extractStories(text, title)

    if (stories.length === 0) {
      process.stdout.write(`no stories\n`)
      await sleep(300)
      continue
    }

    let saved = 0
    for (let j = 0; j < stories.length; j++) {
      const { story, topic, trigger } = stories[j]
      if (!story?.trim()) continue
      try {
        await upsertStory(`story_nl_${slugify(title)}_${j}`, story.trim(), title, topic, trigger)
        saved++
        await sleep(150)
      } catch (err) {
        console.warn(`\n  ⚠️  Upsert failed: ${err.message}`)
      }
    }

    process.stdout.write(`${saved} stories saved\n`)
    totalStories += saved
    await sleep(400)
  }

  console.log(`\n  ✅ Total stories from newsletters: ${totalStories}`)
}

// ── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const newslettersOnly = args.includes('--newsletters')
const youtubeOnly = args.includes('--youtube')

console.log('\n🚀 Ask Elijah — Personal Story Extraction (Whisper)\n')

if (!youtubeOnly) await processNewsletters()
if (!newslettersOnly) await processYouTube()

// Clean up temp dir
try { execSync(`rm -rf "${TMP_DIR}"`) } catch {}

console.log('\n✅ Done.\n')
