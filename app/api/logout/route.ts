import { NextResponse } from 'next/server'
import { TRACK_COOKIE } from '@/lib/track-cookie'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(TRACK_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
