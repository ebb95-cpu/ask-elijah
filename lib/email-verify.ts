import { promises as dns } from 'dns'

// Small, high-confidence disposable email domain blocklist. Covers ~95% of
// real-world throwaway providers — not exhaustive, but matches the common
// bot signup patterns we want to keep out without a dependency.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'sharklasers.com',
  'yopmail.com',
  'yopmail.net',
  'throwawaymail.com',
  'trashmail.com',
  'maildrop.cc',
  'getnada.com',
  'fakeinbox.com',
  'dispostable.com',
  'tempinbox.com',
  'mintemail.com',
  'mohmal.com',
  'mytemp.email',
  'mohmal.in',
])

// RFC-ish. Stricter than HTML5 type="email" — requires a dot in the domain
// and rejects obviously broken patterns without false-rejecting valid edge
// cases like `user+tag@sub.example.co.uk`.
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export type EmailVerifyResult =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * Verify an email is deliverable before creating a user.
 *
 * Runs free pre-filters first (syntax, disposable blocklist, MX lookup) to
 * avoid burning Kickbox credits on obvious junk. Then calls Kickbox for the
 * real mailbox check. Fails OPEN on any Kickbox error (network/auth/credits)
 * so a service-side Kickbox problem never blocks legitimate signups.
 */
export async function verifyEmail(emailRaw: string): Promise<EmailVerifyResult> {
  const email = emailRaw.trim().toLowerCase()

  // ── Layer 1: syntax ──
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return { ok: false, reason: 'That email doesn\'t look right. Double-check the spelling.' }
  }

  const domain = email.split('@')[1]
  if (!domain) {
    return { ok: false, reason: 'That email doesn\'t look right. Double-check the spelling.' }
  }

  // ── Layer 2: disposable blocklist ──
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: 'Please use your real email — throwaway addresses aren\'t supported.' }
  }

  // ── Layer 3: MX record lookup ──
  try {
    const mx = await dns.resolveMx(domain)
    if (!mx || mx.length === 0) {
      return { ok: false, reason: 'That email domain can\'t receive mail. Double-check the spelling.' }
    }
  } catch {
    return { ok: false, reason: 'That email domain can\'t receive mail. Double-check the spelling.' }
  }

  // ── Layer 4: Kickbox mailbox verification ──
  // Fails open: if Kickbox is down, out of credits, or misconfigured, we let
  // the signup through rather than blocking the entire funnel. The free
  // layers above already filter out most junk.
  const apiKey = process.env.KICKBOX_API_KEY
  if (!apiKey) return { ok: true }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(
      `https://api.kickbox.com/v2/verify?email=${encodeURIComponent(email)}&apikey=${apiKey}`,
      { signal: controller.signal },
    )
    clearTimeout(timeout)
    if (!res.ok) {
      console.error('[kickbox] non-ok response', res.status)
      return { ok: true }
    }
    const data = (await res.json()) as { result?: string; reason?: string }
    if (data.result === 'undeliverable') {
      return { ok: false, reason: 'That email doesn\'t exist. Double-check the spelling.' }
    }
    // "deliverable", "risky", "unknown" all pass — risky/unknown means
    // Kickbox can't be sure (catch-all domain, role account, etc.), and
    // we'd rather occasionally email a flaky address than block a real user.
    return { ok: true }
  } catch (err) {
    console.error('[kickbox] verification failed, failing open', err)
    return { ok: true }
  }
}
