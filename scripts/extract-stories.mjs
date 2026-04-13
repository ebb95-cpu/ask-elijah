/**
 * Ask Elijah — Personal Story Extraction
 *
 * Reads all ingested YouTube transcripts + newsletters via their source APIs,
 * uses Claude to extract Elijah's personal stories from each piece of content,
 * then upserts them to Pinecone as source_type: 'personal_story' with
 * topic + trigger tags.
 *
 * Usage:
 *   node scripts/extract-stories.mjs
 *   node scripts/extract-stories.mjs --newsletters
 *   node scripts/extract-stories.mjs --youtube
 */

import { Innertube } from 'youtubei.js'
import Anthropic from '@anthropic-ai/sdk'
import { config } from 'dotenv'
config({ path: '.env.local' })

const PINECONE_HOST = process.env.PINECONE_HOST
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY
const BEEHIIV_PUB_ID = 'pub_9471ed24-57d1-43c6-be5b-ee779941c348'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const YOUTUBE_CHANNELS = [
  { handle: 'ElijahBryant3', label: 'Elijah Bryant' },
  { handle: 'ConsistencyClubFilm', label: 'Consistency Club Film' },
]

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60)
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
Format: [{"story": "...", "topic": "...", "trigger": "..." }]
Return [] if no personal stories are present.

SOURCE: ${sourceTitle}
TEXT:
${text.slice(0, 6000)}`,
      }],
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '[]'
    // Strip any markdown code fences
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

let _yt = null
async function getYT() {
  if (!_yt) {
    _yt = await Innertube.create({ generate_session_locally: true })
    _yt.session.on('auth-pending', () => {})
  }
  return _yt
}

const _warn = console.warn
console.warn = (...args) => {
  const msg = String(args[0] || '')
  if (msg.includes('YOUTUBEJS') || msg.includes('Unable to find')) return
  _warn(...args)
}

async function fetchTranscript(videoId) {
  const yt = await getYT()
  const info = await yt.getInfo(videoId)
  const tracks = info.captions?.caption_tracks || []
  if (!tracks.length) throw new Error('No captions')
  const track =
    tracks.find(t => t.language_code === 'en' && t.kind !== 'asr') ||
    tracks.find(t => t.language_code === 'en') ||
    tracks[0]
  if (!track?.base_url) throw new Error('No usable track')
  const res = await fetch(track.base_url + '&fmt=json3', { headers: HEADERS })
  if (!res.ok) throw new Error(`Caption fetch failed: ${res.status}`)
  const data = await res.json()
  const text = (data.events || [])
    .filter(e => e.segs)
    .map(e => e.segs.map(s => s.utf8 || '').join(''))
    .join(' ')
    .replace(/\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) throw new Error('Empty transcript')
  return text
}

async function getChannelVideos(handle) {
  const pageRes = await fetch(`https://www.youtube.com/@${handle}/videos`, { headers: HEADERS })
  if (!pageRes.ok) throw new Error(`Channel fetch failed: ${pageRes.status}`)
  const html = await pageRes.text()
  const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/)
  if (match) {
    try {
      const data = JSON.parse(match[1])
      const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || []
      const videosTab = tabs.find(t => t?.tabRenderer?.title === 'Videos')
      const items = videosTab?.tabRenderer?.content?.richGridRenderer?.contents || []
      const videos = items
        .map(item => {
          const video = item?.richItemRenderer?.content?.videoRenderer
          if (!video?.videoId) return null
          return { videoId: video.videoId, title: video.title?.runs?.[0]?.text || '' }
        })
        .filter(Boolean)
      if (videos.length > 0) return videos
    } catch { /* fallthrough */ }
  }
  const ids = [...new Set([...html.matchAll(/"videoId":"([^"]{11})"/g)].map(m => m[1]))]
  const titleMap = {}
  for (const m of html.matchAll(/"videoId":"([^"]{11})"[^}]*?"text":"([^"]+)"/g)) {
    if (!titleMap[m[1]]) titleMap[m[1]] = m[2]
  }
  return ids.map(id => ({ videoId: id, title: titleMap[id] || '' }))
}

function isShortForm(title = '') {
  const t = title.toLowerCase()
  return t.includes('#shorts') || t.includes('#short') || t.includes('shorts |') || t.includes('| shorts') || t.startsWith('#')
}

async function processYouTube() {
  console.log('\n📺 Extracting stories from YouTube transcripts...\n')
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

    for (let i = 0; i < videos.length; i++) {
      const { videoId, title } = videos[i]
      if (isShortForm(title)) continue

      let transcript
      try {
        transcript = await fetchTranscript(videoId)
      } catch {
        await sleep(500)
        continue
      }

      if (transcript.length < 400) continue

      const label = (title || videoId).slice(0, 50)
      process.stdout.write(`  [${i + 1}/${videos.length}] ${label}... `)

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
          const id = `story_yt_${videoId}_${j}`
          await upsertStory(id, story.trim(), title || `YouTube: ${videoId}`, topic, trigger)
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

  console.log(`\n  ✅ Total stories extracted from YouTube: ${totalStories}`)
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
        const id = `story_nl_${slugify(title)}_${j}`
        await upsertStory(id, story.trim(), title, topic, trigger)
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

  console.log(`\n  ✅ Total stories extracted from newsletters: ${totalStories}`)
}

// ── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const newslettersOnly = args.includes('--newsletters')
const youtubeOnly = args.includes('--youtube')

console.log('\n🚀 Ask Elijah — Personal Story Extraction\n')
console.log('  This reads all ingested content, uses Claude to find Elijah\'s')
console.log('  personal stories, and saves them to Pinecone as personal_story vectors.\n')

if (!youtubeOnly) await processNewsletters()
if (!newslettersOnly) await processYouTube()

console.log('\n✅ Done.\n')
