import { NextRequest, NextResponse } from 'next/server'
import { verifyBearer } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase-server'
import { logError } from '@/lib/log-error'
import { collectYouTube } from '@/lib/research/youtube'
import { collectReddit } from '@/lib/research/reddit'
import { collectAutocomplete } from '@/lib/research/autocomplete'
import { synthesize } from '@/lib/research/synthesize'
import type { RawInsight, SynthesisOutput } from '@/lib/research/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ANSWERED_SCORE_THRESHOLD = 0.62

type PineconeMatch = {
  score: number
  metadata?: Record<string, string>
}

type Coverage = {
  answered: boolean
  bestScore: number
  kbSources: Array<{ title: string; url: string; type: string; text: string }>
}

async function embedText(text: string): Promise<number[] | null> {
  if (!process.env.VOYAGE_API_KEY) return null
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [text], model: 'voyage-3-lite' }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.data?.[0]?.embedding || null
}

async function checkKnowledgeCoverage(question: string): Promise<Coverage> {
  if (!process.env.PINECONE_HOST || !process.env.PINECONE_API_KEY) {
    return { answered: false, bestScore: 0, kbSources: [] }
  }

  try {
    const embedding = await embedText(question)
    if (!embedding) return { answered: false, bestScore: 0, kbSources: [] }

    const res = await fetch(`${process.env.PINECONE_HOST}/query`, {
      method: 'POST',
      headers: {
        'Api-Key': process.env.PINECONE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vector: embedding, topK: 4, includeMetadata: true }),
    })
    if (!res.ok) return { answered: false, bestScore: 0, kbSources: [] }

    const data = await res.json()
    const matches = (data.matches || []) as PineconeMatch[]
    const bestScore = matches[0]?.score || 0
    const kbSources = matches
      .filter((m) => m.score >= 0.35 && m.metadata?.text)
      .map((m) => ({
        title: m.metadata?.source_title || 'Elijah Bryant',
        url: m.metadata?.source_url || m.metadata?.video_url || '',
        type: m.metadata?.source_type || 'knowledge_base',
        text: m.metadata?.text || '',
      }))

    return {
      answered: bestScore >= ANSWERED_SCORE_THRESHOLD,
      bestScore,
      kbSources,
    }
  } catch {
    return { answered: false, bestScore: 0, kbSources: [] }
  }
}

async function seedQuestionQueue(
  supabase: ReturnType<typeof getSupabase>,
  synthesis: SynthesisOutput,
  runId: string
): Promise<{ queued: number; alreadyAnswered: number }> {
  let inserted = 0
  let alreadyAnswered = 0
  const questions = synthesis.top_questions.slice(0, 12)

  for (const item of questions) {
    const cleaned = item.question.trim()
    if (!cleaned) continue

    const { data: existing } = await supabase
      .from('pain_points')
      .select('id')
      .eq('cleaned_question', cleaned)
      .limit(1)
      .maybeSingle()
    if (existing) continue

    const coverage = await checkKnowledgeCoverage(cleaned)
    const status = coverage.answered ? 'auto_answered' : 'pending'
    if (coverage.answered) alreadyAnswered++

    const matchingPain = synthesis.pain_points.find((p) =>
      cleaned.toLowerCase().includes(p.title.toLowerCase().split(' ')[0] || '')
    ) || synthesis.pain_points[0]

    const quotes = matchingPain?.quotes || []
    const originalText = [
      matchingPain ? `Pain: ${matchingPain.title}\n${matchingPain.summary}` : 'Daily pain research question',
      `Signal score: ${item.score}`,
      `Knowledge coverage: ${coverage.answered ? 'answered' : 'needs Elijah'} (${coverage.bestScore.toFixed(2)})`,
      quotes.length ? `Representative quotes:\n${quotes.slice(0, 3).map((q) => `- ${q.text}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n')

    const { error } = await supabase.from('pain_points').insert({
      source: 'pain_research',
      source_url: quotes.find((q) => q.source_url)?.source_url || null,
      source_context: `daily-run:${runId}`,
      original_text: originalText,
      cleaned_question: cleaned,
      status,
      draft_answer: null,
      kb_sources: coverage.kbSources,
    })

    if (!error && status === 'pending') inserted++
  }

  return { queued: inserted, alreadyAnswered }
}

/**
 * Nightly pain-research cron.
 *
 * Runs all three sources in parallel, persists an initial "running" row so
 * the admin dashboard can show progress, then stores the synthesized output
 * plus a sample of the raw data for spot-checking.
 *
 * Auth: Vercel cron calls come with a Bearer token matching CRON_SECRET.
 * Returns quickly with a summary so Vercel's 300s budget is rarely tested.
 */
export async function GET(req: NextRequest) {
  if (!verifyBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // Create the run row up front so the dashboard can see "running"
  // while the scrapers churn.
  const { data: runRow, error: insertErr } = await supabase
    .from('pain_research_runs')
    .insert({ status: 'running' })
    .select('id')
    .single()
  if (insertErr || !runRow) {
    await logError('research:cron:insert', insertErr)
    return NextResponse.json({ error: 'Could not start run' }, { status: 500 })
  }
  const runId = runRow.id as string

  try {
    const [youtube, reddit, autocomplete] = await Promise.all([
      collectYouTube().catch((err) => {
        logError('research:youtube', err)
        return [] as RawInsight[]
      }),
      collectReddit().catch((err) => {
        logError('research:reddit', err)
        return [] as RawInsight[]
      }),
      collectAutocomplete().catch((err) => {
        logError('research:autocomplete', err)
        return [] as RawInsight[]
      }),
    ])

    const rawAll = [...reddit, ...youtube, ...autocomplete]

    // Store at most 500 raw samples — enough for spot-checking, not
    // enough to bloat JSONB and hit Postgres TOAST limits.
    const rawSamples = rawAll.slice(0, 500)

    const synthesis = await synthesize(rawAll)
    const coverage = await seedQuestionQueue(supabase, synthesis, runId)

    await supabase
      .from('pain_research_runs')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        raw_count: rawAll.length,
        raw_samples: rawSamples,
        synthesis,
        pain_count: synthesis.pain_points.length,
        question_count: synthesis.top_questions.length,
      })
      .eq('id', runId)

    return NextResponse.json({
      ok: true,
      runId,
      raw_count: rawAll.length,
      pain_count: synthesis.pain_points.length,
      question_count: synthesis.top_questions.length,
      queued_questions: coverage.queued,
      already_answered: coverage.alreadyAnswered,
      source_breakdown: synthesis.source_breakdown,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await logError('research:cron:run', err)
    await supabase
      .from('pain_research_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: message,
      })
      .eq('id', runId)
    return NextResponse.json({ error: message, runId }, { status: 500 })
  }
}
