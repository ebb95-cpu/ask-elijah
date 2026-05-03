import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Admin session cookie.
 *
 * Previously the cookie value was the plaintext ADMIN_PASSWORD. Any leak path
 * (Sentry breadcrumbs capturing headers, Vercel access logs, XSS) exfiltrated
 * the master password directly. This module replaces that with a stateless
 * HMAC-signed session token: the cookie is a random session id plus a
 * signature computed with ADMIN_PASSWORD as the HMAC key. If the cookie
 * leaks, the attacker has a session they can use until ADMIN_PASSWORD
 * rotates, but they never see the password itself.
 *
 * Format: `${sessionId}.${issuedUnixSeconds}.${signatureBase64Url}`
 *   signature = HMAC-SHA256("sessionId.issued", ADMIN_PASSWORD)
 *
 * Uses the Web Crypto API so it works in both Node (route handlers) and Edge
 * (middleware) runtimes. All public functions are async.
 */

export const ADMIN_COOKIE = 'admin_token'
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

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
  const s = process.env.ADMIN_PASSWORD
  if (!s) throw new Error('ADMIN_PASSWORD is not set')
  return s
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

async function sign(payload: string): Promise<string> {
  const key = await hmacKey()
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return toBase64Url(new Uint8Array(sig))
}

/**
 * Constant-time byte comparison. Web Crypto's verify() is constant-time but
 * we keep an explicit helper for completeness in case we need it elsewhere.
 */
function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function issueAdminSession(): Promise<string> {
  const idBytes = new Uint8Array(24)
  crypto.getRandomValues(idBytes)
  const id = toBase64Url(idBytes)
  const issued = Math.floor(Date.now() / 1000)
  const payload = `${id}.${issued}`
  const sig = await sign(payload)
  return `${payload}.${sig}`
}

/**
 * Verify an admin session cookie. Uses Web Crypto's own constant-time HMAC
 * verify under the hood, plus an expiry check (defense in depth — the
 * browser should already drop the cookie past maxAge).
 */
export async function verifyAdminSession(
  cookieValue: string | undefined | null
): Promise<boolean> {
  if (!cookieValue) return false

  const parts = cookieValue.split('.')
  if (parts.length !== 3) return false
  const [id, issuedStr, sig] = parts
  if (!id || !issuedStr || !sig) return false

  const issued = Number(issuedStr)
  if (!Number.isFinite(issued)) return false

  const age = Math.floor(Date.now() / 1000) - issued
  if (age < 0 || age > ADMIN_COOKIE_MAX_AGE) return false

  let sigBytes: Uint8Array
  try {
    sigBytes = fromBase64Url(sig)
  } catch {
    return false
  }

  let key: CryptoKey
  try {
    key = await hmacKey()
  } catch {
    return false
  }

  try {
    return await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes as BufferSource,
      new TextEncoder().encode(`${id}.${issuedStr}`) as BufferSource
    )
  } catch {
    return false
  }
}

/**
 * For use in admin API route handlers. Returns null if the caller is a valid
 * admin, or a 401 NextResponse for early-return.
 *
 *   const unauthorized = await requireAdmin()
 *   if (unauthorized) return unauthorized
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  const ok = await verifyAdminSession(token)
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}

/**
 * Constant-time comparison for Bearer-token auth (used by cron routes).
 */
export function verifyBearer(
  authHeader: string | null | undefined,
  expected: string | undefined
): boolean {
  if (!expected || !authHeader) return false
  const prefix = 'Bearer '
  if (!authHeader.startsWith(prefix)) return false
  const got = authHeader.slice(prefix.length)
  const a = new TextEncoder().encode(got)
  const b = new TextEncoder().encode(expected)
  return timingSafeEqualBytes(a, b)
}
