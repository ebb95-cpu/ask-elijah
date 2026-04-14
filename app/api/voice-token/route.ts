import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  const res = await fetch('https://api.assemblyai.com/v2/realtime/token', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expires_in: 480 }), // 8 minutes
  })

  if (!res.ok) return NextResponse.json({ error: 'Token request failed' }, { status: 500 })
  const { token } = await res.json()
  return NextResponse.json({ token })
}
