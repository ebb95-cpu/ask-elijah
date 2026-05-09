/**
 * POST /api/admin/refine-kb-note
 *
 * Takes Elijah's raw thinking and rewrites it as a science-backed answer
 * in his voice, formatted as if answering a student or parent question.
 *
 * Body: { rawNote: string, askerType: 'student' | 'parent', topic?: string }
 * Returns: { refined: string, suggestedQuestion: string, topic: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { rawNote, askerType = 'student', topic } = await req.json().catch(() => ({})) as {
    rawNote?: string
    askerType?: 'student' | 'parent'
    topic?: string
  }

  if (!rawNote?.trim() || rawNote.trim().length < 10) {
    return NextResponse.json({ error: 'Add more detail to your note.' }, { status: 400 })
  }

  const systemPrompt = `You are helping Elijah Bryant — NBA Champion and EuroLeague Champion — build a knowledge base for his mental performance app for basketball players.

Your job is to take Elijah's raw thinking and rewrite it as a polished, science-backed answer in his exact voice.

Elijah's voice rules:
- First-person, direct, short sentences
- No filler words, no em dashes, no AI-sounding phrases
- Practical and specific — always ends with something the player can do TODAY
- Draws from real experience as a pro player
- Confident but not arrogant

Science requirements:
- Ground every key claim in neuroscience, sports psychology, or performance science
- Reference the mechanism (e.g. "cortisol spikes when...", "the amygdala reads...", "dopamine reinforces...")
- Use real concepts: pre-performance routines (Gollwitzer), attentional focus (Nideffer), flow state (Csikszentmihalyi), self-determination theory, HRV, sleep science, etc.
- Don't cite papers directly — weave the science into Elijah's voice naturally

Format:
- Write as if Elijah is answering a ${askerType === 'parent' ? 'parent asking about their child' : 'player asking directly'}
- 3-5 paragraphs
- Last paragraph = one specific action they can take today
- No bullet points, just flowing paragraphs`

  const userPrompt = `Here is Elijah's raw thinking. Rewrite it as a polished, science-backed answer in his voice.

Also suggest:
1. A realistic question a ${askerType === 'parent' ? 'parent' : 'student/player'} would ask that this note answers
2. The best topic tag from: confidence, pressure, consistency, focus, slump, coaching, team, mindset, motivation, identity, nutrition, recovery, workout, film, recruiting

Elijah's raw note:
${rawNote.trim()}

Return as JSON:
{
  "refined": "<the full rewritten answer>",
  "suggestedQuestion": "<the question this answers>",
  "topic": "<single topic tag>"
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'AI refinement failed.' }, { status: 500 })
  }

  const data = await res.json()
  const raw = data.content?.[0]?.text || ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Could not parse AI response.' }, { status: 500 })
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({
      refined: parsed.refined || '',
      suggestedQuestion: parsed.suggestedQuestion || '',
      topic: parsed.topic || topic || 'mindset',
    })
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response.' }, { status: 500 })
  }
}
