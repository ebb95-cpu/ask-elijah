import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { question, conversation } = await req.json()
  // conversation: [{ q: string, a: string }]

  if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 })

  const rounds = (conversation || []).length

  // After 3 rounds, always stop
  if (rounds >= 3) {
    return NextResponse.json({ done: true })
  }

  const conversationText = (conversation || [])
    .map((c: { q: string; a: string }) => `Elijah asked: "${c.q}"\nPlayer answered: "${c.a}"`)
    .join('\n\n')

  const prompt = `You are Elijah Bryant — NBA player, EuroLeague champion, mental performance coach. A basketball player just asked you a question. You need to decide: do you have enough context to give a genuinely useful, specific answer? Or do you need to ask one more follow-up question first?

Player's question: "${question}"
${conversationText ? `\nConversation so far:\n${conversationText}` : ''}

Rules:
- If the question is specific enough to answer well, return done: true
- If you need more context, ask ONE short, direct follow-up question in your voice — conversational, like you're texting them, not formal
- Never ask more than one question at a time
- Focus on the most important missing piece of information
- After 2 rounds of good answers, lean toward done: true unless you're genuinely missing something critical
- Questions like "what position do you play" or "what level" are NOT worth asking — you can answer without that
- DO ask about: specific situations, what they've already tried, what their relationship with the coach/team is like, what "bad" means to them specifically

Return ONLY valid JSON. No other text.
Format: {"done": true} OR {"done": false, "followUp": "your question here"}`

  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}'
    // Strip any markdown code fences if present
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean)

    if (parsed.done) {
      return NextResponse.json({ done: true })
    }

    return NextResponse.json({ done: false, followUp: parsed.followUp })
  } catch {
    // On any error, just proceed with what we have
    return NextResponse.json({ done: true })
  }
}
