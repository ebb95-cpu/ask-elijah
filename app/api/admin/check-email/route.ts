import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { email } = await req.json()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? ''
  const incoming = email?.trim().toLowerCase() ?? ''
  const isAdmin = incoming !== '' && incoming === adminEmail
  return NextResponse.json({ isAdmin })
}
