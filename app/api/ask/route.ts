import { escapeHtml } from '@/lib/escape-html'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { checkLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log-error'
import { sanitizeAnswerText } from '@/lib/answer-sanitize'
import { getFreshnessInstruction, requiresFreshWeb } from '@/lib/freshness'

// Draft generation now uses web_search/web_fetch to ground mechanism claims
// in real research. Search + weave adds 5–10s of latency per answer, so the
// function needs headroom beyond the default Vercel serverless limit.
export const maxDuration = 60

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

type WebSource = { title: string; url: string; type: string }

function harvestWebSources(content: Anthropic.Messages.ContentBlock[]): WebSource[] {
  const out: WebSource[] = []
  const seen = new Set<string>()
  for (const block of content) {
    if (block.type === 'web_search_tool_result') {
      const items = (block as unknown as { content: Array<{ url?: string; title?: string }> }).content || []
      for (const item of items) {
        if (item.url && !seen.has(item.url)) {
          seen.add(item.url)
          out.push({ url: item.url, title: item.title || item.url, type: 'web' })
        }
      }
    }
    if (block.type === 'web_fetch_tool_result') {
      const fetched = (block as unknown as { content?: { url?: string; title?: string } }).content
      if (fetched?.url && !seen.has(fetched.url)) {
        seen.add(fetched.url)
        out.push({ url: fetched.url, title: fetched.title || fetched.url, type: 'web' })
      }
    }
    if (block.type === 'text') {
      const citations = (block as unknown as { citations?: Array<{ url?: string; title?: string }> }).citations
      if (Array.isArray(citations)) {
        for (const c of citations) {
          if (c.url && !seen.has(c.url)) {
            seen.add(c.url)
            out.push({ url: c.url, title: c.title || c.url, type: 'web' })
          }
        }
      }
    }
  }
  return out
}

// Strip <<VERIFY:...>> markers for the clean answer stored/sent to user
function stripVerifyMarkers(text: string): string {
  return text.replace(/<<VERIFY:\s*([^>]+)>>/g, '$1')
}

// Check if answer has any flagged claims
function hasVerifyFlags(text: string): boolean {
  return /<<VERIFY:/i.test(text)
}

// Highlight <<VERIFY:...>> in yellow for the notification email
function highlightVerifyMarkers(text: string): string {
  return text.replace(
    /<<VERIFY:\s*([^>]+)>>/g,
    '<span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:3px;font-weight:600;">⚠️ VERIFY: $1</span>'
  )
}

const MIN_PINECONE_SCORE = 0.35

/**
 * Self-critique the draft before returning it. One Haiku call grading
 * voice, grounding, and action. If the grader flags issues, the caller
 * regenerates once with those issues injected as additional constraints.
 * Capped at a single retry so latency stays bounded.
 */
async function critiqueDraft(draft: string, question: string, hadContext: boolean): Promise<{ ok: boolean; issues: string[] }> {
  try {
    const res = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 250,
      messages: [{
        role: 'user',
        content: `You are grading a draft answer written for basketball player Elijah Bryant to send to a player.

Question from player: "${question}"

Draft answer:
"""
${draft}
"""

Grade on three criteria. Return JSON only.

1. Voice: first person, short sentences, no em-dashes or en-dashes, no AI-sounding words (crucial, vital, pivotal, delve, leverage, game-changer, at the end of the day, in conclusion, boundaries, foster, elevate), contractions (don't, you're, I'm), conversational like a text.
2. Grounded: ${hadContext ? 'uses the specific situation the player described, does not give generic tips' : 'does not invent experiences or science claims (no context was provided, so must be honest about that)'}.
3. Action: ends with ONE specific concrete thing the player can do today, not vague.

Return JSON:
{"ok": true} if all three pass.
{"ok": false, "issues": ["what's wrong with voice/grounded/action in one short sentence each"]} if not.

No preamble.`,
      }],
    })
    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}'
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean) as { ok?: boolean; issues?: string[] }
    if (parsed.ok === true) return { ok: true, issues: [] }
    return { ok: false, issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 3) : [] }
  } catch {
    // Don't block the draft on a critic failure — just let it through
    return { ok: true, issues: [] }
  }
}

type EntryMode = 'bad_game' | 'coach' | 'playing_time' | 'parent' | 'general' | null

/**
 * Extra instructions injected into the user message for specific entry modes.
 * These shape tone and opening, not the whole prompt.
 */
function modePreamble(mode: EntryMode, askerType: string | null): string {
  switch (mode) {
    case 'bad_game':
      return `THE PLAYER JUST PLAYED BADLY. They're still in it — maybe on the bus home, maybe in their feelings. Open by naming exactly how they're probably feeling right now before you give them anything else. Don't rush to the fix. Meet them where they are. Then, and only then, give them one thing to hold onto and one specific thing to do tomorrow (not tonight). No drills. No "here's a tip." Real talk.\n\n`
    case 'coach':
      return `THIS IS A COACH-SITUATION QUESTION. Don't give generic "communicate with your coach" advice. Name what's actually going on from both sides — what coaches look for, what they don't say out loud, what this player can control vs can't. If there's a conversation they need to have, give them the actual words to use (and the words NOT to use). Short, honest, no bullshit.\n\n`
    case 'playing_time':
      return `THIS IS A PLAYING-TIME QUESTION. Cut through the parent-talk and give the real answer: coaches play who they trust, and trust is built in three places — practice habits, the small stuff during games, and how you respond to being benched. Pick the ONE thing that will move the needle for this specific kid based on what they told you, and tell them exactly what to do this week.\n\n`
    case 'parent':
      return `THIS QUESTION IS FROM A PARENT asking about their kid. Speak to the parent directly, not the kid. They're worried and they love this kid. Validate that first. Then be honest about what parents can and can't control in basketball — and what the research actually says about when parents hurt vs help. End with one specific thing they can do this week that ISN'T "talk to the coach."\n\n`
    default:
      return askerType === 'parent'
        ? `This question is from a parent asking about their kid. Address the parent, not the kid.\n\n`
        : ''
  }
}


const TOPICS = ['confidence', 'pressure', 'consistency', 'focus', 'slump', 'coaching', 'team', 'mindset', 'motivation', 'identity'] as const
type Topic = typeof TOPICS[number]

const TRIGGERS = ['fear_of_failure', 'embarrassment', 'external_pressure', 'self_doubt', 'frustration', 'loss_of_motivation', 'overthinking'] as const
type Trigger = typeof TRIGGERS[number]

async function tagTrigger(question: string): Promise<Trigger | null> {
  try {
    const res = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 20,
      messages: [{
        role: 'user',
        content: `Identify the core emotional trigger in this basketball player's question. Pick exactly one:

fear_of_failure = scared of messing up, afraid to fail, worried about letting people down
embarrassment = humiliated after a bad game, scared of being judged, shame
external_pressure = coach, parents, teammates, scouts putting pressure on them
self_doubt = not believing in themselves, imposter syndrome, feeling like they don't belong
frustration = angry at situation, things not going their way, hitting a wall
loss_of_motivation = burnout, losing love for the game, don't want to play anymore
overthinking = stuck in their head, can't stop analyzing, paralyzed by thoughts

Question: "${question}"

Reply with only the single tag word.`,
      }],
    })
    const tag = res.content[0].type === 'text' ? res.content[0].text.trim().toLowerCase() : ''
    return (TRIGGERS as readonly string[]).includes(tag) ? tag as Trigger : null
  } catch {
    return null
  }
}

async function tagTopic(question: string): Promise<{ topic: Topic | null; confidence: number | null }> {
  try {
    const res = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 40,
      messages: [{
        role: 'user',
        content: `Categorize this basketball player's mental performance question with exactly one of these tags: confidence, pressure, consistency, focus, slump, coaching, team, mindset, motivation, identity. If none fit well, return "none".

confidence = self-belief, fear of failure, imposter syndrome
pressure = big game nerves, performance anxiety, clutch moments
consistency = hot/cold streaks, staying locked in, habits
focus = concentration, distractions, mental noise, being in the zone
slump = shooting slump, bad form, losing rhythm
coaching = coach relationship, playing time, feedback, being benched
team = teammates, leadership, team dynamics, locker room
mindset = mental toughness, resilience, attitude, growth
motivation = drive, passion, burnout, losing love for the game
identity = who am I as a player, position change, role, purpose

Question: "${question}"

Return JSON only: {"tag": "<tag>", "confidence": <0-1>}. Use confidence < 0.6 if the question is ambiguous or off-topic.`,
      }],
    })
    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}'
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean) as { tag?: string; confidence?: number }
    const tag = (parsed.tag || '').toLowerCase()
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : null
    const valid = (TOPICS as readonly string[]).includes(tag) ? (tag as Topic) : null
    // Only use as filter if confidence is high enough
    const filterable = confidence !== null && confidence < 0.6 ? null : valid
    return { topic: filterable, confidence }
  } catch {
    return { topic: null, confidence: null }
  }
}

// Extract memorable facts from a question using Claude
async function extractMemories(question: string): Promise<{ fact_type: string; fact_text: string; expires_days: number | null }[]> {
  try {
    const anthropic = getAnthropic()
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Extract memorable facts about this basketball player from their question. Return a JSON array of objects with keys: fact_type (one of: event, context, goal, setback), fact_text (one short sentence), expires_days (null for permanent facts, or number of days for time-sensitive things like upcoming games — use 14 for events).

Return [] if nothing notable to remember.

Question: "${question}"

Return only valid JSON array, nothing else.`
      }]
    })
    const text = res.content[0].type === 'text' ? res.content[0].text.trim() : '[]'
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Fetch 2 of Elijah's highest-quality approved answers to use as voice anchors
 * in the prompt. Quality signal: approved AND edit_count is low (Elijah barely
 * edited the AI draft, meaning the voice was already right) AND a matching
 * topic. These get pasted in as few-shot examples — anchors the output to
 * Elijah's real voice better than any description can.
 *
 * Returns formatted text ready to drop into the user message, or '' if none.
 */
async function getVoiceAnchors(topic: string | null): Promise<string> {
  try {
    const supabase = getSupabase()
    let query = supabase
      .from('questions')
      .select('question, answer, edit_count, topic')
      .eq('status', 'approved')
      .is('deleted_at', null)
      .not('answer', 'is', null)
      .order('edit_count', { ascending: true })
      .order('approved_at', { ascending: false })
      .limit(10)

    if (topic) {
      // Prefer same-topic examples when we have a topic match
      query = query.eq('topic', topic)
    }

    const { data } = await query
    const candidates = (data || []).filter((q) => q.answer && q.answer.length > 200 && q.answer.length < 2000)
    if (candidates.length === 0) return ''

    // Take up to 2
    const picks = candidates.slice(0, 2)
    const lines = picks.map((p, i) => `EXAMPLE ${i + 1} — a real answer Elijah approved:\nQuestion: "${p.question}"\nElijah's answer: ${p.answer}`).join('\n\n')
    return `Here are real approved answers showing Elijah's voice. Match this tone, cadence, and sentence structure — NOT a generic helpful-assistant voice:\n\n${lines}\n\n---\n\n`
  } catch {
    return ''
  }
}

// Fetch player context for admin email
async function getPlayerContext(email: string): Promise<string> {
  const supabase = getSupabase()
  const clean = email.toLowerCase()
  const now = new Date().toISOString()

  const [profileRes, memoriesRes, historyRes] = await Promise.all([
    supabase.from('profiles').select('age, position, level, country, challenge').eq('email', clean).single(),
    supabase.from('player_memories').select('fact_type, fact_text').eq('email', clean).or(`expires_at.is.null,expires_at.gt.${now}`).order('created_at', { ascending: false }).limit(10),
    supabase.from('questions').select('question, answer').eq('email', clean).eq('status', 'approved').order('updated_at', { ascending: false }).limit(3),
  ])

  const lines: string[] = []

  const p = profileRes.data as { age?: string; position?: string; level?: string; country?: string; challenge?: string } | null
  if (p) {
    // Age first — it's the single most context-shaping detail (you'd
    // write to a 14-year-old very differently than a 22-year-old), so it
    // leads the player-context line Elijah sees when reviewing drafts.
    const parts = [
      p.age ? `age ${p.age}` : null,
      p.position,
      p.level,
      p.country,
      p.challenge ? `struggles with ${p.challenge}` : null,
    ].filter(Boolean)
    if (parts.length) lines.push(`Profile: ${parts.join(', ')}`)
  }

  const memories = memoriesRes.data || []
  if (memories.length) {
    lines.push('What I remember about this player:')
    memories.forEach(m => lines.push(`  • [${m.fact_type}] ${m.fact_text}`))
  }

  const history = historyRes.data || []
  if (history.length) {
    lines.push('Previous questions they asked:')
    history.forEach((q, i) => lines.push(`  ${i + 1}. "${q.question}"`))
  }

  return lines.length ? lines.join('\n') : ''
}

const BLOCKED = [
  /why (do you|don'?t you|dont you) suck/i,
  /you suck/i,
  /you'?re (trash|garbage|awful|terrible|horrible|bad)/i,
  /why (are you|r u) (so )?bad/i,
  /why (can'?t|cant) you (play|shoot|score|dribble)/i,
  /why don'?t you play well/i,
  /kill\s+you/i,
  /i'?ll?\s+(kill|hurt|attack|destroy)\s+you/i,
  /go (to hell|die|fuck yourself)/i,
  /fuck\s+(you|off)/i,
  /shut\s+up/i,
  /stupid|idiot|moron|loser|bum\b/i,
]

async function detectLanguage(text: string): Promise<{ language: string; englishTranslation: string | null }> {
  try {
    const res = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Detect the language of this text. If it is not English, provide a natural English translation.

Return JSON only: {"language": "English", "translation": null} for English, or {"language": "Greek", "translation": "..."} for other languages.

Text: "${text.replace(/"/g, '\\"')}"`,
      }],
    })
    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
    const parsed = JSON.parse(raw)
    return {
      language: parsed.language || 'English',
      englishTranslation: parsed.translation || null,
    }
  } catch {
    return { language: 'English', englishTranslation: null }
  }
}

/**
 * Multi-query rewrite. Players phrase things in first-person emotional
 * language; Elijah's content uses different terminology. We generate
 * multiple reformulations so RAG can match on different angles:
 *   - narrow: the most specific terminology-aligned version
 *   - broad: a wider conceptual framing to catch adjacent content
 *   - keyword: bare nouns/phrases (acts like a sparse-ish match)
 *
 * This is a pragmatic substitute for true Pinecone hybrid sparse-dense
 * retrieval — three semantic queries merged catches most of what a
 * sparse keyword index would add, without reindexing everything.
 */
async function rewriteQueryMulti(question: string): Promise<{ narrow: string; broad: string; keyword: string }> {
  try {
    const res = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `A basketball player asked: "${question}"

Generate three reformulations for searching Elijah Bryant's knowledge base (videos and newsletters about mental performance, confidence, pressure, and basketball improvement).

Return valid JSON only:
{
  "narrow": "<15 words or less, uses Elijah's exact vocabulary like pre-game routine, pressure response, identity, task-driven, confidence, slump, mindset>",
  "broad": "<15 words or less, a wider conceptual framing of the same issue>",
  "keyword": "<just 3-6 key nouns/phrases separated by spaces, no filler>"
}

No preamble, no prose, only JSON.`,
      }],
    })
    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}'
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean) as { narrow?: string; broad?: string; keyword?: string }
    const safe = (s: string | undefined, fallback: string) => {
      if (!s || s.length < 5 || s.length > 200) return fallback
      return s.replace(/^["']+|["']+$/g, '').replace(/[.!?]+$/, '').trim()
    }
    return {
      narrow: safe(parsed.narrow, question),
      broad: safe(parsed.broad, question),
      keyword: safe(parsed.keyword, question),
    }
  } catch {
    return { narrow: question, broad: question, keyword: question }
  }
}

async function embedQuestion(question: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [question], model: 'voyage-3-lite' }),
  })
  if (!res.ok) throw new Error(`Voyage embed failed: ${res.status}`)
  const data = await res.json()
  return data.data[0].embedding
}

type PineconeMatch = { id?: string; score: number; metadata: Record<string, string> }

async function searchPinecone(
  embeddings: number[][],
  topK = 5,
  topic?: string | null,
  level?: string | null
): Promise<{
  chunks: string[]
  sources: { title: string; url: string; type: string }[]
}> {
  const pineconeFetch = (body: object) =>
    fetch(`${process.env.PINECONE_HOST}/query`, {
      method: 'POST',
      headers: {
        'Api-Key': process.env.PINECONE_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

  // Run every query across every embedding in parallel — topic + level + unfiltered
  // for each of narrow/broad/keyword. ~9 small Pinecone calls, all concurrent.
  const queryPromises: Promise<{ bucket: 'filtered' | 'unfiltered' | 'level'; res: Response }>[] = []
  for (const embedding of embeddings) {
    if (topic) {
      queryPromises.push(
        pineconeFetch({ vector: embedding, topK, includeMetadata: true, filter: { topic: { $eq: topic } } })
          .then((res) => ({ bucket: 'filtered' as const, res }))
      )
    }
    queryPromises.push(
      pineconeFetch({ vector: embedding, topK, includeMetadata: true })
        .then((res) => ({ bucket: 'unfiltered' as const, res }))
    )
    if (level) {
      queryPromises.push(
        pineconeFetch({ vector: embedding, topK, includeMetadata: true, filter: { level: { $eq: level } } })
          .then((res) => ({ bucket: 'level' as const, res }))
      )
    }
  }

  const responses = await Promise.all(queryPromises)

  const filteredMatches: PineconeMatch[] = []
  const unfilteredMatches: PineconeMatch[] = []
  const levelMatches: PineconeMatch[] = []

  for (const { bucket, res } of responses) {
    if (!res.ok) continue
    const data = await res.json()
    const matches: PineconeMatch[] = data.matches || []
    if (bucket === 'filtered') filteredMatches.push(...matches)
    else if (bucket === 'level') levelMatches.push(...matches)
    else unfilteredMatches.push(...matches)
  }

  // De-dupe each bucket by vector id (or text fallback), keeping the highest
  // score. This is the "merge" step of multi-query retrieval — without it,
  // the same chunk would appear 3 times from 3 queries.
  const dedupe = (matches: PineconeMatch[]): PineconeMatch[] => {
    const best = new Map<string, PineconeMatch>()
    for (const m of matches) {
      const key = m.id || m.metadata?.text || JSON.stringify(m.metadata)
      const existing = best.get(key)
      if (!existing || m.score > existing.score) best.set(key, m)
    }
    return Array.from(best.values()).sort((a, b) => b.score - a.score)
  }
  const dedupedFiltered = dedupe(filteredMatches)
  const dedupedUnfiltered = dedupe(unfilteredMatches)
  const dedupedLevel = dedupe(levelMatches)

  const chunks: string[] = []
  const sources: { title: string; url: string; type: string }[] = []
  const seenUrls = new Set<string>()
  const seenTexts = new Set<string>()

  const addMatch = (m: { score: number; metadata: Record<string, string> }) => {
    if (m.score < MIN_PINECONE_SCORE) return
    const meta = m.metadata || {}
    const text = meta.text || ''
    if (seenTexts.has(text)) return
    seenTexts.add(text)

    const source = meta.source_title || (meta.source_type === 'newsletter' ? 'Consistency Club Newsletter' : '')
    const label = source ? `[From: ${source}]` : ''
    chunks.push(`${label}\n${text}`.trim())

    const url = meta.source_url || meta.video_url || ''
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url)
      sources.push({
        title: meta.source_title || 'Elijah Bryant',
        url,
        type: meta.source_type || 'video',
      })
    }
  }

  // Priority order: topic-filtered → level-matched → unfiltered. Cap at 6.
  for (const m of dedupedFiltered) {
    if (chunks.length >= 6) break
    addMatch(m)
  }
  for (const m of dedupedLevel) {
    if (chunks.length >= 6) break
    addMatch(m)
  }
  for (const m of dedupedUnfiltered) {
    if (chunks.length >= 6) break
    addMatch(m)
  }

  return { chunks, sources }
}

async function notifyElijah(
  questionId: string,
  question: string,
  draft: string,
  userEmail: string,
  playerContext: string
) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'
  const approveUrl = `${siteUrl}/approve/${questionId}?token=${process.env.CRON_SECRET}`

  await resend.emails.send({
    from: 'Ask Elijah <elijah@elijahbryant.pro>',
    to: process.env.ADMIN_EMAIL!,
    subject: `New question: "${question.slice(0, 60)}${question.length > 60 ? '...' : ''}"`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #111;">
        <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-bottom: 24px;">Ask Elijah / New Question</p>

        <div style="background: #f9f9f9; border-left: 3px solid #000; padding: 16px 20px; margin-bottom: 24px;">
          <p style="font-size: 13px; color: #666; margin: 0 0 4px;">From: ${userEmail}</p>
          <p style="font-size: 18px; font-weight: 600; margin: 0;">${question}</p>
        </div>

        ${playerContext ? `
        <div style="background: #f0f7ff; border-left: 3px solid #3b82f6; padding: 16px 20px; margin-bottom: 24px;">
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #3b82f6; margin: 0 0 10px;">What you know about this player</p>
          <pre style="font-size: 13px; color: #1e3a5f; line-height: 1.7; margin: 0; white-space: pre-wrap; font-family: -apple-system, sans-serif;">${playerContext}</pre>
        </div>` : ''}

        <a href="${approveUrl}" style="display: block; background: #ffffff; color: #000000; text-decoration: none; padding: 18px 28px; font-size: 16px; font-weight: 800; text-align: center; margin-bottom: 32px; border: 3px solid #000000;">
          ✏️ Review, Edit &amp; Send to ${userEmail} →
        </a>

        ${hasVerifyFlags(draft) ? `
        <div style="background: #fff8e1; border-left: 4px solid #f59e0b; padding: 14px 18px; margin-bottom: 20px; font-size: 13px; color: #78350f;">
          ⚠️ <strong>Flagged claims below need your review.</strong> Highlighted in yellow. Edit or confirm before sending.
        </div>` : ''}

        <p style="font-size: 13px; color: #666; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">AI Draft — click above to edit before sending</p>
        <div style="background: #f9f9f9; border-left: 3px solid #ccc; padding: 20px; margin-bottom: 32px; font-size: 15px; line-height: 1.7; color: #555;">
          ${highlightVerifyMarkers(draft).replace(/\n/g, '<br>')}
        </div>

        <a href="${approveUrl}" style="display: block; background: #ffffff; color: #000000; text-decoration: none; padding: 16px 28px; font-size: 14px; font-weight: 700; text-align: center; border: 3px solid #000000;">
          Open editor &amp; send →
        </a>

        <p style="font-size: 12px; color: #999; margin-top: 20px; text-align: center;">
          Only you see this. The user is waiting for your approved answer.
        </p>
      </div>
    `,
  })
}

async function addToBeehiiv(email: string) {
  const apiKey = process.env.BEEHIIV_API_KEY
  const pubId = process.env.BEEHIIV_PUBLICATION_ID
  if (!apiKey || !pubId) return

  await fetch(`https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email,
      reactivate_existing: false,
      send_welcome_email: true,
      utm_source: 'ask-elijah',
      utm_medium: 'email-gate',
      tags: ['acq:ask-elijah'],
    }),
  })
}

async function sendConfirmation(question: string, userEmail: string, newsletterOptIn: boolean) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'
  const supabase = getSupabase()

  const { data: confirmProfile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('email', userEmail.trim().toLowerCase())
    .single()
  const firstName = confirmProfile?.first_name || null

  await resend.emails.send({
    from: 'Elijah Bryant <elijah@elijahbryant.pro>',
      replyTo: 'ebb95@mac.com',
    to: userEmail,
    subject: 'Got your question. Working on it.',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;">
    <tr><td align="center" bgcolor="#000000" style="background-color:#000000;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td bgcolor="#000000" style="padding:48px 32px 32px;background-color:#000000;">
          <p style="text-align:center;margin:0 0 48px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" /></p>

          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Got your question.</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">Working on it.</p>

          ${firstName ? `<p style="font-size:15px;color:#ffffff !important;margin:0 0 24px;font-family:-apple-system,sans-serif;">Hey ${escapeHtml(firstName)}.</p>` : ''}

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:32px;">
            <p style="font-size:18px;font-weight:600;color:#ffffff !important;line-height:1.5;font-style:italic;margin:0;font-family:-apple-system,sans-serif;">"${question}"</p>
          </div>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">
            You already saw the first take on screen. That's based on everything I've put out on the mental side of the game.
          </p>

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:32px;">
            <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0;font-family:-apple-system,sans-serif;">
              I'm reviewing it personally. Once I sign off, the final version lands here. It may look different. That's the point.
            </p>
          </div>

          <p style="font-size:13px;margin:0 0 56px;font-family:-apple-system,sans-serif;">
            <a href="${siteUrl}/history" style="color:#555555;text-decoration:none;">View your first take →</a>
          </p>

          <p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p>
          <p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
  })
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'

    // Throttle 1: IP-based — protect against anonymous floods (5/day)
    const ipLimit = await checkLimit('rl:ask:ip', ip, 5, '1 d')
    if (!ipLimit.success) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    const { question, email, previewAnswer, newsletterOptIn, utm_source, utm_medium, utm_campaign, mode: rawMode, askerType: rawAskerType, level: rawLevel } = await req.json()

    const mode: EntryMode = (['bad_game', 'coach', 'playing_time', 'parent', 'general'] as const).includes(rawMode)
      ? (rawMode as EntryMode)
      : null
    const askerType: string | null = rawAskerType === 'parent' ? 'parent' : rawAskerType === 'player' ? 'player' : null
    const VALID_LEVELS = ['middle_school', 'jv', 'varsity', 'aau', 'college', 'pro', 'rec'] as const
    const clientLevel: string | null = typeof rawLevel === 'string' && (VALID_LEVELS as readonly string[]).includes(rawLevel)
      ? rawLevel
      : null

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question required' }, { status: 400 })
    }

    if (question.trim().length > 500) {
      return NextResponse.json({ error: 'Question too long (max 500 characters)' }, { status: 400 })
    }

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // Minimal email shape check
    const cleanEmailEarly = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmailEarly)) {
      return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
    }

    // Throttle 2: Email-based — protect our API budget (10/day per email).
    // This is the real cost guard: even behind rotating IPs, a single user
    // can't drain Claude/Voyage/Pinecone spend for a whole day.
    const emailLimit = await checkLimit('rl:ask:email', cleanEmailEarly, 10, '1 d')
    if (!emailLimit.success) {
      return NextResponse.json(
        { error: "You've hit today's limit. Come back tomorrow — Elijah will still be here." },
        { status: 429 }
      )
    }

    // Duplicate submission guard — same email within 2 minutes
    const supabaseCheck = getSupabase()
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const { data: recentQ } = await supabaseCheck
      .from('questions')
      .select('id')
      .eq('email', cleanEmailEarly)
      .gte('created_at', twoMinsAgo)
      .limit(1)
      .single()
    if (recentQ) {
      return NextResponse.json({ error: 'You just sent a question. Give Elijah a moment to work on it.' }, { status: 429 })
    }

    // Content moderation
    if (BLOCKED.some((p) => p.test(question))) {
      return NextResponse.json(
        { error: "That's not the kind of question I answer. Ask me something real about your game." },
        { status: 400 }
      )
    }

    // ip already declared above for rate limiting

    // Detect language + tag topic + tag trigger + fetch player context in parallel.
    // Starting playerContext NOW (not later) so it's ready before Claude draft generation
    // without blocking the request path.
    const playerContextPromise = getPlayerContext(email).catch((err) => {
      logError('ask:player-context', err, { email: cleanEmailEarly })
      return ''
    })

    // Determine level: prefer what the client sent (fresh from the chooser),
    // fall back to what's on the profile. If the client provided one and it
    // differs from profile, update the profile so it persists.
    const levelPromise = (async () => {
      if (clientLevel) {
        // Fire-and-forget upsert of level on the profile so subsequent asks
        // have it on hand without the client re-sending.
        void (async () => {
          try {
            const supabase = getSupabase()
            const { data: existing } = await supabase
              .from('profiles')
              .select('email, level')
              .eq('email', cleanEmailEarly)
              .single()
            if (existing) {
              if (existing.level !== clientLevel) {
                await supabase.from('profiles').update({ level: clientLevel }).eq('email', cleanEmailEarly)
              }
            } else {
              await supabase.from('profiles').insert({ email: cleanEmailEarly, level: clientLevel })
            }
          } catch (e) {
            await logError('ask:level-persist', e, { email: cleanEmailEarly })
          }
        })()
        return clientLevel
      }
      try {
        const { data } = await getSupabase()
          .from('profiles')
          .select('level')
          .eq('email', cleanEmailEarly)
          .single()
        return data?.level ?? null
      } catch {
        return null
      }
    })()

    const [{ language: detectedLanguage, englishTranslation }, topicResult, trigger] = await Promise.all([
      detectLanguage(question).catch(() => ({ language: 'English', englishTranslation: null })),
      tagTopic(question),
      tagTrigger(question),
    ])
    const { topic, confidence: topicConfidence } = topicResult
    const queryForEmbedding = englishTranslation || question

    // RAG lookup
    let ragContext = ''
    let hasChunks = false
    let sources: { title: string; url: string; type: string }[] = []
    try {
      // Multi-query rewrite → three semantic angles → embed each in parallel.
      // Hybrid-style retrieval without the reindex cost of true Pinecone sparse.
      const variants = await rewriteQueryMulti(queryForEmbedding)
      const toEmbed = Array.from(new Set([variants.narrow, variants.broad, variants.keyword]))
      const embeddings = await Promise.all(toEmbed.map((q) => embedQuestion(q)))
      const level = await levelPromise
      const result = await searchPinecone(embeddings, 5, topic, level)
      sources = result.sources
      if (result.chunks.length > 0) {
        hasChunks = true
        ragContext = `Here is relevant content from Elijah's YouTube videos and newsletters:\n\n${result.chunks.join('\n\n---\n\n')}\n\n`
      }
    } catch (ragErr) {
      logError('ask:rag-lookup', ragErr, { email: cleanEmailEarly })
    }

    const levelSnapshot = await levelPromise
    const needsFreshWeb = requiresFreshWeb(question)

    // If no relevant chunks and no preview answer, use fallback
    const FALLBACK = "I want to make sure I give you something real on this one. Try asking me again with a bit more detail about your situation and I'll find the right angle."
    if (!hasChunks && !previewAnswer?.trim() && !needsFreshWeb) {
      const supabase = getSupabase()
      const { data: record } = await supabase
        .from('questions')
        .insert({ question, answer: FALLBACK, ai_draft: FALLBACK, sources: [], ip, email: cleanEmailEarly, status: 'pending', topic: topic ?? null, topic_confidence: topicConfidence, trigger: trigger ?? null, language_detected: detectedLanguage !== 'English' ? detectedLanguage : null, utm_source: utm_source || null, utm_medium: utm_medium || null, utm_campaign: utm_campaign || null, mode, asker_type: askerType, level_snapshot: levelSnapshot })
        .select('id').single()
      const playerContext = await playerContextPromise
      if (record?.id) await notifyElijah(record.id, question, FALLBACK, email, playerContext).catch((e) => logError('ask:notify-elijah', e, { questionId: record.id }))
      await sendConfirmation(question, email, !!newsletterOptIn).catch((e) => logError('ask:send-confirmation', e, { email: cleanEmailEarly }))
      if (newsletterOptIn) await addToBeehiiv(cleanEmailEarly).catch((e) => logError('ask:beehiiv', e, { email: cleanEmailEarly }))
      // Fire-and-forget memory extraction
      extractMemories(question).then(memories => {
        if (memories.length && record?.id) {
          fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'}/api/memories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmailEarly, memories, source_question_id: record.id }),
          }).catch((e) => logError('ask:memories-post', e, { questionId: record.id }))
        }
      }).catch((e) => logError('ask:extract-memories', e, { email: cleanEmailEarly }))
      // Fire-and-forget founding-member check for new profiles
      void maybeMarkFoundingMember(cleanEmailEarly)
      return NextResponse.json({ success: true, questionId: record?.id, draft: null })
    }

    // Language instruction — use detected language from question content
    const langInstruction = detectedLanguage && detectedLanguage !== 'English'
      ? `\n\nIMPORTANT: The user wrote in ${detectedLanguage}. Respond entirely in ${detectedLanguage}.`
      : ''

    // Await player context so Claude can tailor the draft to this specific player
    const playerContext = await playerContextPromise

    const playerContextBlock = playerContext
      ? `CONTEXT ABOUT THIS PLAYER — use this to personalize your answer:\n${playerContext}\n\n---\n\n`
      : ''

    const freshnessInstruction = getFreshnessInstruction(question)
    const preamble = modePreamble(mode, askerType)
    const voiceAnchors = await getVoiceAnchors(topic)
    const userMessage = `${preamble}${voiceAnchors}${playerContextBlock}${ragContext}Now answer this question using the above context where relevant:\n\n${question}${freshnessInstruction}\n\nEvery answer must follow this standard: name what the player is feeling, explain why it happens in simple psychology/body language, connect it to Elijah's credible pro perspective, and end with a clear action plan they can do today. Keep the science simple enough for a young kid to understand but credible enough that it is clearly grounded.\n\nReturn only the words Elijah would say to the player. No preamble, no research-process narration, no "let me weave this together," no "here's the answer," no ChatGPT/LLM language. Start directly with the answer.`

    // Use preview answer if already generated on the frontend, otherwise generate fresh
    let draft = ''
    let webSources: WebSource[] = []
    if (previewAnswer?.trim() && !needsFreshWeb) {
      draft = previewAnswer.trim()
    } else {
      const generate = async (extraInstructions: string): Promise<{ text: string; webSources: WebSource[] }> => {
        const message = userMessage + langInstruction + extraInstructions
        try {
          const response = await getAnthropic().messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: 2000,
            system: SYSTEM_PROMPT,
            tools: [
              { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
              { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 5 },
            ],
            messages: [{ role: 'user', content: message }],
          })
          const textBlocks = response.content.filter(
            (b): b is Anthropic.Messages.TextBlock => b.type === 'text'
          )
          return {
            text: textBlocks.map((b) => b.text).join('\n\n').trim(),
            webSources: harvestWebSources(response.content),
          }
        } catch {
          // Fallback without web tools if Sonnet fails — better an un-sourced
          // answer than no answer.
          const response = await getAnthropic().messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: message }],
          })
          return {
            text: response.content[0].type === 'text' ? response.content[0].text : '',
            webSources: [],
          }
        }
      }

      const first = await generate('')
      draft = first.text
      webSources = first.webSources

      // If the draft came back valid, run it through the self-critique pass.
      // If the critic flags issues, regenerate once with those issues injected
      // as additional constraints. Capped at one retry to keep latency bounded.
      if (draft.trim() && draft.trim().length >= 30) {
        const critique = await critiqueDraft(stripVerifyMarkers(draft), question, hasChunks)
        if (!critique.ok && critique.issues.length > 0) {
          const issuesText = critique.issues.map((i) => `- ${i}`).join('\n')
          const retry = await generate(`\n\nYour first attempt had these specific issues — fix them in the rewrite:\n${issuesText}\n\nWrite the answer again addressing each.`)
          if (retry.text.trim() && retry.text.trim().length >= 30) {
            draft = retry.text
            webSources = retry.webSources
          }
        }
      }

      // If Claude returned empty for any reason, use the fallback
      if (!draft.trim() || draft.trim().length < 30) {
        draft = FALLBACK
      }
    }

    // Merge web sources harvested during generation with RAG sources from
    // Pinecone. Both get stored on the question so the player can see receipts.
    if (webSources.length > 0) {
      const seen = new Set(sources.map((s) => s.url))
      for (const ws of webSources) {
        if (!seen.has(ws.url)) {
          seen.add(ws.url)
          sources.push(ws)
        }
      }
    }

    // Save to Supabase as pending — strip verify markers from stored answer
    const supabase = getSupabase()
    const cleanDraft = sanitizeAnswerText(stripVerifyMarkers(draft))
    const { data: record, error: insertError } = await supabase
      .from('questions')
      .insert({
        question,
        answer: cleanDraft,
        ai_draft: cleanDraft,
        sources,
        ip,
        email: cleanEmailEarly,
        status: 'pending',
        topic: topic ?? null,
        topic_confidence: topicConfidence,
        trigger: trigger ?? null,
        language_detected: detectedLanguage !== 'English' ? detectedLanguage : null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        mode,
        asker_type: askerType,
        level_snapshot: levelSnapshot,
      })
      .select('id')
      .single()

    if (insertError) {
      await logError('ask:supabase-insert', insertError, { email: cleanEmailEarly })
      const { data: fallback } = await supabase
        .from('questions')
        .insert({ question, answer: draft, ai_draft: draft, sources, ip, email: cleanEmailEarly })
        .select('id')
        .single()

      const questionId = fallback?.id ?? null
      if (questionId) {
        await notifyElijah(questionId, question, draft, email, playerContext).catch((e) => logError('ask:notify-elijah', e, { questionId }))
      }
      await sendConfirmation(question, email, !!newsletterOptIn).catch((e) => logError('ask:send-confirmation', e, { email: cleanEmailEarly }))
      if (newsletterOptIn) await addToBeehiiv(cleanEmailEarly).catch((e) => logError('ask:beehiiv', e, { email: cleanEmailEarly }))
      return NextResponse.json({ success: true, questionId })
    }

    const questionId = record?.id ?? null

    // Notify Elijah + confirm to user
    if (questionId) {
      await notifyElijah(questionId, question, draft, email, playerContext).catch((e) => logError('ask:notify-elijah', e, { questionId }))
    }
    await sendConfirmation(question, email, !!newsletterOptIn).catch((e) => logError('ask:send-confirmation', e, { email: cleanEmailEarly }))
    if (newsletterOptIn) await addToBeehiiv(cleanEmailEarly).catch((e) => logError('ask:beehiiv', e, { email: cleanEmailEarly }))

    // Fire-and-forget memory extraction
    if (questionId) {
      extractMemories(question).then(memories => {
        if (memories.length) {
          fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'}/api/memories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmailEarly, memories, source_question_id: questionId }),
          }).catch((e) => logError('ask:memories-post', e, { questionId }))
        }
      }).catch((e) => logError('ask:extract-memories', e, { email: cleanEmailEarly }))
    }

    // Auto-flag first 30 signups as founding members (fire-and-forget)
    void maybeMarkFoundingMember(cleanEmailEarly)

    return NextResponse.json({ success: true, questionId, draft: cleanDraft })
  } catch (err) {
    await logError('ask:unexpected', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/**
 * If fewer than 30 profiles have `is_founding_member=true`, flag this email's
 * profile. Fire-and-forget, never throws.
 */
async function maybeMarkFoundingMember(email: string): Promise<void> {
  try {
    const supabase = getSupabase()
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_founding_member')
      .eq('email', email)
      .single()
    if (!profile || profile.is_founding_member) return

    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_founding_member', true)
    if ((count ?? 0) >= 30) return

    await supabase
      .from('profiles')
      .update({ is_founding_member: true })
      .eq('email', email)
  } catch (e) {
    await logError('ask:founding-member', e, { email })
  }
}
