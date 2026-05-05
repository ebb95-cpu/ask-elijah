import webPush from 'web-push'
import { getSupabase } from './supabase-server'

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webPush.setVapidDetails('mailto:hello@elijahbryant.pro', publicKey, privateKey)
  return true
}

export async function sendPushToEmail(email: string, payload: PushPayload, questionId?: string | null) {
  if (!configureWebPush()) return { sent: 0, skipped: true }

  const supabase = getSupabase()
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('email', email)
    .eq('enabled', true)

  if (error || !subs?.length) return { sent: 0, skipped: true }

  let sent = 0
  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      )
      sent += 1
      try {
        await supabase.from('notification_events').insert({
          email,
          channel: 'push',
          action: payload.tag || 'notification',
          status: 'sent',
          question_id: questionId || null,
          metadata: { subscription_id: sub.id, url: payload.url || null },
        })
      } catch {}
    } catch (err) {
      try {
        await supabase.from('notification_events').insert({
          email,
          channel: 'push',
          action: payload.tag || 'notification',
          status: 'failed',
          question_id: questionId || null,
          metadata: { subscription_id: sub.id },
          error: err instanceof Error ? err.message : String(err),
        })
      } catch {}
    }
  }

  return { sent, skipped: false }
}
