import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, is_about_elijah } = await req.json()
  if (!id || typeof is_about_elijah !== 'boolean') {
    return NextResponse.json({ error: 'id and is_about_elijah required' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { error } = await supabase
    .from('kb_sources')
    .update({ is_about_elijah })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
