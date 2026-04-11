import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Find approved questions with action steps that haven't had accountability sent yet
  // and were approved at least 48 hours ago
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, question, email, action_steps, answer')
    .eq('status', 'approved')
    .not('action_steps', 'is', null)
    .is('accountability_sent_at', null)
    .lt('updated_at', cutoff)
    .limit(50)

  if (error) {
    console.error('Accountability cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!questions?.length) {
    return NextResponse.json({ sent: 0, message: 'No accountability emails to send' })
  }

  let sent = 0

  for (const q of questions) {
    try {
      await resend.emails.send({
        from: 'Elijah Bryant <onboarding@resend.dev>',
        to: q.email,
        subject: '48 hours ago I gave you steps. Did you do them?',
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 48px 24px; color: #111; background: #fff;">

            <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 40px;">
              <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
              <div style="width: 24px; height: 1.5px; background: #000;"></div>
              <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
              <div style="width: 24px; height: 1.5px; background: #000;"></div>
              <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
            </div>

            <p style="font-size: 24px; font-weight: 800; line-height: 1.2; margin: 0 0 24px; color: #000;">
              Did you do the steps?
            </p>

            <div style="border-left: 3px solid #eee; padding-left: 16px; margin-bottom: 28px;">
              <p style="font-size: 13px; color: #999; margin: 0 0 4px;">You asked</p>
              <p style="font-size: 15px; font-weight: 600; margin: 0; color: #333;">${q.question}</p>
            </div>

            <div style="background: #f7f7f7; border-left: 3px solid #000; padding: 20px 24px; margin-bottom: 32px;">
              <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin: 0 0 12px;">Your action steps</p>
              <div style="font-size: 15px; line-height: 1.8; color: #111; white-space: pre-wrap;">${q.action_steps}</div>
            </div>

            <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 16px;">
              Most players read the answer and move on. The ones who get better actually do the steps.
            </p>
            <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 32px;">
              Hit reply and tell me what happened — what you did, what you felt, what changed. That reflection goes into your journal. It's yours to keep.
            </p>

            <a href="${siteUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: 700; margin-bottom: 40px;">
              Ask your next question →
            </a>

            <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 24px;" />
            <p style="font-size: 12px; color: #bbb; line-height: 1.6; margin: 0;">
              This is your accountability check-in from Elijah. Reply directly to this email.
            </p>
          </div>
        `,
      })

      // Mark accountability as sent
      await supabase
        .from('questions')
        .update({ accountability_sent_at: new Date().toISOString() })
        .eq('id', q.id)

      sent++
    } catch (err) {
      console.error(`Failed to send accountability for question ${q.id}:`, err)
    }
  }

  return NextResponse.json({ sent, total: questions.length })
}
