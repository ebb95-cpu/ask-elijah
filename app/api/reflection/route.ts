import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { email, question_id, text } = await req.json()
    if (!email || !text?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = getSupabase()
    await supabase.from('reflections').insert({
      email: email.trim().toLowerCase(),
      question_id: question_id || null,
      text: text.trim(),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Reflection error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
