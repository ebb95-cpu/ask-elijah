import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { PUBLIC_ANSWER_SEEDS } from '@/lib/public-answer-seeds'

export const dynamic = 'force-dynamic'

function backdatedTimestamp(index: number, total: number) {
  const spreadDays = 60
  const daysAgo = Math.round((index / Math.max(total - 1, 1)) * spreadDays)
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(11 + (index % 8), (index * 17) % 60, 0, 0)
  return date.toISOString()
}

function basePayload(seed: (typeof PUBLIC_ANSWER_SEEDS)[number], index: number) {
  const createdAt = backdatedTimestamp(index, PUBLIC_ANSWER_SEEDS.length)

  return {
    question: seed.question,
    answer: seed.answer,
    action_steps: '',
    status: 'approved',
    email: 'public-seed@elijahbryant.pro',
    ip: 'public-seed',
    sources: seed.sources || [],
    topic: seed.themes[0] || 'mindset',
    created_at: createdAt,
    approved_at: createdAt,
    reviewed_by_elijah: true,
  }
}

function cmsPayload(seed: (typeof PUBLIC_ANSWER_SEEDS)[number], index: number) {
  return {
    ...basePayload(seed, index),
    asker_label: seed.asker_label || null,
    player_age: seed.player_age || null,
    themes: seed.themes,
    parent_relevant: seed.parent_relevant,
    public: seed.public,
    age_band: seed.age_band || null,
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  let inserted = 0
  let skipped = 0
  let usedCmsFields = true
  const errors: string[] = []

  for (let index = 0; index < PUBLIC_ANSWER_SEEDS.length; index++) {
    const seed = PUBLIC_ANSWER_SEEDS[index]
    const { data: existing, error: lookupError } = await supabase
      .from('questions')
      .select('id')
      .ilike('question', seed.question.slice(0, 42) + '%')
      .limit(1)

    if (lookupError) {
      errors.push(`Lookup failed: ${seed.question.slice(0, 50)}: ${lookupError.message}`)
      continue
    }

    if (existing?.length) {
      skipped++
      continue
    }

    let { error } = await supabase.from('questions').insert(cmsPayload(seed, index))

    if (error && /column .* does not exist|schema cache/i.test(error.message)) {
      usedCmsFields = false
      const retry = await supabase.from('questions').insert(basePayload(seed, index))
      error = retry.error
    }

    if (error) {
      errors.push(`Failed: ${seed.question.slice(0, 50)}: ${error.message}`)
    } else {
      inserted++
    }
  }

  return NextResponse.json({
    inserted,
    skipped,
    total: PUBLIC_ANSWER_SEEDS.length,
    usedCmsFields,
    note: usedCmsFields
      ? 'Public answer CMS fields were populated.'
      : 'Inserted base approved answers only. Run supabase/migrations/add-public-answer-cms-fields.sql, then run this seed again if you want tags.',
    errors,
  })
}
