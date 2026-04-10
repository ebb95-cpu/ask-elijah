// Test-only streaming endpoint — not for public use

import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase-server'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'

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
      sources.push({ title: meta.source_title || 'Elijah Bryant', url, type: meta.source_type || 'video' })
    }
  }
  return { chunks, sources }
}

export async function POST(req: NextRequest) {
  try {
    const { question, language } = await req.json()
    if (!question?.trim()) return new Response('Question required', { status: 400 })

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'test'

    let ragContext = ''
    let sources: { title: string; url: string; type: string }[] = []
    try {
      const embedding = await embedQuestion(question)
      const result = await searchPinecone(embedding)
      sources = result.sources
      if (result.chunks.length > 0) {
        ragContext = `Here is relevant content from Elijah's YouTube videos and newsletters:\n\n${result.chunks.join('\n\n---\n\n')}\n\n`
      }
    } catch (ragErr) {
      console.warn('RAG lookup failed:', ragErr)
    }

    const langMap: Record<string, string> = {
      tr: 'Turkish', he: 'Hebrew', el: 'Greek', sr: 'Serbian',
    }
    const langName = langMap[language] || null
    const langInstruction = langName ? `\n\nIMPORTANT: Respond entirely in ${langName}.` : ''
    const userMessage = ragContext
      ? `${ragContext}Now answer this question using the above context where relevant:\n\n${question}`
      : question

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    let stream
    try {
      stream = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage + langInstruction }],
        stream: true,
      })
    } catch {
      stream = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage + langInstruction }],
        stream: true,
      })
    }

    const encoder = new TextEncoder()
    let fullAnswer = ''

    const supabase = getSupabase()
    const { data: preInsert } = await supabase
      .from('questions')
      .insert({ question, answer: '', sources, ip, email: process.env.ADMIN_EMAIL || 'test' })
      .select('id')
      .single()
    const preId = preInsert?.id ?? null

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullAnswer += event.delta.text
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          controller.close()
          if (preId) {
            await supabase.from('questions').update({ answer: fullAnswer }).eq('id', preId)
          }
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
        'X-Accel-Buffering': 'no',
        'X-Question-Id': preId ?? '',
      },
    })
  } catch (err) {
    console.error('Test ask error:', err)
    return new Response('Something went wrong', { status: 500 })
  }
}
