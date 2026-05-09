import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { createHmac } from 'crypto'

/**
 * Validate a signed reset token built by /api/forgot-password.
 * Returns the email if valid, null if expired or tampered.
 */
function verifyResetToken(token: string): string | null {
  try {
    const secret = process.env.RESET_TOKEN_SECRET || 'fallback-secret-change-me'
    const [payload, sig] = token.split('.')
    if (!payload || !sig) return null

    // Verify signature
    const expected = createHmac('sha256', secret).update(payload).digest('base64url')
    if (expected !== sig) return null

    // Decode payload: email:expiresAt
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8')
    const colonIdx = decoded.lastIndexOf(':')
    if (colonIdx === -1) return null
    const email = decoded.slice(0, colonIdx)
    const expiresAt = parseInt(decoded.slice(colonIdx + 1), 10)

    if (!email || isNaN(expiresAt) || Date.now() > expiresAt) return null
    return email
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({})) as {
    token?: string
    password?: string
  }

  if (!token || !password || password.length < 6) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const email = verifyResetToken(token)
  if (!email) {
    return NextResponse.json({ error: 'This link has expired. Request a new one.' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Find the user by email
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) {
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }

  const user = listData.users.find((u) => u.email?.toLowerCase() === email)
  if (!user) {
    return NextResponse.json({ error: 'No account found for that email.' }, { status: 400 })
  }

  // Update the password via admin API — no auth tokens needed
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password })
  if (updateError) {
    return NextResponse.json({ error: updateError.message || 'Could not update password.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
