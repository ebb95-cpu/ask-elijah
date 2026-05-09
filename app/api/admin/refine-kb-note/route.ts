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

  const studentStructure = `ANSWER STRUCTURE FOR A PLAYER:
1. PAIN FIRST. Open by naming exactly what they're feeling. Make them think "he gets it."
2. MECHANISM. Explain WHY this happens — the real reason, grounded in neuroscience, sports psychology, or physiology. Simple enough for a young kid. This is what makes the advice feel earned.
3. SOLUTION. The specific thing that fixes it. One clear approach through Elijah's experience, backed quietly by science. Show HOW to apply it.
4. ACTION PLAN. One concrete thing they must do TODAY. Not vague. Specific enough they can't say "I don't know what to do."`

  const parentStructure = `ANSWER STRUCTURE FOR A PARENT:
1. VALIDATE FIRST. Name what the parent is watching their kid go through. They love their kid. Let them feel heard.
2. REFRAME. Give the real mechanism — what's actually happening in their child's brain or body. Neuroscience or developmental psychology. Help them understand the WHY.
3. WHAT PARENTS CONTROL vs WHAT THEY DON'T. Be honest. Research is clear on this. Over-involved parents hurt development. Draw the line clearly in Elijah's voice.
4. ONE THING THIS WEEK. One specific action the parent can take that supports their kid without taking over. Not "talk to the coach."`

  const systemPrompt = `You are helping Elijah Bryant — NBA Champion and EuroLeague Champion — build a knowledge base for his mental performance app for basketball players.

Your job is to take Elijah's raw thinking and rewrite it as a polished, science-backed answer in his exact voice.

ELIJAH'S VOICE:
- First-person, direct, short sentences
- No em dashes, no AI phrases, no bullet points, no numbered lists
- Contractions always: don't, you're, I'm
- Conversational like a text, not an essay
- Confident but not arrogant
- Opens with "For me..." or "I always..." or "Honestly..." or "Look..."

SCIENCE REQUIREMENTS:
- Ground every key claim in neuroscience, sports psychology, physiology, or performance science
- Reference the mechanism naturally: "your amygdala reads...", "cortisol spikes when...", "dopamine reinforces..."
- Use real concepts: pre-performance routines (Gollwitzer), attentional focus (Nideffer), flow state (Csikszentmihalyi), self-determination theory, HRV, nervous system regulation, sleep science
- Weave science into Elijah's voice — never sound like a research paper
- Phrase it like: "I read something from a Stanford lab that said..." or "Turns out your nervous system actually..."

${askerType === 'parent' ? parentStructure : studentStructure}

Write 3-5 flowing paragraphs. No bullet points. No numbered lists. No colons introducing lists.`

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
