import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type Profile = {
  id: string
  first_name: string | null
  streak_count: number
  last_active_date: string | null
  focus_area: string | null
  tier: 'free' | 'solo' | 'direct'
  questions_this_week: number
  week_reset_date: string | null
}

export type SavedAnswer = {
  id: string
  user_id: string
  question: string
  answer: string
  topic: string | null
  created_at: string
}
