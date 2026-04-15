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

  const { question, currentDraft, notes } = await req.json()
  if (!question || !currentDraft) {
    return NextResponse.json({ error: 'question and currentDraft required' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You wrote a draft answer to a player's question. Elijah has now edited your draft — he may have added notes, changed wording, or mixed in new context. Use his edited version as input and write a clean, polished final answer that incorporates everything he added. Same voice, same directness, same format. Do not mention that you're rewriting or that anything was added. Just write the improved answer.

Player's question:
"${question}"

Your original draft:
${currentDraft}

Elijah's edited version (incorporate all of this):
${notes}

Write the final polished answer now:`

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const newDraft = res.content[0].type === 'text' ? res.content[0].text.trim() : ''

  return NextResponse.json({ draft: newDraft })
}
