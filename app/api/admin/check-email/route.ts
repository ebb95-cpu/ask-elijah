import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  const isAdmin = email?.trim().toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase()
  return NextResponse.json({ isAdmin })
}
