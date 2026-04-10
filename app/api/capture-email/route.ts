import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { email, questionId } = await req.json()

    if (!email?.trim() || !questionId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = getSupabase()
    const cleanEmail = email.trim().toLowerCase()

    // Update the question record with the email
    await supabase
      .from('questions')
      .update({ email: cleanEmail })
      .eq('id', questionId)

    // Invite the user to Supabase Auth — creates account silently if they don't have one.
    // Uses admin API so no confirmation email is sent here (they'll get the magic link when they sign in).
    await supabase.auth.admin.inviteUserByEmail(cleanEmail, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=/ask`,
    }).catch(() => {
      // User may already exist — that's fine, ignore the error
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Capture email error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
