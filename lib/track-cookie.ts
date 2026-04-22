import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'

/**
 * Anonymous-user tracking cookie. Lets a player who just submitted a question
 * (and Kickbox-verified their email) come back to /track to see their answer
 * status without creating an account.
 *
 * Security model:
 *   - Email is HMAC-signed with JWT_SECRET so a user cannot forge another
 *     person's email and read their questions.
 *   - Kickbox only proves the address is deliverable, NOT that the submitter
 *     controls the mailbox. So this cookie is intentionally same-browser only
 *     and expires in 30 days — if someone wants cross-device access, they
 *     create an account. That's the upgrade path.
 *   - Signed with HMAC-SHA256 via Web Crypto so it works in both Node route
 *     handlers and Edge middleware.
 *
 * Format: `${base64urlEmail}.${issuedSeconds}.${signatureBase64Url}`
 *   signature = HMAC-SHA256("email.issued", JWT_SECRET)
 */

export const TRACK_COOKIE = 'ae_track'
export const TRACK_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function toBase64Url(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str: string): Uint8Array {
  const pad = '='.repeat((4 - (str.length % 4)) % 4)
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function secret(): string {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not set')
  return s
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function sign(payload: string): Promise<string> {
  const key = await hmacKey()
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return toBase64Url(new Uint8Array(sig))
}

/**
 * Mint a tracking cookie value for this email. The caller is responsible for
 * putting it on the response via Set-Cookie (helper below).
 */
export async function issueTrackCookie(email: string): Promise<string> {
  const clean = email.trim().toLowerCase()
  const encodedEmail = toBase64Url(new TextEncoder().encode(clean))
  const issued = Math.floor(Date.now() / 1000)
  const payload = `${encodedEmail}.${issued}`
  const sig = await sign(payload)
  return `${payload}.${sig}`
}

/**
 * Set the cookie on a NextResponse. Call this from /api/verify-email right
 * after Kickbox says ok:true.
 */
export async function attachTrackCookie(res: NextResponse, email: string): Promise<void> {
  const value = await issueTrackCookie(email)
  res.cookies.set(TRACK_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TRACK_COOKIE_MAX_AGE,
  })
}

/**
 * Verify the cookie and return the email inside, or null if missing/invalid/
 * expired. Used by server components like /track/page.tsx.
 */
export async function readTrackEmail(): Promise<string | null> {
  const raw = cookies().get(TRACK_COOKIE)?.value
  if (!raw) return null

  const parts = raw.split('.')
  if (parts.length !== 3) return null
  const [encodedEmail, issuedStr, sig] = parts
  if (!encodedEmail || !issuedStr || !sig) return null

  const issued = Number(issuedStr)
  if (!Number.isFinite(issued)) return null
  const age = Math.floor(Date.now() / 1000) - issued
  if (age < 0 || age > TRACK_COOKIE_MAX_AGE) return null

  let sigBytes: Uint8Array
  try {
    sigBytes = fromBase64Url(sig)
  } catch {
    return null
  }

  let key: CryptoKey
  try {
    key = await hmacKey()
  } catch {
    return null
  }

  let ok = false
  try {
    ok = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes as BufferSource,
      new TextEncoder().encode(`${encodedEmail}.${issuedStr}`) as BufferSource,
    )
  } catch {
    return null
  }
  if (!ok) return null

  try {
    return new TextDecoder().decode(fromBase64Url(encodedEmail))
  } catch {
    return null
  }
}
