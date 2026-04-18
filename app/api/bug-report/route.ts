import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { logError } from '@/lib/log-error'
import { emailAdmin, esc } from '@/lib/email-admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bug-report
 *
 * Student-submitted bug report via the floating "Something broken?" button.
 * Every submission emails Elijah immediately — bugs should interrupt him.
 *
 * Body:
 *   { email?: string, page_url?: string, message: string }
 * User agent is auto-captured from headers so the admin can reproduce.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, page_url, message } = body as {
      email?: string
      page_url?: string
      message?: string
    }

    if (!message || message.trim().length < 3) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    const userAgent = req.headers.get('user-agent') || null
    const normalizedEmail = email?.trim().toLowerCase() || null

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('bug_reports')
      .insert({
        email: normalizedEmail,
        page_url: page_url || null,
        user_agent: userAgent,
        message: message.trim(),
      })
      .select('id')
      .single()

    if (error) {
      await logError('bug-report:insert', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Always email — bug reports are interruptible-signal.
    emailAdmin(
      `🐛 Bug report from ${normalizedEmail || 'anon'}`,
      `
<div style="font-family:-apple-system,sans-serif;max-width:600px;">
  <p style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">New bug report</p>
  <p style="font-size:15px;padding:12px;background:#fff5f5;border-left:3px solid #ef4444;white-space:pre-wrap;">${esc(message)}</p>
  <div style="font-size:12px;color:#888;margin-top:20px;line-height:1.8;">
    <div><strong>From:</strong> ${esc(normalizedEmail || 'anonymous')}</div>
    <div><strong>Page:</strong> ${esc(page_url || '(unknown)')}</div>
    <div><strong>Browser:</strong> ${esc(userAgent || '(unknown)')}</div>
    <div><strong>Report ID:</strong> ${esc(data?.id || '')}</div>
  </div>
</div>
      `.trim()
    )

    return NextResponse.json({ ok: true, id: data?.id })
  } catch (err) {
    await logError('bug-report:exception', err)
    return NextResponse.json({ error: 'Failed to submit bug report' }, { status: 500 })
  }
}
