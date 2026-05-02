import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
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
  invite_sent_at?: string | null
  access_expires_at?: string | null
  archived_at?: string | null
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
  is_founding_member?: boolean | null
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

const INVITE_EXPIRES_DAYS = 7
const FOUNDING_SEAT_LIMIT = 200

function inviteWindow() {
  const sentAt = new Date()
  const expiresAt = new Date(sentAt)
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRES_DAYS)
  return {
    invite_sent_at: sentAt.toISOString(),
    access_expires_at: expiresAt.toISOString(),
  }
}

async function fetchWaitlistRows(supabase: ReturnType<typeof getSupabase>) {
  const withArchive = await supabase
    .from('waitlist')
    .select('id, email, name, challenge, confirmed, approved, notified, invite_sent_at, access_expires_at, archived_at, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (!withArchive.error) return withArchive

  const withExpiry = await supabase
    .from('waitlist')
    .select('id, email, name, challenge, confirmed, approved, notified, invite_sent_at, access_expires_at, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (!withExpiry.error) return withExpiry

  // Backward-compatible fallback until the invite-expiry migration is run.
  return supabase
    .from('waitlist')
    .select('id, email, name, challenge, confirmed, approved, notified, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
}

async function fetchProfileRows(supabase: ReturnType<typeof getSupabase>) {
  const withFounderFlag = await supabase
    .from('profiles')
    .select('id, email, first_name, name, position, level, challenge, is_founding_member, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (!withFounderFlag.error) return withFounderFlag

  // Backward-compatible fallback until the subscription/founder migration is run.
  return supabase
    .from('profiles')
    .select('id, email, first_name, name, position, level, challenge, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
}

async function fetchQuestionRows(supabase: ReturnType<typeof getSupabase>) {
  const withApprovedAt = await supabase
    .from('questions')
    .select('id, email, status, created_at, approved_at')
    .not('email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (!withApprovedAt.error) return withApprovedAt

  // Backward-compatible fallback until the approved_at migration is run.
  return supabase
    .from('questions')
    .select('id, email, status, created_at')
    .not('email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000)
}

async function canApproveFoundingSeat(supabase: ReturnType<typeof getSupabase>, currentWaitlistId?: string) {
  const withArchive = await supabase
    .from('waitlist')
    .select('id')
    .eq('approved', true)
    .is('archived_at', null)
    .limit(FOUNDING_SEAT_LIMIT + 1)

  const { data, error } = withArchive.error && /archived_at/.test(withArchive.error.message || '')
    ? await supabase
      .from('waitlist')
      .select('id')
      .eq('approved', true)
      .limit(FOUNDING_SEAT_LIMIT + 1)
    : withArchive

  if (error) return { ok: false, error: 'Could not check Founding 200 seats.' }

  const approvedRows = (data || []).filter((row: { id: string }) => row.id !== currentWaitlistId)
  if (approvedRows.length >= FOUNDING_SEAT_LIMIT) {
    return { ok: false, error: 'Founding 200 is full. Move someone to waiting before approving another player.' }
  }

  return { ok: true, error: null }
}

async function markProfileFoundingMember(supabase: ReturnType<typeof getSupabase>, email: string, isFoundingMember: boolean) {
  await supabase
    .from('profiles')
    .update({ is_founding_member: isFoundingMember })
    .eq('email', email)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

async function sendAccessInviteEmail(args: { email: string; name?: string | null }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro'
  const firstName = args.name?.trim().split(' ')[0] || 'You'
  const signUpUrl = `${siteUrl}/sign-up?email=${encodeURIComponent(args.email)}`

  await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'Elijah Bryant <elijah@elijahbryant.pro>',
    to: args.email,
    subject: "You're in.",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;">
    <tr><td align="center" bgcolor="#000000" style="background-color:#000000;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td bgcolor="#000000" style="padding:48px 32px 32px;background-color:#000000;">

          <p style="text-align:center;margin:0 0 48px;line-height:0;">
            <img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" />
          </p>

          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">You're in,</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">${escapeHtml(firstName)}.</p>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">
            Ask the question you've been sitting on. I'll send back one answer you can actually use.
          </p>

          <p style="font-size:14px;color:#bbbbbb !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">
            Your invite is open for 7 days. If you don't ask a question by then, I'll give the spot to another player who's ready to work.
          </p>

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:32px;">
            <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0;font-family:-apple-system,sans-serif;">
              Ask. Elijah answers. Apply it.
            </p>
          </div>

          <p style="font-size:13px;margin:0 0 56px;font-family:-apple-system,sans-serif;">
            <a href="${signUpUrl}" style="color:#777777;text-decoration:none;">Set up my locker room →</a>
          </p>

          <p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p>
          <p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
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
    fetchWaitlistRows(supabase),
    fetchProfileRows(supabase),
    fetchQuestionRows(supabase),
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

  if (waitlistResult.error) {
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
    invite_sent_at: string | null
    access_expires_at: string | null
    archived_at: string | null
    archived: boolean
    access_expired: boolean
    asked_during_invite_window: boolean
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
    is_founding_member: boolean
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
        invite_sent_at: null,
        access_expires_at: null,
        archived_at: null,
        archived: false,
        access_expired: false,
        asked_during_invite_window: false,
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
        is_founding_member: false,
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
    if (row.approved) entry.is_founding_member = true
    entry.notified = row.notified
    entry.invite_sent_at = row.invite_sent_at || null
    entry.access_expires_at = row.access_expires_at || null
    entry.archived_at = row.archived_at || null
    entry.archived = !!row.archived_at
    entry.created_at = row.created_at
  }

  if (!profilesResult.error) {
    for (const row of (profilesResult.data || []) as ProfileRow[]) {
      const entry = ensureEntry(row.email)
      entry.has_profile = true
      entry.name = entry.name || row.first_name || row.name
      entry.challenge = entry.challenge || row.challenge
      entry.position = row.position
      entry.level = row.level
      entry.profile_created_at = row.created_at
      entry.is_founding_member = entry.is_founding_member || row.is_founding_member === true
      entry.approved = true
      if (!entry.waitlist_id && row.created_at) entry.created_at = row.created_at
    }
  }

  if (!questionsResult.error) {
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
      if (
        row.created_at
        && entry.access_expires_at
        && row.created_at <= entry.access_expires_at
        && (!entry.invite_sent_at || row.created_at >= entry.invite_sent_at)
      ) {
        entry.asked_during_invite_window = true
      }
      if (row.approved_at && (!entry.last_answered_at || row.approved_at > entry.last_answered_at)) {
        entry.last_answered_at = row.approved_at
      }
      if (!entry.waitlist_id && row.created_at && (!entry.created_at || row.created_at < entry.created_at)) {
        entry.created_at = row.created_at
      }
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

  for (const entry of Array.from(byEmail.values())) {
    entry.access_expired = !!entry.access_expires_at
      && new Date(entry.access_expires_at) < new Date()
      && !entry.asked_during_invite_window
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
  const shouldSendInvite = body.sendInvite === true

  const supabase = getSupabase()
  const seatCheck = await canApproveFoundingSeat(supabase)
  const shouldApprove = seatCheck.ok
  const shouldActuallySendInvite = shouldApprove && shouldSendInvite

  let upsertResult = await supabase
    .from('waitlist')
    .upsert(
      {
        email,
        name: name || null,
        challenge: challenge || null,
        confirmed: true,
        approved: shouldApprove,
        archived_at: null,
      },
      { onConflict: 'email' }
    )
    .select('id, email, name, challenge, confirmed, approved, notified, created_at')
    .single()

  if (upsertResult.error && /archived_at/.test(upsertResult.error.message || '')) {
    upsertResult = await supabase
      .from('waitlist')
      .upsert(
        {
          email,
          name: name || null,
          challenge: challenge || null,
          confirmed: true,
          approved: shouldApprove,
        },
        { onConflict: 'email' }
      )
      .select('id, email, name, challenge, confirmed, approved, notified, created_at')
      .single()
  }

  const { data, error } = upsertResult

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to approve email' }, { status: 500 })
  }

  await markProfileFoundingMember(supabase, email, shouldApprove).catch(() => {})

  let notified = data.notified
  let inviteSentAt: string | null = null
  let accessExpiresAt: string | null = null
  let inviteError: string | null = null
  if (shouldActuallySendInvite) {
    try {
      await sendAccessInviteEmail({ email, name: name || data.name })
      notified = true
      const window = inviteWindow()
      const expiryUpdate = await supabase
        .from('waitlist')
        .update({ notified: true, ...window })
        .eq('id', data.id)
      if (expiryUpdate.error) {
        await supabase.from('waitlist').update({ notified: true }).eq('id', data.id)
      } else {
        inviteSentAt = window.invite_sent_at
        accessExpiresAt = window.access_expires_at
      }
    } catch {
      inviteError = 'Approved, but the invite email failed to send.'
    }
  }

  return NextResponse.json({
    entry: {
      ...data,
      notified,
      invite_sent_at: inviteSentAt,
      access_expires_at: accessExpiresAt,
      archived_at: null,
      archived: false,
      access_expired: false,
      asked_during_invite_window: false,
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
      is_founding_member: shouldApprove,
    },
    invite_sent: shouldActuallySendInvite && !inviteError,
    invite_error: inviteError,
    waitlisted: !shouldApprove,
    message: shouldApprove
      ? undefined
      : seatCheck.error || 'Founding 200 is full, so this player was added to the waiting list.',
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
  const shouldSendInvite = body.sendInvite === true
  const archive = body.archive === true

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

  const supabase = getSupabase()
  if (archive) {
    const { data, error } = await supabase
      .from('waitlist')
      .update({ approved: false, archived_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, email, name, challenge, confirmed, approved, notified, archived_at, created_at')
      .single()

    if (error || !data) {
      if (error && /archived_at/.test(error.message || '')) {
        return NextResponse.json({ error: 'Run the waitlist archive Supabase migration first.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to archive access row' }, { status: 500 })
    }

    await markProfileFoundingMember(supabase, data.email, false).catch(() => {})

    return NextResponse.json({
      entry: {
        ...data,
        archived: true,
        access_expired: false,
        asked_during_invite_window: false,
        waitlist_id: data.id,
        invite_sent_at: null,
        access_expires_at: null,
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
        is_founding_member: false,
      },
    })
  }

  if (approved) {
    const seatCheck = await canApproveFoundingSeat(supabase, id)
    if (!seatCheck.ok) {
      return NextResponse.json({ error: seatCheck.error }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from('waitlist')
    .update({ approved, archived_at: null })
    .eq('id', id)
    .select('id, email, name, challenge, confirmed, approved, notified, archived_at, created_at')
    .single()

  if (error || !data) {
    if (error && /archived_at/.test(error.message || '')) {
      const fallback = await supabase
        .from('waitlist')
        .update({ approved })
        .eq('id', id)
        .select('id, email, name, challenge, confirmed, approved, notified, created_at')
        .single()
      if (!fallback.error && fallback.data) {
        const fallbackData = fallback.data
        return NextResponse.json({
          entry: {
            ...fallbackData,
            archived_at: null,
            archived: false,
            access_expired: false,
            asked_during_invite_window: false,
            waitlist_id: fallbackData.id,
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
            is_founding_member: approved,
          },
          invite_sent: false,
          invite_error: 'Access updated. Run the archive migration before soft-delete is available.',
        })
      }
    }
    return NextResponse.json({ error: 'Failed to update access' }, { status: 500 })
  }

  if (approved) {
    await markProfileFoundingMember(supabase, data.email, true).catch(() => {})
  } else {
    await markProfileFoundingMember(supabase, data.email, false).catch(() => {})
  }

  let notified = data.notified
  let inviteSentAt: string | null = null
  let accessExpiresAt: string | null = null
  let inviteError: string | null = null
  if (shouldSendInvite) {
    try {
      await sendAccessInviteEmail({ email: data.email, name: data.name })
      notified = true
      const window = inviteWindow()
      const expiryUpdate = await supabase
        .from('waitlist')
        .update({ notified: true, ...window })
        .eq('id', data.id)
      if (expiryUpdate.error) {
        await supabase.from('waitlist').update({ notified: true }).eq('id', data.id)
      } else {
        inviteSentAt = window.invite_sent_at
        accessExpiresAt = window.access_expires_at
      }
    } catch {
      inviteError = 'Access updated, but the invite email failed to send.'
    }
  }

  return NextResponse.json({
    entry: {
      ...data,
      notified,
      invite_sent_at: inviteSentAt,
      access_expires_at: accessExpiresAt,
      archived_at: data.archived_at || null,
      archived: !!data.archived_at,
      access_expired: !!accessExpiresAt && new Date(accessExpiresAt) < new Date(),
      asked_during_invite_window: false,
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
      is_founding_member: approved,
    },
    invite_sent: shouldSendInvite && !inviteError,
    invite_error: inviteError,
  })
}
