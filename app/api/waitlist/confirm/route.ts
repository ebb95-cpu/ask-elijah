import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro'

  if (!token) {
    return NextResponse.redirect(`${siteUrl}/?waitlist=invalid`)
  }

  const { data, error } = await getSupabase()
    .from('waitlist')
    .update({ confirmed: true })
    .eq('confirm_token', token)
    .select('email, name')
    .single()

  if (error || !data) {
    return NextResponse.redirect(`${siteUrl}/?waitlist=invalid`)
  }

  return NextResponse.redirect(`${siteUrl}/waitlist-confirmed?name=${encodeURIComponent(data.name || '')}`)
}
