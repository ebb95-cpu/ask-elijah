import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase-server'

type WaitlistRow = {
  id: string
  email: string
  name: string | null
  challenge: string | null
  confirmed: boolean
  approved: boolean
  notified: boolean
  created_at: string
}

type QuestionRow = {
  id: string
  email: string | null
  status: string | null
  created_at: string | null
  approved_at: string | null
}

type ProfileRow = {
  id: string
  email: string
  first_name: string | null
  name: string | null
  position: string | null
  level: string | null
  challenge: string | null
  created_at: string | null
}

type FeedbackRow = {
  email: string | null
  rating: string | null
}

type ReflectionRow = {
  email: string | null
  sentiment: string | null
  created_at: string | null
}

type AdminNoteRow = {
  email: string
  note: string | null
  high_value: boolean
  updated_at: string | null
}

function cleanEmail(input: unknown): string {
  return typeof input === 'string' ? input.trim().toLowerCase() : ''
}

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const supabase = getSupabase()

  const [
    waitlistResult,
    profilesResult,
    questionsResult,
    feedbackResult,
    reflectionsResult,
    adminNotesResult,
  ] = await Promise.all([
    supabase
    .from('waitlist')
    .select('id, email, name, challenge, confirmed, approved, notified, created_at')
    .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('profiles')
      .select('id, email, first_name, name, position, level, challenge, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('questions')
      .select('id, email, status, created_at, approved_at')
      .not('email', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('answer_feedback')
      .select('email, rating')
      .not('email', 'is', null)
      .limit(1000),
    supabase
      .from('reflections')
      .select('email, sentiment, created_at')
      .not('email', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('player_admin_notes')
      .select('email, note, high_value, updated_at')
      .limit(1000),
  ])

  if (waitlistResult.error || profilesResult.error || questionsResult.error) {
    return NextResponse.json({ error: 'Failed to load access list' }, { status: 500 })
  }

  const byEmail = new Map<string, {
    id: string
    waitlist_id: string | null
    email: string
    name: string | null
    challenge: string | null
    confirmed: boolean
    approved: boolean
    notified: boolean
    created_at: string
    profile_created_at: string | null
    position: string | null
    level: string | null
    question_count: number
    pending_count: number
    approved_count: number
    skipped_count: number
    feedback_up_count: number
    feedback_down_count: number
    last_question_at: string | null
    last_answered_at: string | null
    reflection_count: number
    positive_reflection_count: number
    negative_reflection_count: number
    last_reflection_at: string | null
    admin_note: string | null
    high_value: boolean
    admin_note_updated_at: string | null
    has_profile: boolean
  }>()

  const ensureEntry = (email: string) => {
    const clean = cleanEmail(email)
    let entry = byEmail.get(clean)
    if (!entry) {
      entry = {
        id: `email:${clean}`,
        waitlist_id: null,
        email: clean,
        name: null,
        challenge: null,
        confirmed: false,
        approved: false,
        notified: false,
        created_at: new Date().toISOString(),
        profile_created_at: null,
        position: null,
        level: null,
        question_count: 0,
        pending_count: 0,
        approved_count: 0,
        skipped_count: 0,
        feedback_up_count: 0,
        feedback_down_count: 0,
        last_question_at: null,
        last_answered_at: null,
        reflection_count: 0,
        positive_reflection_count: 0,
        negative_reflection_count: 0,
        last_reflection_at: null,
        admin_note: null,
        high_value: false,
        admin_note_updated_at: null,
        has_profile: false,
      }
      byEmail.set(clean, entry)
    }
    return entry
  }

  for (const row of (waitlistResult.data || []) as WaitlistRow[]) {
    const entry = ensureEntry(row.email)
    entry.id = row.id
    entry.waitlist_id = row.id
    entry.name = row.name || entry.name
    entry.challenge = row.challenge || entry.challenge
    entry.confirmed = row.confirmed
    entry.approved = row.approved
    entry.notified = row.notified
    entry.created_at = row.created_at
  }

  for (const row of (profilesResult.data || []) as ProfileRow[]) {
    const entry = ensureEntry(row.email)
    entry.has_profile = true
    entry.name = entry.name || row.first_name || row.name
    entry.challenge = entry.challenge || row.challenge
    entry.position = row.position
    entry.level = row.level
    entry.profile_created_at = row.created_at
    entry.approved = true
    if (!entry.waitlist_id && row.created_at) entry.created_at = row.created_at
  }

  for (const row of (questionsResult.data || []) as QuestionRow[]) {
    if (!row.email) continue
    const entry = ensureEntry(row.email)
    entry.question_count += 1
    if (row.status === 'approved' || row.status === 'answered') entry.approved_count += 1
    else if (row.status === 'skipped') entry.skipped_count += 1
    else entry.pending_count += 1
    if (row.created_at && (!entry.last_question_at || row.created_at > entry.last_question_at)) {
      entry.last_question_at = row.created_at
    }
    if (row.approved_at && (!entry.last_answered_at || row.approved_at > entry.last_answered_at)) {
      entry.last_answered_at = row.approved_at
    }
    if (!entry.waitlist_id && row.created_at && (!entry.created_at || row.created_at < entry.created_at)) {
      entry.created_at = row.created_at
    }
  }

  for (const row of (feedbackResult.data || []) as FeedbackRow[]) {
    if (!row.email) continue
    const entry = ensureEntry(row.email)
    if (row.rating === 'up') entry.feedback_up_count += 1
    if (row.rating === 'down') entry.feedback_down_count += 1
  }

  if (!reflectionsResult.error) {
    for (const row of (reflectionsResult.data || []) as ReflectionRow[]) {
      if (!row.email) continue
      const entry = ensureEntry(row.email)
      entry.reflection_count += 1
      if (row.sentiment === 'positive') entry.positive_reflection_count += 1
      if (row.sentiment === 'negative') entry.negative_reflection_count += 1
      if (row.created_at && (!entry.last_reflection_at || row.created_at > entry.last_reflection_at)) {
        entry.last_reflection_at = row.created_at
      }
    }
  }

  if (!adminNotesResult.error) {
    for (const row of (adminNotesResult.data || []) as AdminNoteRow[]) {
      const entry = ensureEntry(row.email)
      entry.admin_note = row.note
      entry.high_value = row.high_value
      entry.admin_note_updated_at = row.updated_at
    }
  }

  const entries = Array.from(byEmail.values()).sort((a, b) => {
    const aDate = a.last_question_at || a.created_at
    const bDate = b.last_question_at || b.created_at
    return bDate.localeCompare(aDate)
  })

  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json()
  const email = cleanEmail(body.email)

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const challenge = typeof body.challenge === 'string' ? body.challenge.trim() : ''

  const { data, error } = await getSupabase()
    .from('waitlist')
    .upsert(
      {
        email,
        name: name || null,
        challenge: challenge || null,
        confirmed: true,
        approved: true,
      },
      { onConflict: 'email' }
    )
    .select('id, email, name, challenge, confirmed, approved, notified, created_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to approve email' }, { status: 500 })
  }

  return NextResponse.json({
    entry: {
      ...data,
      waitlist_id: data.id,
      profile_created_at: null,
      position: null,
      level: null,
      question_count: 0,
      pending_count: 0,
      approved_count: 0,
      skipped_count: 0,
      feedback_up_count: 0,
      feedback_down_count: 0,
      last_question_at: null,
      last_answered_at: null,
      reflection_count: 0,
      positive_reflection_count: 0,
      negative_reflection_count: 0,
      last_reflection_at: null,
      admin_note: null,
      high_value: false,
      admin_note_updated_at: null,
      has_profile: false,
    },
  })
}

export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json()
  const id = typeof body.waitlist_id === 'string'
    ? body.waitlist_id
    : typeof body.id === 'string'
      ? body.id
      : ''
  const approved = body.approved === true
  const email = cleanEmail(body.email)

  if (email && (Object.prototype.hasOwnProperty.call(body, 'admin_note') || Object.prototype.hasOwnProperty.call(body, 'high_value'))) {
    const note = typeof body.admin_note === 'string' ? body.admin_note.trim() : null
    const highValue = body.high_value === true

    const { data, error } = await getSupabase()
      .from('player_admin_notes')
      .upsert(
        {
          email,
          note: note || null,
          high_value: highValue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      )
      .select('email, note, high_value, updated_at')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Failed to update player note' }, { status: 500 })
    }

    return NextResponse.json({
      entry: {
        email: data.email,
        admin_note: data.note,
        high_value: data.high_value,
        admin_note_updated_at: data.updated_at,
      },
    })
  }

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await getSupabase()
    .from('waitlist')
    .update({ approved })
    .eq('id', id)
    .select('id, email, name, challenge, confirmed, approved, notified, created_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update access' }, { status: 500 })
  }

  return NextResponse.json({
    entry: {
      ...data,
      waitlist_id: data.id,
      profile_created_at: null,
      position: null,
      level: null,
      question_count: 0,
      pending_count: 0,
      approved_count: 0,
      skipped_count: 0,
      feedback_up_count: 0,
      feedback_down_count: 0,
      last_question_at: null,
      last_answered_at: null,
      reflection_count: 0,
      positive_reflection_count: 0,
      negative_reflection_count: 0,
      last_reflection_at: null,
      admin_note: null,
      high_value: false,
      admin_note_updated_at: null,
      has_profile: false,
    },
  })
}
