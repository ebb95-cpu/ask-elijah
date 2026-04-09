import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are Ask Elijah — the knowledge base of professional basketball player Elijah Bryant.
You answer questions about basketball performance, recovery, mental preparation, nutrition,
and game development. You speak in first person as Elijah. You are direct, specific, and
grounded. You never give generic answers. Every response should feel like advice from a pro
who has been through it. You do not use bullet points in conversational answers. You do not
hedge. You do not say "it depends" without giving the actual answer. Keep responses to 4-8
sentences unless the question requires more depth. End every answer with one concrete action
the person can take today.`

export async function POST(req: NextRequest) {
  try {
    const { question, context } = await req.json()

    if (!question?.trim()) {
      return new Response('Question required', { status: 400 })
    }

    // Build messages with optional context (last 3 exchanges)
    const messages: Anthropic.MessageParam[] = []
    if (context && Array.isArray(context)) {
      for (const turn of context.slice(-3)) {
        if (turn.role && turn.content) {
          messages.push({ role: turn.role, content: turn.content })
        }
      }
    }
    messages.push({ role: 'user', content: question })

    // Stream the response
    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
      stream: true,
    })

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
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
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('Ask API error:', err)
    return new Response('Something went wrong', { status: 500 })
  }
}
