import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { logError } from '@/lib/log-error'

type PublicAnswerEventBody = {
  event_type?: string
  question_id?: string
  question_text?: string
  themes?: string[]
  email?: string
  anonymous_id?: string
  metadata?: Record<string, unknown>
}

const ALLOWED_EVENTS = new Set([
  'me_too_click',
  'me_too_added',
  'me_too_removed',
  'ask_version_click',
  'share_click',
])

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PublicAnswerEventBody
    const eventType = typeof body.event_type === 'string' ? body.event_type : ''
    const questionId = typeof body.question_id === 'string' ? body.question_id : ''

    if (!ALLOWED_EVENTS.has(eventType) || !questionId) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    }

    const payload = {
      event_type: eventType,
      question_id: questionId,
      question_text: typeof body.question_text === 'string' ? body.question_text.slice(0, 1000) : null,
      themes: Array.isArray(body.themes) ? body.themes.slice(0, 8) : [],
      email: typeof body.email === 'string' && body.email.trim() ? body.email.trim().toLowerCase() : null,
      anonymous_id: typeof body.anonymous_id === 'string' && body.anonymous_id.trim() ? body.anonymous_id.trim().slice(0, 120) : null,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      user_agent: req.headers.get('user-agent') || null,
    }

    const { error } = await getSupabase().from('public_answer_events').insert(payload)

    // This should never block the player flow. If the migration has not been
    // run yet, log it and let the UI keep moving.
    if (error) {
      await logError('public-answer-event:insert', error, { eventType, questionId })
      return NextResponse.json({ ok: false, stored: false })
    }

    return NextResponse.json({ ok: true, stored: true })
  } catch (err) {
    await logError('public-answer-event:error', err)
    return NextResponse.json({ ok: false, stored: false })
  }
}
