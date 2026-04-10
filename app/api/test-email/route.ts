export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function GET() {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const result = await resend.emails.send({
    from: 'Ask Elijah <onboarding@resend.dev>',
    to: process.env.ADMIN_EMAIL!,
    subject: 'Test email from Ask Elijah',
    html: '<p>This is a test. If you see this, email is working.</p>',
  })

  return NextResponse.json({
    adminEmail: process.env.ADMIN_EMAIL,
    resendResult: result,
  })
}
