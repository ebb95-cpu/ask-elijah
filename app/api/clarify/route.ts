import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { logError } from '@/lib/log-error'
import { getSupabase } from '@/lib/supabase-server'
import { sanitizeStudentFacingText } from '@/lib/answer-sanitize'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function getKnowledgeContext(question: string): Promise<string> {
  try {
    // Embed the question
    const embedRes = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: [question], model: 'voyage-3-lite' }),
    })
    if (!embedRes.ok) {
      await logError('clarify:voyage', `status ${embedRes.status}`)
      return ''
    }
    const embedData = await embedRes.json()
    const embedding = embedData.data[0].embedding

    // Query Pinecone for top 3 relevant chunks
    const pineconeRes = await fetch(`${process.env.PINECONE_HOST}/query`, {
      method: 'POST',
      headers: {
        'Api-Key': process.env.PINECONE_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vector: embedding, topK: 3, includeMetadata: true }),
    })
    if (!pineconeRes.ok) {
      await logError('clarify:pinecone', `status ${pineconeRes.status}`)
      return ''
    }
    const pineconeData = await pineconeRes.json()
    const matches = pineconeData.matches || []

    const chunks = matches
      .filter((m: { score: number; metadata: Record<string, string> }) => m.score > 0.5)
      .map((m: { metadata: Record<string, string> }) => m.metadata?.text || '')
      .filter(Boolean)
      .join('\n\n')

    return chunks
  } catch (err) {
    await logError('clarify:knowledge-context', err)
    return ''
  }
}

const MODE_GUIDANCE: Record<string, string> = {
  bad_game: `This player JUST had a bad game. Your clarifying question should be emotional, not tactical. Ask about what they felt, not what they did. Think: "How bad did it feel after?" or "Was this one game or a pattern?" Never ask "what do you want to work on" — they don't want a drill right now.`,
  coach: `This is a coach-situation question. Ask what the coach has actually said to them recently, or what the relationship looks like day-to-day. Avoid generic "have you talked to them" — dig into the specific dynamic.`,
  playing_time: `This is a playing-time question. Ask either: who's ahead of them on the depth chart, what's their role in practice, or what the coach has specifically told them they need to do. Pick the one that most unlocks the answer.`,
  parent: `This is from a parent asking about their kid. Ask one question that reveals what the parent is REALLY worried about underneath — is it their kid's happiness, their own disappointment, the coach, college exposure? Don't ask about drills or technique.`,
}

async function getFirstName(email?: string, providedName?: string): Promise<string | null> {
  const cleanProvided = providedName?.trim()
  if (cleanProvided) return cleanProvided.split(/\s+/)[0]
  const cleanEmail = email?.trim().toLowerCase()
  if (!cleanEmail) return null

  try {
    const { data } = await getSupabase()
      .from('profiles')
      .select('first_name, name')
      .eq('email', cleanEmail)
      .maybeSingle()
    const raw = (data?.first_name || data?.name || '').trim()
    return raw ? raw.split(/\s+/)[0] : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const { question, conversation, mode, email, firstName: providedFirstName } = await req.json()
  // conversation: [{ q: string, a: string }]

  if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 })

  const rounds = (conversation || []).length

  // After 3 rounds, always stop
  if (rounds >= 3) {
    return NextResponse.json({ done: true })
  }

  // Fetch knowledge base context in parallel with building conversation text
  const [knowledgeContext] = await Promise.all([
    getKnowledgeContext(question),
  ])
  const firstName = await getFirstName(email, providedFirstName)

  const conversationText = (conversation || [])
    .map((c: { q: string; a: string }) => `You asked: "${c.q}"\nThey said: "${c.a}"`)
    .join('\n\n')

  const knowledgeSection = knowledgeContext
    ? `Here is what you know and have said about this topic from your own content:\n\n${knowledgeContext}\n\n`
    : ''

  const modeSection = mode && MODE_GUIDANCE[mode]
    ? `\n\nENTRY MODE: ${mode}\n${MODE_GUIDANCE[mode]}\n`
    : ''

  const prompt = `A basketball player just sent you this question. You need to decide: do you have enough to give them a real, specific answer? Or is there one more thing you need to know first?${modeSection}

Player's question: "${question}"
${firstName ? `Player's first name: ${firstName}\n` : ''}
${conversationText ? `\nConversation so far:\n${conversationText}\n` : ''}
${knowledgeSection}
Your job: figure out what specific detail about THEIR situation would let you give the most targeted answer possible. Not general info — the one thing that changes how you'd respond.

Rules:
- If you have enough context, return done: true
- If you need one more thing, ask it in your natural voice — short, conversational, like a text
- If you know their first name, use it naturally in the first sentence
- Never ask more than one question
- Ask about their specific situation, not generic things like position or level
- Ask about: what exactly happened, what they felt, what they tried, what the relationship is like, what "bad" means to them
- Use your knowledge above to ask smarter questions — if you know your answer branches based on something specific, ask about that thing
- After 2 good rounds of answers, lean toward done: true
- Never use dash punctuation in the follow-up. No em dashes, no en dashes, and no spaced hyphens. Use commas, periods, or new sentences.

Return ONLY valid JSON. No other text.
Format: {"done": true} OR {"done": false, "followUp": "your question here"}`

  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}'
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean)

    if (parsed.done) {
      return NextResponse.json({ done: true })
    }

    return NextResponse.json({ done: false, followUp: sanitizeStudentFacingText(parsed.followUp || '') })
  } catch (err) {
    await logError('clarify:anthropic', err, { question: question.slice(0, 80) })
    // Signal failure explicitly so the frontend can show a toast AND still
    // let the user proceed rather than looping forever.
    return NextResponse.json({ done: true, fallback: true, reason: 'clarify_failed' }, { status: 200 })
  }
}
