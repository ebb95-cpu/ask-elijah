import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? ''
  const incoming = email?.trim().toLowerCase() ?? ''
  const isAdmin = incoming !== '' && incoming === adminEmail
  return NextResponse.json({ isAdmin })
}
