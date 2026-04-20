import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  ingestText,
  fetchUrlText,
  classifyUrl,
  extractYouTubeId,
  transcribeAudioUrl,
  type IngestMetadata,
} from '@/lib/ingest'
import { logError } from '@/lib/log-error'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Admin-only knowledge-base ingestion.
 *
 * POST JSON body:
 *   {
 *     type: 'text' | 'url' | 'pdf_base64',
 *     content: string,                      // the text, URL, or base64 PDF
 *     source_title: string,                 // how this will appear in citations
 *     source_url?: string,                  // optional original URL for citations
 *     topic?: string,                       // optional topic tag for filtering
 *     level?: string,                       // optional level tag
 *   }
 *
 * Returns { chunks: number }.
 */
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  try {
    const body = await req.json()
    const { type, content, source_title, source_url, topic, level } = body as {
      type?: 'text' | 'url' | 'pdf_base64'
      content?: string
      source_title?: string
      source_url?: string
      topic?: string
      level?: string
    }

    if (!type || !content || !source_title) {
      return NextResponse.json({ error: 'type, content, and source_title required' }, { status: 400 })
    }

    let text = ''
    let inferredType: IngestMetadata['source_type']
    let finalSourceUrl = source_url

    if (type === 'text') {
      text = content
      inferredType = 'upload_text'
    } else if (type === 'url') {
      // Auto-route based on URL kind: YouTube + audio get transcribed via
      // AssemblyAI; anything else gets HTML-scraped.
      const kind = classifyUrl(content)
      finalSourceUrl = finalSourceUrl || content

      if (kind === 'youtube') {
        const videoId = extractYouTubeId(content)
        if (!videoId) {
          return NextResponse.json({ error: 'Could not parse YouTube URL' }, { status: 400 })
        }
        // AssemblyAI accepts the YouTube URL directly and handles the download
        text = await transcribeAudioUrl(`https://www.youtube.com/watch?v=${videoId}`)
        inferredType = 'upload_youtube'
      } else if (kind === 'audio') {
        // Direct audio URL — podcast MP3, Spotify episode audio, etc.
        text = await transcribeAudioUrl(content)
        inferredType = 'upload_audio'
      } else {
        text = await fetchUrlText(content)
        inferredType = 'upload_url'
      }
    } else if (type === 'pdf_base64') {
      // pdf-parse requires a Buffer
      const buf = Buffer.from(content, 'base64')
      // Dynamic import to avoid bundling issues in edge contexts
      const { default: pdfParse } = await import('pdf-parse')
      const parsed = await pdfParse(buf)
      text = parsed.text || ''
      inferredType = 'upload_pdf'
    } else {
      return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 })
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'No text extracted' }, { status: 400 })
    }

    const idPrefix = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const metadata: IngestMetadata = {
      source_title,
      source_type: inferredType,
      source_url: finalSourceUrl,
      topic: topic || null,
      level: level || null,
    }

    const chunks = await ingestText(text, metadata, idPrefix)

    // Record the source in the inventory table so the admin can see what's
    // already in the KB. Fire-and-forget — if this fails, the ingest still
    // succeeded and we just lose a row in the inventory.
    try {
      await getSupabase().from('kb_sources').insert({
        source_title,
        source_type: inferredType,
        source_url: finalSourceUrl || null,
        topic: topic || null,
        level: level || null,
        chunk_count: chunks,
        id_prefix: idPrefix,
      })
    } catch (e) {
      await logError('admin:ingest:inventory', e, { source_title })
    }

    return NextResponse.json({ chunks, source_title, source_type: inferredType })
  } catch (err) {
    await logError('admin:ingest', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ingest failed' },
      { status: 500 }
    )
  }
}
