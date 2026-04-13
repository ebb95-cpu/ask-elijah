// Streams a preview answer for the homepage — no DB, no email, just the answer
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'rl:preview',
})

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

async function searchPinecone(embedding: number[], topK = 5) {
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
    const source = meta.source_title || ''
    const label = source ? `[From: ${source}]` : ''
    chunks.push(`${label}\n${meta.text}`.trim())
  }
  return chunks
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
    const { success } = await ratelimit.limit(ip)
    if (!success) return new Response('Too many requests. Try again later.', { status: 429 })

    const { question, profile, memories } = await req.json()
    if (!question?.trim()) return new Response('Question required', { status: 400 })
    if (question.trim().length > 500) return new Response('Question too long (max 500 characters)', { status: 400 })

    const profileParts: string[] = []
    if (profile?.position) profileParts.push(`Position: ${profile.position}`)
    if (profile?.level) profileParts.push(`Level: ${profile.level}`)
    if (profile?.country) profileParts.push(`Country: ${profile.country}`)
    if (profile?.challenge) profileParts.push(`Biggest challenge: ${profile.challenge}`)

    const memoryParts: string[] = (memories || []).map((m: { fact_type: string; fact_text: string }) => `- [${m.fact_type}] ${m.fact_text}`)

    const profileContext = [
      profileParts.length ? `\n\nContext about this player: ${profileParts.join(', ')}.` : '',
      memoryParts.length ? `\n\nWhat I remember about this player:\n${memoryParts.join('\n')}` : '',
    ].join('')

    let ragContext = ''
    let hasChunks = false
    try {
      const embedding = await embedQuestion(question)
      const chunks = await searchPinecone(embedding)
      if (chunks.length > 0) {
        hasChunks = true
        ragContext = `Here is relevant content from Elijah's YouTube videos and newsletters:\n\n${chunks.join('\n\n---\n\n')}\n\n`
      }
    } catch {
      // RAG failed — treat as no chunks
    }

    // If no relevant content found in Elijah's knowledge base, stream a fallback
    if (!hasChunks) {
      const encoder = new TextEncoder()
      const fallback = "I want to make sure I give you something real on this one. Try asking me again with a bit more detail about your situation and I'll find the right angle."
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(fallback))
          controller.close()
        }
      })
      return new Response(readable, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }
      })
    }

    const userMessage = `${ragContext}Now answer this question using the above context where relevant:\n\n${question}${profileContext}`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const stream = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
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
    console.error('Preview error:', err)
    return new Response('Something went wrong', { status: 500 })
  }
}
