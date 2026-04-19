import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const EMAILS = [
  {
    name: '1. Waitlist Signup (Open)',
    subject: 'One click and you are locked in.',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head><body style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000"><table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;"><tr><td align="center" bgcolor="#000000" style="background-color:#000000;"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;"><tr><td bgcolor="#000000" style="padding:48px 32px 32px;background-color:#000000;"><p style="text-align:center;margin:0 0 48px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" /></p><p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Good. You showed up,</p><p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">Alex.</p><p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">Most players never ask for help. You did. Click below to lock in your place. When Elijah opens access back up, you go first.</p><p style="font-size:13px;margin:0 0 56px;font-family:-apple-system,sans-serif;"><a href="https://elijahbryant.pro" style="color:#555555;text-decoration:none;">Lock in my place →</a></p><p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p><p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p></td></tr></table></td></tr></table></body></html>`,
  },
  {
    name: '2. Waitlist Signup (Closed)',
    subject: 'You are on the list.',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head><body style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000"><table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;"><tr><td align="center" bgcolor="#000000" style="background-color:#000000;"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;"><tr><td bgcolor="#000000" style="padding:48px 32px 32px;background-color:#000000;"><p style="text-align:center;margin:0 0 48px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" /></p><p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Got it,</p><p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">Alex.</p><p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">This cohort filled up fast. You're locked in for the next one. I'll email you the second it opens.</p><p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p><p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p></td></tr></table></td></tr></table></body></html>`,
  },
  {
    name: '3. Welcome Email',
    subject: 'You need faith and consistency.',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head><body style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000"><table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;"><tr><td align="center" bgcolor="#000000" style="background-color:#000000;"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;"><tr><td bgcolor="#000000" style="padding:48px 32px 32px;background-color:#000000;"><p style="text-align:center;margin:0 0 48px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" /></p><p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">You need faith</p><p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">and consistency.</p><p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">The best players I've coached weren't the most talented. They had faith that they could figure out any problem. And they showed up even when it was hard.</p><p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">Most coaches give you plays. I'm here to help you think through your actual problem so you see the answer yourself. Every time you do that, your faith grows. Every time you act on it, you get more consistent.</p><p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">Ask me something real. Not generic advice. Just me thinking out loud about your situation.</p><p style="font-size:13px;margin:0 0 56px;font-family:-apple-system,sans-serif;"><a href="https://elijahbryant.pro/ask" style="color:#555555;text-decoration:none;">Ask your first question →</a></p><p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p><p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p></td></tr></table></td></tr></table></body></html>`,
  },
  {
    name: '4. Question Confirmation',
    subject: 'Got your question. Working on it.',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head><body style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000"><table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;"><tr><td align="center" bgcolor="#000000" style="background-color:#000000;"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;"><tr><td bgcolor="#000000" style="padding:48px 32px 32px;background-color:#000000;"><p style="text-align:center;margin:0 0 48px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" /></p><p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">I got it,</p><p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">Alex.</p><p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">Good question. I'm working on it right now. You'll get my answer within 24 hours.</p><p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p><p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p></td></tr></table></td></tr></table></body></html>`,
  },
  {
    name: '5. Answer Ready',
    subject: 'Your answer is ready.',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head><body style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000"><table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;"><tr><td align="center" bgcolor="#000000" style="background-color:#000000;"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;"><tr><td bgcolor="#000000" style="padding:48px 32px 32px;background-color:#000000;"><p style="text-align:center;margin:0 0 48px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" /></p><p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Your answer</p><p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">is ready.</p><p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">I thought about your question. Here's what I came up with.</p><p style="font-size:13px;margin:0 0 56px;font-family:-apple-system,sans-serif;"><a href="https://elijahbryant.pro/answer" style="color:#555555;text-decoration:none;">Read your answer →</a></p><p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p><p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p></td></tr></table></td></tr></table></body></html>`,
  },
]

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: any[] = []

  for (const email of EMAILS) {
    try {
      const result = await resend.emails.send({
        from: 'Elijah Bryant <elijah@elijahbryant.pro>',
        to: 'crushedcrib19@gmail.com',
        subject: `[TEST] ${email.subject}`,
        html: email.html,
      })
      if (result.data?.id) {
        results.push({ name: email.name, status: 'sent', id: result.data.id })
      } else {
        results.push({ name: email.name, status: 'failed', error: result.error?.message || 'Unknown error' })
      }
    } catch (err: any) {
      results.push({ name: email.name, status: 'failed', error: err.message })
    }
  }

  return NextResponse.json({ results })
}
