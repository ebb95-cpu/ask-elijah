/**
 * POST /api/admin/save-kb-note
 *
 * Embeds an approved KB note and saves it to Pinecone + kb_sources.
 *
 * Body: { refined: string, suggestedQuestion: string, topic: string, askerType: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { chunkText, embedBatch, upsertToPinecone } from '@/lib/ingest'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { refined, suggestedQuestion, topic, askerType } = await req.json().catch(() => ({})) as {
    refined?: string
    suggestedQuestion?: string
    topic?: string
    askerType?: string
  }

  if (!refined?.trim() || refined.trim().length < 20) {
    return NextResponse.json({ error: 'Note content required.' }, { status: 400 })
  }

  // Combine question + answer for richer context
  const fullText = suggestedQuestion
    ? `Question: ${suggestedQuestion}\n\nElijah's Answer: ${refined.trim()}`
    : refined.trim()

  const chunks = chunkText(fullText, { targetWords: 400, overlapWords: 60 })
  if (chunks.length === 0) {
    return NextResponse.json({ error: 'Could not chunk content.' }, { status: 400 })
  }

  const embeddings = await embedBatch(chunks)

  const idPrefix = `note_${Date.now()}_`
  const sourceTitle = suggestedQuestion
    ? `Note: ${suggestedQuestion.slice(0, 80)}${suggestedQuestion.length > 80 ? '...' : ''}`
    : `Note: ${refined.slice(0, 80)}...`

  const chunkCount = await upsertToPinecone(
    chunks,
    embeddings,
    {
      source_title: sourceTitle,
      source_type: 'note',
      topic: topic || 'mindset',
      asker_type: askerType || 'student',
    },
    idPrefix
  )

  const supabase = getSupabase()
  await supabase.from('kb_sources').insert({
    id_prefix: idPrefix,
    source_title: sourceTitle,
    source_type: 'note',
    source_url: null,
    chunk_count: chunkCount,
    topic: topic || 'mindset',
    published_at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true, chunkCount, sourceTitle })
}
