import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { question_id, email } = await req.json()
    if (!question_id || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = getSupabase()
    // Toggle: if already upvoted, remove it
    const { data: existing } = await supabase
      .from('upvotes')
      .select('id')
      .eq('question_id', question_id)
      .eq('email', email.toLowerCase())
      .single()

    if (existing) {
      await supabase.from('upvotes').delete().eq('id', existing.id)
      return NextResponse.json({ action: 'removed' })
    } else {
      await supabase.from('upvotes').insert({ question_id, email: email.toLowerCase() })
      return NextResponse.json({ action: 'added' })
    }
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
