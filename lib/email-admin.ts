/**
 * Helper for sending short notification emails to Elijah (the admin).
 *
 * Used by low-volume, high-signal events: a bug report, a thumbs-down
 * with a comment, a Sean Ellis "very disappointed" answer. Anything that
 * should interrupt him rather than wait for a weekly dashboard review.
 *
 * Silent no-op if RESEND_API_KEY is missing so previews / local dev don't
 * error out just because mail isn't configured.
 */

import { Resend } from 'resend'
import { logError } from './log-error'

const ADMIN_EMAIL = 'ebb95@mac.com'
const FROM_NAME = 'Ask Elijah · System'
const FROM_EMAIL = 'elijah@elijahbryant.pro'

export async function emailAdmin(subject: string, bodyHtml: string): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return

  try {
    const resend = new Resend(key)
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject,
      html: bodyHtml,
    })
  } catch (err) {
    // Don't block the original request on email failure — just log.
    await logError('email-admin:send', err, { subject })
  }
}

/**
 * Tiny HTML-safe escape. Admin emails include user-submitted text so
 * naive interpolation would let one student with `<script>` tags inject
 * into Elijah's inbox render.
 */
export function esc(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
