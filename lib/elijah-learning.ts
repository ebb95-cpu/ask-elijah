import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from './supabase-server'
import { logError } from './log-error'

type PreferenceRow = {
  preference: string
  category?: string | null
}

type QualityScore = {
  scores: Array<{ key: string; label: string; score: number; reason: string }>
  overall: number
  topWeakness: string | null
}

const QUALITY_DIMENSIONS = [
  ['personal', 'Feels personal', 'Sounds like Elijah talking to this exact player, not a generic coach.'],
  ['action', 'Clear action step', 'Ends with one concrete thing the player can do today.'],
  ['source', 'Source-backed', 'Uses Elijah content or credible sources when needed.'],
  ['science', 'Science checked', 'Mechanism is credible and not fake biology.'],
  ['specificity', 'Not generic', 'Uses specific details, cues, drills, routines, or language.'],
  ['length', 'Good length', 'Long enough to land, short enough a young hooper will read it.'],
  ['question', 'Answered exact question', 'Directly answers what the player asked.'],
] as const

export async function getElijahPreferenceContext(limit = 12): Promise<string> {
  try {
    const { data, error } = await getSupabase()
      .from('elijah_preferences')
      .select('preference, category')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data?.length) return ''

    const rows = (data as PreferenceRow[])
      .filter((r) => r.preference?.trim())
      .map((r) => `- ${r.category || 'general'}: ${r.preference.trim()}`)

    return rows.length
      ? `\n\nELIJAH PREFERENCES LEARNED OVER TIME:\n${rows.join('\n')}\nUse these as style and coaching preferences when they fit. Do not force them if they don't fit the player's question.`
      : ''
  } catch {
    return ''
  }
}

export async function learnPreferencesFromAdminNote(args: {
  questionId: string
  question: string
  note?: string | null
}) {
  const note = args.note?.trim()
  if (!note || note.length < 12 || !process.env.ANTHROPIC_API_KEY) return

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Extract reusable Elijah Bryant answer preferences from this admin note.

Question being answered:
"${args.question}"

Admin note:
"""
${note}
"""

Only extract preferences that should help future answers. Ignore one-off details that only apply to this player.

Return JSON only:
{"preferences":[{"preference":"short reusable preference","category":"voice|structure|mindset|action|source|science|other","confidence":0.1-1}]}

Keep at most 4 preferences. No preamble.`,
      }],
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}'
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean) as {
      preferences?: Array<{ preference?: string; category?: string; confidence?: number }>
    }
    const rows = (parsed.preferences || [])
      .filter((p) => p.preference && p.preference.trim().length >= 10)
      .slice(0, 4)
      .map((p) => ({
        preference: p.preference!.trim(),
        category: p.category || 'other',
        confidence: typeof p.confidence === 'number' ? p.confidence : 0.8,
        source_question_id: args.questionId,
        source_note: note,
      }))

    if (rows.length > 0) {
      const { error } = await getSupabase().from('elijah_preferences').insert(rows)
      if (error) await logError('learning:preferences-insert', error, { questionId: args.questionId })
    }
  } catch (err) {
    await logError('learning:preferences', err, { questionId: args.questionId })
  }
}

export async function gradeApprovedAnswer(args: {
  question: string
  answer: string
  sourceCount: number
}): Promise<QualityScore | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    const rubric = QUALITY_DIMENSIONS
      .map(([key, label, description]) => `- ${key}: ${label}. ${description}`)
      .join('\n')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: `Grade this approved Ask Elijah answer. Be honest. A 10 should feel almost unfairly good.

Player question:
"${args.question}"

Approved answer:
"""
${args.answer}
"""

Attached source count: ${args.sourceCount}

Rubric:
${rubric}

Return JSON only:
{"scores":[{"key":"personal","score":1-10,"reason":"one sentence"}, ...], "topWeakness":"key"}

Use every key exactly once.`,
      }],
    })
    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}'
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean) as {
      scores?: Array<{ key: string; score: number; reason: string }>
      topWeakness?: string
    }
    if (!Array.isArray(parsed.scores)) return null

    const scoreMap = new Map(parsed.scores.map((s) => [s.key, s]))
    const scores = QUALITY_DIMENSIONS.map(([key, label]) => {
      const rawScore = scoreMap.get(key)
      return {
        key,
        label,
        score: Math.max(1, Math.min(10, Math.round(Number(rawScore?.score) || 5))),
        reason: typeof rawScore?.reason === 'string' ? rawScore.reason : '',
      }
    })
    const overall = Math.round((scores.reduce((sum, s) => sum + s.score, 0) / scores.length) * 10)
    const validWeakness = scores.find((s) => s.key === parsed.topWeakness)?.key
    return {
      scores,
      overall,
      topWeakness: validWeakness || scores.slice().sort((a, b) => a.score - b.score)[0]?.key || null,
    }
  } catch (err) {
    await logError('learning:grade-answer', err, { question: args.question.slice(0, 120) })
    return null
  }
}
