import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { email, name, age, position, level, struggle, goals, customGoal, language } = await req.json()

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const supabase = getSupabase()

    const { error } = await supabase
      .from('profiles')
      .upsert({
        email: email.trim().toLowerCase(),
        name: name?.trim() || null,
        age: age ? parseInt(age) : null,
        position: position || null,
        level: level || null,
        struggle: struggle || null,
        goals: goals || [],
        custom_goal: customGoal?.trim() || null,
        language: language || 'en',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' })

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Profile save error:', err)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}
