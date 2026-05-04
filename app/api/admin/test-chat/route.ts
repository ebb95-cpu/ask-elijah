import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { sanitizeAnswerText } from '@/lib/answer-sanitize'
import { getElijahPreferenceContext } from '@/lib/elijah-learning'
import { getFreshnessInstruction } from '@/lib/freshness'
import { logError } from '@/lib/log-error'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'

export const maxDuration = 60

type TestProfile = {
  age?: string
  level?: string
  position?: string
  challenge?: string
}

type Source = {
  title: string
  url: string
  type: string
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
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

async function searchPinecone(embedding: number[], topK = 5): Promise<{ chunks: string[]; sources: Source[] }> {
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
  const sources: Source[] = []
  const seenUrls = new Set<string>()

  for (const match of data.matches || []) {
    if (match.score < 0.3) continue
    const meta = match.metadata || {}
    const text = typeof meta.text === 'string' ? meta.text : ''
    if (!text) continue

    const source = typeof meta.source_title === 'string' ? meta.source_title : ''
    const label = source ? `[From: ${source}]` : ''
    chunks.push(`${label}\n${text}`.trim())

    const url = meta.source_url || meta.video_url
    if (typeof url === 'string' && url && !seenUrls.has(url)) {
      seenUrls.add(url)
      sources.push({
        title: source || 'Elijah Bryant',
        url,
        type: typeof meta.source_type === 'string' ? meta.source_type : 'knowledge',
      })
    }
  }

  return { chunks, sources }
}

function getProfileContext(profile: TestProfile) {
  const parts = [
    profile.age ? `Age: ${profile.age}` : null,
    profile.level ? `Level: ${profile.level}` : null,
    profile.position ? `Position: ${profile.position}` : null,
    profile.challenge ? `Current challenge: ${profile.challenge}` : null,
  ].filter(Boolean)

  return parts.length ? `TEST STUDENT PROFILE\n${parts.join('\n')}\n\n---\n\n` : ''
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  try {
    const { question, profile } = await req.json()
    const cleanQuestion = typeof question === 'string' ? question.trim() : ''
    if (!cleanQuestion) return NextResponse.json({ error: 'Question required' }, { status: 400 })
    if (cleanQuestion.length > 500) {
      return NextResponse.json({ error: 'Question too long (max 500 characters)' }, { status: 400 })
    }

    let ragContext = ''
    let sources: Source[] = []

    try {
      const embedding = await embedQuestion(cleanQuestion)
      const result = await searchPinecone(embedding)
      sources = result.sources
      if (result.chunks.length > 0) {
        ragContext = `Here is relevant content from Elijah's YouTube videos and newsletters:\n\n${result.chunks.join('\n\n---\n\n')}\n\n`
      }
    } catch (err) {
      await logError('admin:test-chat:rag', err, { question: cleanQuestion.slice(0, 120) })
    }

    const profileContext = getProfileContext((profile || {}) as TestProfile)
    const preferenceContext = await getElijahPreferenceContext()
    const freshnessInstruction = getFreshnessInstruction(cleanQuestion)
    const message = `${profileContext}${ragContext}${preferenceContext}Answer this test question as Elijah would answer a player:

${cleanQuestion}${freshnessInstruction}

This is an admin-only sandbox test. Do not mention that it is a test. Do not save anything. Do not ask for an email.

Every answer must name what the player is feeling, explain why it happens in simple psychology/body language, connect it to Elijah's credible pro perspective, and end with one clear action plan they can do today.

Return only the words Elijah would say to the player. No preamble, no research-process narration, no "here's the answer," no ChatGPT/LLM language. Start directly with the answer. Never use dash punctuation. No em dashes, no en dashes, and no spaced hyphens.`

    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
    })
    const draft = response.content
      .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n\n')
      .trim()

    return NextResponse.json({
      answer: sanitizeAnswerText(draft || "I want to make sure I give you something real on this one. Ask it with a little more detail and I'll find the right angle."),
      sources,
    })
  } catch (err) {
    await logError('admin:test-chat', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
