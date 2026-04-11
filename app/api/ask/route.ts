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
  userEmail: string
) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'
  const approveUrl = `${siteUrl}/approve/${questionId}?token=${process.env.CRON_SECRET}`

  await resend.emails.send({
    from: 'Ask Elijah <onboarding@resend.dev>',
    to: process.env.ADMIN_EMAIL!,
    subject: `New question: "${question.slice(0, 60)}${question.length > 60 ? '...' : ''}"`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #111;">
        <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-bottom: 24px;">Ask Elijah — New Question</p>

        <div style="background: #f9f9f9; border-left: 3px solid #000; padding: 16px 20px; margin-bottom: 24px;">
          <p style="font-size: 13px; color: #666; margin: 0 0 4px;">From: ${userEmail}</p>
          <p style="font-size: 18px; font-weight: 600; margin: 0;">${question}</p>
        </div>

        <!-- Big CTA at the top so it's impossible to miss -->
        <a href="${approveUrl}" style="display: block; background: #ffffff; color: #000000; text-decoration: none; padding: 18px 28px; font-size: 16px; font-weight: 800; text-align: center; margin-bottom: 32px; border: 3px solid #000000;">
          ✏️ Review, Edit &amp; Send to ${userEmail} →
        </a>

        ${hasVerifyFlags(draft) ? `
        <div style="background: #fff8e1; border-left: 4px solid #f59e0b; padding: 14px 18px; margin-bottom: 20px; font-size: 13px; color: #78350f;">
          ⚠️ <strong>Flagged claims below need your review</strong> — highlighted in yellow. Edit or confirm before sending.
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

async function sendConfirmation(question: string, userEmail: string) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'

  await resend.emails.send({
    from: 'Elijah Bryant <onboarding@resend.dev>',
    to: userEmail,
    subject: 'Elijah got your question.',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 48px 24px; color: #111; background: #fff;">

        <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 40px;">
          <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
          <div style="width: 24px; height: 1.5px; background: #000;"></div>
          <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
          <div style="width: 24px; height: 1.5px; background: #000;"></div>
          <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
        </div>

        <p style="font-size: 26px; font-weight: 800; line-height: 1.2; margin: 0 0 8px; color: #000;">
          Your question is with Elijah.
        </p>
        <p style="font-size: 15px; color: #666; margin: 0 0 32px; line-height: 1.5;">
          He reads every single one personally.
        </p>

        <div style="background: #f7f7f7; border-left: 3px solid #000; padding: 16px 20px; margin-bottom: 32px;">
          <p style="font-size: 13px; color: #999; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.06em;">You asked</p>
          <p style="font-size: 17px; font-weight: 600; margin: 0; color: #000; line-height: 1.4;">${question}</p>
        </div>

        <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 12px;">
          Most players spend years searching YouTube for answers that were never made for their situation.
        </p>
        <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 12px;">
          What you just did is different. Elijah has been in NBA locker rooms, Euroleague finals, and high-pressure moments most coaches have only watched on TV. He's going to answer your specific question with what he actually knows.
        </p>
        <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 32px;">
          Expect his answer in your inbox within 48 hours.
        </p>

        <a href="${siteUrl}/browse" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: 700; margin-bottom: 40px;">
          See what other players are asking →
        </a>

        <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 24px;" />

        <p style="font-size: 12px; color: #bbb; line-height: 1.6; margin: 0;">
          You'll only hear from us when Elijah has answered. No newsletters. No spam.
        </p>

      </div>
    `,
  })
}

export async function POST(req: NextRequest) {
  try {
    const { question, email, language, previewAnswer } = await req.json()

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

    // If no relevant chunks and no preview answer, use fallback
    const FALLBACK = "I want to make sure I give you something real on this one. Try asking me again with a bit more detail about your situation and I'll find the right angle."
    if (!hasChunks && !previewAnswer?.trim()) {
      // Save fallback to Supabase and notify
      const supabase = getSupabase()
      const { data: record } = await supabase
        .from('questions')
        .insert({ question, answer: FALLBACK, sources: [], ip, email: email.trim().toLowerCase(), status: 'pending' })
        .select('id').single()
      if (record?.id) await notifyElijah(record.id, question, FALLBACK, email).catch(console.error)
      await sendConfirmation(question, email).catch(console.error)
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

    if (insertError) {
      console.error('Supabase insert error:', insertError)
      // Try without status column in case it doesn't exist yet
      const { data: fallback } = await supabase
        .from('questions')
        .insert({ question, answer: draft, sources, ip, email: email.trim().toLowerCase() })
        .select('id')
        .single()

      const questionId = fallback?.id ?? null
      if (questionId) {
        await notifyElijah(questionId, question, draft, email).catch(console.error)
      }
      await sendConfirmation(question, email).catch(console.error)
      return NextResponse.json({ success: true, questionId })
    }

    const questionId = record?.id ?? null

    // Notify Elijah + confirm to user
    if (questionId) {
      await notifyElijah(questionId, question, draft, email).catch(console.error)
    }
    await sendConfirmation(question, email).catch(console.error)

    return NextResponse.json({ success: true, questionId })
  } catch (err) {
    console.error('Ask API error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
