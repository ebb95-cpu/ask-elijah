import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(5, '1 d'),
  prefix: 'rl:ask',
})

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
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

async function tagTopic(question: string): Promise<Topic | null> {
  try {
    const res = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 20,
      messages: [{
        role: 'user',
        content: `Categorize this basketball player's mental performance question with exactly one of these tags: confidence, pressure, consistency, focus, slump, coaching, team, mindset, motivation, identity.

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

Reply with only the single tag word.`,
      }],
    })
    const tag = res.content[0].type === 'text' ? res.content[0].text.trim().toLowerCase() : ''
    return (TOPICS as readonly string[]).includes(tag) ? tag as Topic : null
  } catch {
    return null
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

// Fetch player context for admin email
async function getPlayerContext(email: string): Promise<string> {
  const supabase = getSupabase()
  const clean = email.toLowerCase()
  const now = new Date().toISOString()

  const [profileRes, memoriesRes, historyRes] = await Promise.all([
    supabase.from('profiles').select('position, level, country, challenge').eq('email', clean).single(),
    supabase.from('player_memories').select('fact_type, fact_text').eq('email', clean).or(`expires_at.is.null,expires_at.gt.${now}`).order('created_at', { ascending: false }).limit(10),
    supabase.from('questions').select('question, answer').eq('email', clean).eq('status', 'approved').order('updated_at', { ascending: false }).limit(3),
  ])

  const lines: string[] = []

  const p = profileRes.data
  if (p) {
    const parts = [p.position, p.level, p.country, p.challenge ? `struggles with ${p.challenge}` : null].filter(Boolean)
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

async function searchPinecone(embedding: number[], topK = 5): Promise<{
  chunks: string[]
  sources: { title: string; url: string; type: string }[]
}> {
  const res = await fetch(`${process.env.PINECONE_HOST}/query`, {
    method: 'POST',
    headers: {
      'Api-Key': process.env.PINECONE_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ vector: embedding, topK, includeMetadata: true }),
  })
  if (!res.ok) throw new Error(`Pinecone query failed: ${res.status}`)
  const data = await res.json()

  const chunks: string[] = []
  const sources: { title: string; url: string; type: string }[] = []
  const seen = new Set<string>()

  for (const m of data.matches || []) {
    if (m.score < 0.3) continue
    const meta = m.metadata || {}
    const source = meta.source_title || (meta.source_type === 'newsletter' ? 'Consistency Club Newsletter' : '')
    const label = source ? `[From: ${source}]` : ''
    chunks.push(`${label}\n${meta.text}`.trim())

    const url = meta.source_url || meta.video_url || ''
    if (url && !seen.has(url)) {
      seen.add(url)
      sources.push({
        title: meta.source_title || 'Elijah Bryant',
        url,
        type: meta.source_type || 'video',
      })
    }
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
    subject: 'Got it. Reading it now.',
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

          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Got it.</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">Reading it now.</p>

          ${firstName ? `<p style="font-size:15px;color:#ffffff !important;margin:0 0 24px;font-family:-apple-system,sans-serif;">Hey ${firstName}.</p>` : ''}

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:48px;">
            <p style="font-size:18px;font-weight:600;color:#ffffff !important;line-height:1.5;font-style:italic;margin:0;font-family:-apple-system,sans-serif;">"${question}"</p>
          </div>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 40px;font-family:-apple-system,sans-serif;">
            Give me some time with it. I'll write back when I have something real to say.
          </p>

          <p style="font-size:18px;font-weight:700;margin:0 0 56px;font-family:-apple-system,sans-serif;">
            <a href="${siteUrl}/history" style="color:#ffffff !important;text-decoration:none;">Track your question →</a>
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
    const { success } = await ratelimit.limit(ip)
    if (!success) return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })

    const { question, email, previewAnswer, newsletterOptIn, utm_source, utm_medium, utm_campaign } = await req.json()

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question required' }, { status: 400 })
    }

    if (question.trim().length > 500) {
      return NextResponse.json({ error: 'Question too long (max 500 characters)' }, { status: 400 })
    }

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // Content moderation
    if (BLOCKED.some((p) => p.test(question))) {
      return NextResponse.json(
        { error: "That's not the kind of question I answer. Ask me something real about your game." },
        { status: 400 }
      )
    }

    // ip already declared above for rate limiting

    // Detect language + tag topic + tag trigger in parallel
    const [{ language: detectedLanguage, englishTranslation }, topic, trigger] = await Promise.all([
      detectLanguage(question).catch(() => ({ language: 'English', englishTranslation: null })),
      tagTopic(question),
      tagTrigger(question),
    ])
    const queryForEmbedding = englishTranslation || question

    // RAG lookup
    let ragContext = ''
    let hasChunks = false
    let sources: { title: string; url: string; type: string }[] = []
    try {
      const embedding = await embedQuestion(queryForEmbedding)
      const result = await searchPinecone(embedding)
      sources = result.sources
      if (result.chunks.length > 0) {
        hasChunks = true
        ragContext = `Here is relevant content from Elijah's YouTube videos and newsletters:\n\n${result.chunks.join('\n\n---\n\n')}\n\n`
      }
    } catch (ragErr) {
      console.warn('RAG lookup failed:', ragErr)
    }

    // Fetch player context early so it's ready for Claude draft generation
    const playerContextPromise = getPlayerContext(email).catch(() => '')

    // If no relevant chunks and no preview answer, use fallback
    const FALLBACK = "I want to make sure I give you something real on this one. Try asking me again with a bit more detail about your situation and I'll find the right angle."
    if (!hasChunks && !previewAnswer?.trim()) {
      const supabase = getSupabase()
      const { data: record } = await supabase
        .from('questions')
        .insert({ question, answer: FALLBACK, sources: [], ip, email: email.trim().toLowerCase(), status: 'pending', topic: topic ?? null, trigger: trigger ?? null, language_detected: detectedLanguage !== 'English' ? detectedLanguage : null, utm_source: utm_source || null, utm_medium: utm_medium || null, utm_campaign: utm_campaign || null })
        .select('id').single()
      const playerContext = await playerContextPromise
      if (record?.id) await notifyElijah(record.id, question, FALLBACK, email, playerContext).catch(console.error)
      await sendConfirmation(question, email, !!newsletterOptIn).catch(console.error)
      if (newsletterOptIn) await addToBeehiiv(email.trim().toLowerCase()).catch(console.error)
      // Fire-and-forget memory extraction
      extractMemories(question).then(memories => {
        if (memories.length && record?.id) {
          fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'}/api/memories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim().toLowerCase(), memories, source_question_id: record.id }),
          }).catch(() => {})
        }
      }).catch(() => {})
      return NextResponse.json({ success: true, questionId: record?.id })
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

    const userMessage = `${playerContextBlock}${ragContext}Now answer this question using the above context where relevant:\n\n${question}`

    // Use preview answer if already generated on the frontend, otherwise generate fresh
    let draft = ''
    if (previewAnswer?.trim()) {
      draft = previewAnswer.trim()
    } else {
      try {
        const response = await getAnthropic().messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage + langInstruction }],
        })
        draft = response.content[0].type === 'text' ? response.content[0].text : ''
      } catch {
        const response = await getAnthropic().messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage + langInstruction }],
        })
        draft = response.content[0].type === 'text' ? response.content[0].text : ''
      }
    }

    // Save to Supabase as pending — strip verify markers from stored answer
    const supabase = getSupabase()
    const { data: record, error: insertError } = await supabase
      .from('questions')
      .insert({
        question,
        answer: stripVerifyMarkers(draft),
        sources,
        ip,
        email: email.trim().toLowerCase(),
        status: 'pending',
        topic: topic ?? null,
        trigger: trigger ?? null,
        language_detected: detectedLanguage !== 'English' ? detectedLanguage : null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
      })
      .select('id')
      .single()

    const cleanEmail = email.trim().toLowerCase()

    if (insertError) {
      console.error('Supabase insert error:', insertError)
      const { data: fallback } = await supabase
        .from('questions')
        .insert({ question, answer: draft, sources, ip, email: cleanEmail })
        .select('id')
        .single()

      const questionId = fallback?.id ?? null
      if (questionId) {
        await notifyElijah(questionId, question, draft, email, playerContext).catch(console.error)
      }
        await sendConfirmation(question, email, !!newsletterOptIn).catch(console.error)
      if (newsletterOptIn) await addToBeehiiv(cleanEmail).catch(console.error)
      return NextResponse.json({ success: true, questionId })
    }

    const questionId = record?.id ?? null

    // Notify Elijah + confirm to user
    if (questionId) {
      await notifyElijah(questionId, question, draft, email, playerContext).catch(console.error)
    }
    await sendConfirmation(question, email, !!newsletterOptIn).catch(console.error)
    if (newsletterOptIn) await addToBeehiiv(cleanEmail).catch(console.error)

    // Fire-and-forget memory extraction
    if (questionId) {
      extractMemories(question).then(memories => {
        if (memories.length) {
          fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'}/api/memories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim().toLowerCase(), memories, source_question_id: questionId }),
          }).catch(() => {})
        }
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, questionId })
  } catch (err) {
    console.error('Ask API error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
