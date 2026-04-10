import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-token')
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { question, draft, context } = await req.json()
  if (!question || !context) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const prompt = `The original question was: "${question}"

Here is the AI-generated draft answer:
${draft}

Elijah has added his own real thoughts and context:
${context}

Rewrite the answer in Elijah's voice, incorporating his personal context above. Keep it natural and human. Follow all the voice rules from your system prompt.`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const answer = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ answer })
}
