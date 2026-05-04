import { NextRequest, NextResponse } from 'next/server'
import { validateTrialPromoCode } from '@/lib/promo-codes'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const result = await validateTrialPromoCode(body.code || body.promoCode)

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      code: result.code,
      trialDays: result.trialDays,
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not validate that promo code.' }, { status: 500 })
  }
}
