import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'

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
    }),
  })
}

async function sendWelcome(userEmail: string) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'

  await resend.emails.send({
    from: 'Elijah Bryant <elijah@elijahbryant.pro>',
    to: userEmail,
    subject: 'You just did something most players never do.',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 48px 24px; color: #111; background: #fff;">

        <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 40px;">
          <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
          <div style="width: 24px; height: 1.5px; background: #000;"></div>
          <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
          <div style="width: 24px; height: 1.5px; background: #000;"></div>
          <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
        </div>

        <p style="font-size: 26px; font-weight: 800; line-height: 1.2; margin: 0 0 24px; color: #000;">
          Welcome. Elijah's already in your corner.
        </p>

        <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 16px;">
          Most players carry their questions alone. The doubt, the slumps, the stuff they can't talk to their coach about. They just push through and hope it gets better.
        </p>

        <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 28px;">
          You just did something different. You asked.
        </p>

        <div style="background: #f7f7f7; border-left: 3px solid #000; padding: 16px 20px; margin-bottom: 28px;">
          <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0;">
            Every question you send goes directly to Elijah. He reads it. He writes back. Not a template. Your situation, specifically.
          </p>
        </div>

        <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 32px;">
          While you wait for your first answer, take 2 minutes and fill out your profile. The more Elijah knows about you, the sharper his answer.
        </p>

        <a href="${siteUrl}/profile" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: 700; margin-bottom: 40px;">
          Complete your profile →
        </a>

        <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 24px;" />

        <p style="font-size: 12px; color: #bbb; line-height: 1.6; margin: 0;">
          You'll hear from Elijah when your answer is ready. That's it.
        </p>

      </div>
    `,
  })
}

async function sendConfirmation(question: string, userEmail: string, newsletterOptIn: boolean) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'

  await resend.emails.send({
    from: 'Elijah Bryant <elijah@elijahbryant.pro>',
    to: userEmail,
    subject: 'Something most players never get.',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 48px 24px; color: #111; background: #fff;">

        <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 40px;">
          <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
          <div style="width: 24px; height: 1.5px; background: #000;"></div>
          <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
          <div style="width: 24px; height: 1.5px; background: #000;"></div>
          <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
        </div>

        <p style="font-size: 26px; font-weight: 800; line-height: 1.2; margin: 0 0 24px; color: #000;">
          Got it. Elijah's on it.
        </p>

        <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 16px;">
          Most players never ask. They just keep hoping it gets better. You didn't do that.
        </p>

        <div style="background: #f7f7f7; border-left: 3px solid #000; padding: 16px 20px; margin-bottom: 28px;">
          <p style="font-size: 13px; color: #999; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.06em;">You asked</p>
          <p style="font-size: 17px; font-weight: 600; margin: 0; color: #000; line-height: 1.4;">${question}</p>
        </div>

        <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 16px;">
          Elijah reads every question personally. Not a template. Not a bot. He's been in NBA locker rooms and Euroleague finals. He's going to answer your situation specifically.
        </p>

        <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 16px;">
          His answer lands within 48 hours. Read it twice when it does. Then go do it.
        </p>

        <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 32px;">
          While you wait, someone else on your team is already working on the same problem. One answer, actually applied, can change a whole season.
        </p>

        <a href="${siteUrl}/browse" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: 700; margin-bottom: 40px;">
          See what other players are asking →
        </a>

        <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 24px;" />

        <p style="font-size: 12px; color: #bbb; line-height: 1.6; margin: 0;">
          ${newsletterOptIn
            ? "You'll get Elijah's answer plus his weekly breakdowns. Unsubscribe anytime."
            : "You'll only hear from us when Elijah has answered. That's it."}
        </p>

      </div>
    `,
  })
}

export async function POST(req: NextRequest) {
  try {
    const { question, email, language, previewAnswer, newsletterOptIn } = await req.json()

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question required' }, { status: 400 })
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

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'

    // RAG lookup
    let ragContext = ''
    let hasChunks = false
    let sources: { title: string; url: string; type: string }[] = []
    try {
      const embedding = await embedQuestion(question)
      const result = await searchPinecone(embedding)
      sources = result.sources
      if (result.chunks.length > 0) {
        hasChunks = true
        ragContext = `Here is relevant content from Elijah's YouTube videos and newsletters:\n\n${result.chunks.join('\n\n---\n\n')}\n\n`
      }
    } catch (ragErr) {
      console.warn('RAG lookup failed:', ragErr)
    }

    // Fetch player context + extract memories in parallel (non-blocking for fallback path)
    const playerContextPromise = getPlayerContext(email).catch(() => '')

    // If no relevant chunks and no preview answer, use fallback
    const FALLBACK = "I want to make sure I give you something real on this one. Try asking me again with a bit more detail about your situation and I'll find the right angle."
    if (!hasChunks && !previewAnswer?.trim()) {
      const supabase = getSupabase()
      const { data: record } = await supabase
        .from('questions')
        .insert({ question, answer: FALLBACK, sources: [], ip, email: email.trim().toLowerCase(), status: 'pending' })
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

    // Language instruction
    const langMap: Record<string, string> = {
      tr: 'Turkish', he: 'Hebrew', el: 'Greek', sr: 'Serbian',
      es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese',
      it: 'Italian', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
    }
    const langName = langMap[language] || null
    const langInstruction = langName
      ? `\n\nIMPORTANT: The user's language is ${langName}. Respond entirely in ${langName}.`
      : ''

    const userMessage = `${ragContext}Now answer this question using the above context where relevant:\n\n${question}`

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
      })
      .select('id')
      .single()

    const playerContext = await playerContextPromise

    // Check if this is their first question
    const cleanEmail = email.trim().toLowerCase()
    const { count: prevCount } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('email', cleanEmail)
    const isFirstQuestion = (prevCount ?? 0) <= 1

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
