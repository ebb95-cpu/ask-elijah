import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'
import type { PublicAnswerSeed } from '@/lib/public-answer-seeds'

export const dynamic = 'force-dynamic'

type ImportAnswer = PublicAnswerSeed & {
  id?: string
  created_at?: string
}

const VALID_THEMES = new Set([
  'confidence',
  'pressure',
  'coach',
  'slumps',
  'mindset',
  'recruiting',
  'identity',
  'role',
  'body',
  'faith',
  'burnout',
  'parent',
])

function backdatedTimestamp(index: number, total: number) {
  const date = new Date()
  const daysAgo = Math.round((index / Math.max(total - 1, 1)) * 60)
  date.setDate(date.getDate() - daysAgo)
  date.setHours(10 + (index % 9), (index * 13) % 60, 0, 0)
  return date.toISOString()
}

function validate(item: ImportAnswer, index: number) {
  const errors: string[] = []
  if (!item.question?.trim()) errors.push(`Row ${index + 1}: question is required`)
  if (!item.answer?.trim()) errors.push(`Row ${index + 1}: answer is required`)
  if (!Array.isArray(item.themes) || item.themes.length === 0) errors.push(`Row ${index + 1}: themes must be a non-empty array`)
  for (const theme of item.themes || []) {
    if (!VALID_THEMES.has(theme)) errors.push(`Row ${index + 1}: invalid theme "${theme}"`)
  }
  if (item.age_band && !['12-14', '15-17', '18-22', '22+'].includes(item.age_band)) {
    errors.push(`Row ${index + 1}: invalid age_band "${item.age_band}"`)
  }
  return errors
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null) as { answers?: ImportAnswer[] } | null
  const answers = body?.answers
  if (!Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: 'Send { answers: [...] }' }, { status: 400 })
  }

  const validationErrors = answers.flatMap(validate)
  if (validationErrors.length) {
    return NextResponse.json({ error: 'Invalid import', details: validationErrors }, { status: 400 })
  }

  const supabase = getSupabase()
  let inserted = 0
  let skipped = 0
  const errors: string[] = []

  for (let index = 0; index < answers.length; index++) {
    const item = answers[index]
    const createdAt = item.created_at || backdatedTimestamp(index, answers.length)
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .ilike('question', item.question.trim().slice(0, 44) + '%')
      .limit(1)

    if (existing?.length) {
      skipped++
      continue
    }

    const { error } = await supabase.from('questions').insert({
      question: item.question.trim(),
      answer: item.answer.trim(),
      action_steps: '',
      status: 'approved',
      email: 'public-cms@elijahbryant.pro',
      ip: 'public-cms',
      sources: item.sources || [],
      topic: item.themes[0] || 'mindset',
      created_at: createdAt,
      approved_at: createdAt,
      reviewed_by_elijah: true,
      asker_label: item.asker_label || null,
      player_age: item.player_age || null,
      themes: item.themes,
      parent_relevant: item.parent_relevant === true,
      public: item.public !== false,
      age_band: item.age_band || null,
    })

    if (error) errors.push(`Row ${index + 1}: ${error.message}`)
    else inserted++
  }

  return NextResponse.json({ inserted, skipped, errors })
}
