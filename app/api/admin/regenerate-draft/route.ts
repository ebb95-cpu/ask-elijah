import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { question, context } = await req.json()
  if (!question || !context) {
    return NextResponse.json({ error: 'question and context required' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Write a completely new answer from scratch to this player's question. Use the context below as your raw material — it may contain a previous draft, notes Elijah jotted in, or a mix of both. Weave it all together into one cohesive, polished answer. Do not append or reference anything. Just write a single complete answer as if you knew all of this from the start. Same voice, same directness as Elijah.

Player's question:
"${question}"

Context and notes to work from:
${context}

Write the full answer from scratch now:`

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const newDraft = res.content[0].type === 'text' ? res.content[0].text.trim() : ''

  return NextResponse.json({ draft: newDraft })
}
