import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { logError } from '@/lib/log-error'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * Rubric-based scoring. Single number scores are noise — a rubric forces
 * Claude to say WHY each dimension is strong or weak, which is actionable.
 *
 * The five dimensions are chosen to mirror how a real player reads an
 * answer from Elijah — does it sound like him, is it specific to me,
 * does it hit emotionally, can I actually do something with it, and does
 * it cover what I'd push back with.
 */

const DIMENSIONS = [
  {
    key: 'voice',
    label: 'Voice match',
    rubric: 'Sounds like Elijah: first-person, short sentences, no em-dashes, contractions (don\'t, you\'re), no AI words (crucial, vital, pivotal, delve, leverage). Conversational, like a text.',
  },
  {
    key: 'specificity',
    label: 'Specificity',
    rubric: 'Concrete details, not generic advice. Names a specific drill/routine/moment/number instead of abstractions like "lock in" or "trust the process".',
  },
  {
    key: 'emotional',
    label: 'Emotional resonance',
    rubric: 'Opens by naming exactly what the player is feeling. They should think "he gets it" in the first two sentences, not "here\'s generic advice."',
  },
  {
    key: 'heard',
    label: 'Player will feel heard',
    rubric: 'Addresses THIS player\'s specific situation (not hypothetical players). References details from their question, speaks to their exact pain, not the topic in general.',
  },
  {
    key: 'action',
    label: 'Action clarity',
    rubric: 'Ends with ONE concrete thing to do today. Specific enough that they can\'t say "I don\'t know what to do." Not vague ("work on your mindset").',
  },
  {
    key: 'pushback',
    label: 'Anticipates pushback',
    rubric: 'Preemptively handles the obvious "yeah but..." the player will think. Addresses the likely excuse, the practical limitation, the thing they already tried.',
  },
] as const

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  try {
    const { question, draft } = await req.json()
    if (!question || !draft) {
      return NextResponse.json({ error: 'question and draft required' }, { status: 400 })
    }

    const rubricText = DIMENSIONS.map((d) => `- ${d.key}: ${d.label}. ${d.rubric}`).join('\n')

    const prompt = `You are grading a draft answer that professional basketball player Elijah Bryant is about to send to a player who asked him a question. Be honest — an 8 means genuinely strong, not "good enough to ship." Reserve 9-10 for answers that would make the player feel truly seen.

Player's question:
"${question}"

Draft answer:
"""
${draft}
"""

Grade each dimension from 1 to 10 and explain in ONE short sentence what specifically is good or missing. Be concrete — quote exact phrases when pointing out weakness. Don't hedge.

Dimensions:
${rubricText}

Return JSON only, exactly this shape:
{
  "scores": [
    {"key": "voice", "score": <1-10>, "reason": "<one sentence, concrete>"},
    {"key": "specificity", "score": <1-10>, "reason": "..."},
    {"key": "emotional", "score": <1-10>, "reason": "..."},
    {"key": "heard", "score": <1-10>, "reason": "..."},
    {"key": "action", "score": <1-10>, "reason": "..."},
    {"key": "pushback", "score": <1-10>, "reason": "..."}
  ],
  "topWeakness": "<the single key (e.g. 'specificity') with the lowest score that would most improve the answer if fixed>"
}`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}'
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    let parsed: { scores?: { key: string; score: number; reason: string }[]; topWeakness?: string } = {}
    try {
      parsed = JSON.parse(clean)
    } catch {
      return NextResponse.json({ error: 'Scoring failed to parse' }, { status: 500 })
    }

    if (!Array.isArray(parsed.scores) || parsed.scores.length === 0) {
      return NextResponse.json({ error: 'Scoring returned no data' }, { status: 500 })
    }

    // Normalize and merge with dimension labels
    const byKey = new Map(parsed.scores.map((s) => [s.key, s]))
    const merged = DIMENSIONS.map((d) => {
      const s = byKey.get(d.key)
      const score = typeof s?.score === 'number' ? Math.max(1, Math.min(10, Math.round(s.score))) : 5
      const reason = typeof s?.reason === 'string' ? s.reason : ''
      return { key: d.key, label: d.label, score, reason }
    })

    const overall = Math.round(
      (merged.reduce((sum, d) => sum + d.score, 0) / merged.length) * 10
    )

    const topWeakness = typeof parsed.topWeakness === 'string' && DIMENSIONS.find((d) => d.key === parsed.topWeakness)
      ? parsed.topWeakness
      : merged.slice().sort((a, b) => a.score - b.score)[0]?.key ?? null

    return NextResponse.json({ scores: merged, overall, topWeakness })
  } catch (err) {
    await logError('admin:score-draft', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Score failed' },
      { status: 500 }
    )
  }
}
