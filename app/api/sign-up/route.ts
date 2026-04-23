import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { verifyEmail } from '@/lib/email-verify'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const { email, password, firstName, challenge, weaknesses, strengths, age, position, skipEmailVerify } = await req.json()

  if (!email?.trim() || !password || !firstName?.trim()) {
    return NextResponse.json({ error: 'Email, password, and first name are required' }, { status: 400 })
  }

  const cleanEmail = email.trim().toLowerCase()
  const cleanFirstName = firstName.trim()
  const cleanChallenge = typeof challenge === 'string' ? challenge.trim() : ''
  const cleanWeaknesses = typeof weaknesses === 'string' ? weaknesses.trim() : ''
  const cleanStrengths = typeof strengths === 'string' ? strengths.trim() : ''
  const cleanAge = typeof age === 'string' ? age.trim() : ''
  const cleanPosition = typeof position === 'string' ? position.trim() : ''

  // Verify email is deliverable before we create an account or send mail.
  // Protects Resend sender reputation from bouncing welcome emails to fake
  // addresses. Caller can pass skipEmailVerify:true when the email was
  // already Kickbox-verified earlier in the flow (e.g. the post-ask account
  // setup) to avoid spending a second Kickbox credit on the same address.
  if (!skipEmailVerify) {
    const verify = await verifyEmail(cleanEmail)
    if (!verify.ok) {
      return NextResponse.json({ error: verify.reason }, { status: 400 })
    }
  }

  const supabase = getSupabase()

  const { data, error } = await supabase.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: { first_name: cleanFirstName },
  })

  if (error) {
    if (error.message?.toLowerCase().includes('already')) {
      return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (data.user) {
    const upsertRow: Record<string, unknown> = {
      id: data.user.id,
      first_name: cleanFirstName,
      email: cleanEmail,
    }
    if (cleanChallenge) upsertRow.challenge = cleanChallenge
    if (cleanWeaknesses) upsertRow.weaknesses = cleanWeaknesses
    if (cleanStrengths) upsertRow.strengths = cleanStrengths
    if (cleanAge) upsertRow.age = cleanAge
    if (cleanPosition) upsertRow.position = cleanPosition
    // Fire-and-forget — if `weaknesses`/`strengths` columns don't exist yet
    // in Supabase, the upsert will fail silently and the rest of the row
    // still saves. See scripts/add-profile-columns.sql for the migration.
    await supabase.from('profiles').upsert(upsertRow).then(() => {}, () => {})
  }

  new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'Elijah Bryant <elijah@elijahbryant.pro>',
    to: cleanEmail,
    subject: 'You just did something most players never do.',
    html: `<!DOCTYPE html>
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

          <p style="text-align:center;margin:0 0 48px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" /></p>

          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Welcome,</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">${cleanFirstName}.</p>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">Most players never ask for help. You did.</p>

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:32px;">
            <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0;font-family:-apple-system,sans-serif;">Every question goes straight to me. I read it. I write back. Not a template. Your situation.</p>
          </div>

          <p style="font-size:13px;margin:0 0 56px;font-family:-apple-system,sans-serif;"><a href="https://elijahbryant.pro/ask" style="color:#555555;text-decoration:none;">Ask your first question →</a></p>

          <p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p>
          <p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }).catch(console.error)

  return NextResponse.json({ ok: true })
}
