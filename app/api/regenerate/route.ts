import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { checkLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log-error'

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-token')
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admin-only endpoint, but still rate-limit to stop accidental spam
  // (e.g. a runaway UI retry loop). 30 regens/hour is plenty for one operator.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'admin'
  const limit = await checkLimit('rl:regenerate', ip, 30, '1 h')
  if (!limit.success) {
    return NextResponse.json({ error: 'Regenerate rate limit hit. Wait a few minutes.' }, { status: 429 })
  }

  const { question, draft, context } = await req.json()
  if (!question || !context) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const prompt = `The original question was: "${question}"

Here is the current draft answer:
${draft}

Elijah has added his own real thoughts, stories, or corrections:
${context}

Rewrite the final answer weaving Elijah's additions into the draft. Follow this structure every time:
1. Open by naming the exact pain or feeling they have — make them feel heard immediately
2. Explain WHY this happens (the real mechanism — brain, body, how pressure works) in Elijah's voice, not as a fact recitation
3. Give the solution grounded in Elijah's personal experience and what he added above
4. End with ONE specific action they must take today — concrete enough that there is no excuse not to do it

Use Elijah's real additions as the core. The draft is just scaffolding. His voice and his experience win every time.
Keep it 4 to 8 sentences. No lists. No em dashes. First person throughout.`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const answer = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ answer })
  } catch (err) {
    await logError('regenerate:anthropic', err, { question: question.slice(0, 80) })
    return NextResponse.json({ error: 'Regenerate failed' }, { status: 500 })
  }
}
