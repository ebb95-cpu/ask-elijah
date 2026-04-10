import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = getSupabase()
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
    return NextResponse.json({ count: count ?? 0 })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
