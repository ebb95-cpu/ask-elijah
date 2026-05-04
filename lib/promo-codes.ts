import crypto from 'crypto'
import { getSupabase } from './supabase-server'

export type PromoValidation =
  | { ok: true; code: string; trialDays: number; source: 'database' | 'env' }
  | { ok: false; error: string }

const DEFAULT_TRIAL_PROMO_CODES = ['ELIJAH30']

export function normalizePromoCode(input: unknown) {
  return typeof input === 'string' ? input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : ''
}

export function generatePromoCode(prefix = 'HOOP') {
  const cleanPrefix = normalizePromoCode(prefix).slice(0, 10) || 'HOOP'
  return `${cleanPrefix}${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

function envTrialPromoCodes() {
  const configured = process.env.TRIAL_PROMO_CODES
    ?.split(',')
    .map((code) => normalizePromoCode(code))
    .filter(Boolean)

  return configured && configured.length > 0 ? configured : DEFAULT_TRIAL_PROMO_CODES
}

export async function validateTrialPromoCode(input: unknown): Promise<PromoValidation> {
  const code = normalizePromoCode(input)
  if (!code) return { ok: false, error: 'Promo code required.' }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('trial_promo_codes')
    .select('code, active, trial_days, max_redemptions, redeemed_count, expires_at')
    .eq('code', code)
    .maybeSingle()

  if (!error && data) {
    if (data.active !== true) return { ok: false, error: 'That promo code is no longer active.' }
    if (data.expires_at && new Date(data.expires_at) < new Date()) return { ok: false, error: 'That promo code has expired.' }
    if (data.max_redemptions !== null && Number(data.redeemed_count || 0) >= Number(data.max_redemptions)) {
      return { ok: false, error: 'That promo code has already been used.' }
    }
    return { ok: true, code, trialDays: Number(data.trial_days) || 30, source: 'database' }
  }

  if (error && !/trial_promo_codes|relation|schema cache|42P01/i.test(error.message || '')) {
    return { ok: false, error: 'Could not validate that promo code.' }
  }

  if (envTrialPromoCodes().includes(code)) return { ok: true, code, trialDays: 30, source: 'env' }

  return { ok: false, error: 'That promo code is not active.' }
}

export async function recordPromoRedemption(args: {
  code: string
  email: string
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
}) {
  const code = normalizePromoCode(args.code)
  const email = args.email.trim().toLowerCase()
  if (!code || !email) return

  const supabase = getSupabase()
  const { data: existing, error: existingError } = await supabase
    .from('trial_promo_redemptions')
    .select('id')
    .eq('code', code)
    .eq('email', email)
    .maybeSingle()

  if (existingError && /trial_promo_redemptions|relation|schema cache|42P01/i.test(existingError.message || '')) return
  if (existingError) throw existingError
  if (existing?.id) return

  const { error: insertError } = await supabase.from('trial_promo_redemptions').insert({
    code,
    email,
    stripe_customer_id: args.stripeCustomerId || null,
    stripe_subscription_id: args.stripeSubscriptionId || null,
  })

  if (insertError && /trial_promo_redemptions|relation|schema cache|42P01/i.test(insertError.message || '')) return
  if (insertError) throw insertError

  const { data } = await supabase
    .from('trial_promo_codes')
    .select('redeemed_count')
    .eq('code', code)
    .maybeSingle()

  if (!data) return

  await supabase
    .from('trial_promo_codes')
    .update({ redeemed_count: Number(data.redeemed_count || 0) + 1 })
    .eq('code', code)
}
