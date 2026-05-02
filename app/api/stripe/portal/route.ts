import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabase } from '@/lib/supabase-server'
import { requireAuthorizedEmail } from '@/lib/session-email'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })
}

export async function POST(req: NextRequest) {
  const authorized = await requireAuthorizedEmail(req)
  if (authorized instanceof NextResponse) return authorized

  const body = await req.json().catch(() => ({})) as { email?: string }
  const requested = body.email?.trim().toLowerCase()
  if (requested && requested !== authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getSupabase()
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('email', authorized)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro'
  const session = await getStripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${siteUrl}/ask`,
  })

  return NextResponse.json({ url: session.url })
}
