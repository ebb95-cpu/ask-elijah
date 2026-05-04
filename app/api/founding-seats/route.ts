import { NextResponse } from 'next/server'
import { FOUNDING_SEAT_LIMIT, getFoundingSeatCount, getFoundingSeatsLeft } from '@/lib/founding-seats'

export const dynamic = 'force-dynamic'

export async function GET() {
  const taken = await getFoundingSeatCount()
  return NextResponse.json({
    taken,
    limit: FOUNDING_SEAT_LIMIT,
    left: getFoundingSeatsLeft(taken),
  })
}
