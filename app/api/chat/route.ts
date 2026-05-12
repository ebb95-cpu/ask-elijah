import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { checkLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

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

async function searchPinecone(embedding: number[], topK = 5): Promise<string[]> {
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
  for (const m of data.matches || []) {
    if (m.score < 0.3) continue
    const meta = m.metadata || {}
    const source = meta.source_title ? `[From: ${meta.source_title}]` : ''
    chunks.push(`${source}\n${meta.text}`.trim())
  }
  return chunks
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'

    const body = await req.json()
    const {
      question,
      conversation = [],
      email,
      profile,
    } = body as {
      question: string
      conversation: { role: 'user' | 'assistant'; content: string }[]
      email?: string
      profile?: { firstName?: string; position?: string; level?: string; country?: string }
    }

    if (!question?.trim()) return new Response('Question required', { status: 400 })

    // Rate limit per email and IP
    const limitKey = email ? `rl:chat:email:${email}` : `rl:chat:ip:${ip}`
    const { success } = await checkLimit(limitKey, email || ip, 20, '1 h')
    if (!success) {
      return new Response("You've been going deep. Try one of the moves first, then come back.", { status: 429 })
    }

    // Profile context
    const profileParts: string[] = []
    if (profile?.firstName) profileParts.push(`First name: ${profile.firstName}`)
    if (profile?.position) profileParts.push(`Position: ${profile.position}`)
    if (profile?.level) profileParts.push(`Level: ${profile.level}`)
    if (profile?.country) profileParts.push(`Country: ${profile.country}`)
    const profileContext = profileParts.length
      ? `\n\nContext about this player: ${profileParts.join(', ')}.`
      : ''

    // RAG on the question
    let ragContext = ''
    try {
      const embedding = await embedQuestion(question)
      const chunks = await searchPinecone(embedding)
      if (chunks.length > 0) {
        ragContext = `Here is relevant content from Elijah's YouTube videos and newsletters:\n\n${chunks.join('\n\n---\n\n')}\n\n`
      }
    } catch {
      // RAG failed — proceed without it
    }

    // Build message history for Claude
    // The follow-up question is embedded at the end of every answer using a delimiter
    const FOLLOW_UP_INSTRUCTION = `\n\nAfter your answer, write exactly "|||" on its own line, then write one short follow-up question (max 15 words) that would help you give a more specific answer. Make it sound like you're texting them in the locker room. For example: "What position do you play?", "Is this more in games or practice?", "How long has this been going on?"`

    const messages: { role: 'user' | 'assistant'; content: string }[] = []

    if (conversation.length === 0) {
      // First message
      messages.push({
        role: 'user',
        content: `${ragContext}Answer this question:\n\n${question}${profileContext}${FOLLOW_UP_INSTRUCTION}`,
      })
    } else {
      // Rebuild full conversation — re-inject RAG on first turn only
      for (let i = 0; i < conversation.length; i++) {
        const msg = conversation[i]
        if (i === 0 && msg.role === 'user') {
          messages.push({
            role: 'user',
            content: `${ragContext}Answer this question:\n\n${msg.content}${profileContext}${FOLLOW_UP_INSTRUCTION}`,
          })
        } else {
          messages.push({ role: msg.role, content: msg.content })
        }
      }
      // New message from user — no need to repeat RAG or instructions
      messages.push({ role: 'user', content: question })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const stream = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages,
      stream: true,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('Chat error:', err)
    return new Response('Something went wrong', { status: 500 })
  }
}
