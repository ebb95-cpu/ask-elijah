import { getSupabase } from './supabase-server'

export type PlayerMemoryInput = {
  fact_type: string
  fact_text: string
  expires_days?: number | null
}

export async function savePlayerMemories(
  email: string,
  memories: PlayerMemoryInput[],
  sourceQuestionId?: string | null
) {
  if (!email || !memories.length) return { saved: 0 }

  const clean = email.trim().toLowerCase()
  const rows = memories
    .filter((m) => m.fact_type && m.fact_text?.trim())
    .slice(0, 8)
    .map((m) => ({
      email: clean,
      fact_type: String(m.fact_type).slice(0, 40),
      fact_text: String(m.fact_text).trim().slice(0, 280),
      source_question_id: sourceQuestionId || null,
      expires_at: m.expires_days
        ? new Date(Date.now() + m.expires_days * 24 * 60 * 60 * 1000).toISOString()
        : null,
    }))

  if (!rows.length) return { saved: 0 }
  await getSupabase().from('player_memories').insert(rows)
  return { saved: rows.length }
}

