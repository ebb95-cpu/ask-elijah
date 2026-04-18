/**
 * Synthesis pass.
 *
 * Takes raw insights from every source, asks Claude to cluster them into
 * pain points + the most common questions being asked. Output is the
 * structured JSON the admin dashboard reads.
 *
 * We hard-cap the input payload so a single run can't blow the context
 * window. If there are too many insights, we sample down — prioritising
 * high-signal sources (reddit posts with upvotes, high-like youtube
 * comments) over autocomplete noise.
 */

import Anthropic from '@anthropic-ai/sdk'
import { RESEARCH_CONFIG } from './config'
import type { RawInsight, SynthesisOutput } from './types'

// Max chars fed into the synthesis prompt. Anthropic context is huge but
// bigger payloads = longer latency and higher cost per run.
const MAX_PAYLOAD_CHARS = 120_000

function scoreInsight(i: RawInsight): number {
  if (i.source === 'reddit') {
    const kind = i.metadata?.kind
    const score = Number(i.metadata?.score || 0)
    // Reddit posts are gold, comments good, both weighted by upvotes.
    return (kind === 'post' ? 50 : 20) + Math.min(50, score)
  }
  if (i.source === 'youtube') {
    const likes = Number(i.metadata?.like_count || 0)
    return 15 + Math.min(50, likes)
  }
  // Autocomplete: the queries themselves are low-weight individually but
  // collectively reveal common phrasing.
  return 5
}

function sampleForSynthesis(insights: RawInsight[]): RawInsight[] {
  const ranked = [...insights].sort((a, b) => scoreInsight(b) - scoreInsight(a))
  const chosen: RawInsight[] = []
  let total = 0
  for (const i of ranked) {
    const size = i.text.length + 50 // rough overhead per item
    if (total + size > MAX_PAYLOAD_CHARS) break
    chosen.push(i)
    total += size
  }
  return chosen
}

function buildPrompt(insights: RawInsight[]): string {
  const bySource = {
    youtube: insights.filter((i) => i.source === 'youtube'),
    reddit: insights.filter((i) => i.source === 'reddit'),
    autocomplete: insights.filter((i) => i.source === 'autocomplete'),
  }

  const format = (i: RawInsight) => {
    const sub = i.metadata?.subreddit ? ` r/${i.metadata.subreddit}` : ''
    const score = i.metadata?.score ? ` (${i.metadata.score})` : ''
    const url = i.source_url ? ` [${i.source_url}]` : ''
    return `- ${i.text.replace(/\s+/g, ' ').trim()}${sub}${score}${url}`
  }

  return `You are analysing pain-point research for Elijah Bryant's basketball mindset product.

TARGET DEMOGRAPHIC:
${RESEARCH_CONFIG.demographic}

Below are raw comments, posts, and search queries collected from YouTube, Reddit, and Google autocomplete over the past 24 hours. Your job: cluster these into the most important pain points and the most frequently asked questions this demographic has right now.

=== REDDIT (${bySource.reddit.length} items) ===
${bySource.reddit.map(format).join('\n')}

=== YOUTUBE (${bySource.youtube.length} items) ===
${bySource.youtube.map(format).join('\n')}

=== GOOGLE AUTOCOMPLETE (${bySource.autocomplete.length} items) ===
${bySource.autocomplete.map(format).join('\n')}

Return valid JSON only, matching exactly this shape:

{
  "pain_points": [
    {
      "title": "<short label, e.g. 'Freezing up in pressure moments'>",
      "summary": "<1-2 sentences in the student's voice describing the pain>",
      "score": <0-100, how strong the signal is based on frequency + intensity>,
      "quotes": [
        { "text": "<direct quote from the data>", "source_url": "<url>" }
      ]
    }
  ],
  "top_questions": [
    { "question": "<exact question phrasing a student might type>", "score": <0-100> }
  ]
}

Rules:
- 8-12 pain points max. Order by score descending. Merge near-duplicates aggressively.
- 15-25 top_questions. Phrase them the way the student would ("How do I..." / "Why does...").
- Each pain_point should have 2-4 real quotes from the data, not paraphrased.
- Never invent pains or quotes. If a pattern isn't visible in the data, don't include it.
- Skip pains that aren't actionable by a mental-game product (e.g. "my shoes are too small").
- Output JSON only — no prose, no code fences.`
}

export async function synthesize(insights: RawInsight[]): Promise<SynthesisOutput> {
  const sampled = sampleForSynthesis(insights)

  const sourceBreakdown = {
    youtube: insights.filter((i) => i.source === 'youtube').length,
    reddit: insights.filter((i) => i.source === 'reddit').length,
    autocomplete: insights.filter((i) => i.source === 'autocomplete').length,
  }

  if (sampled.length === 0) {
    return {
      pain_points: [],
      top_questions: [],
      demographic: RESEARCH_CONFIG.demographic,
      source_breakdown: sourceBreakdown,
    }
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    messages: [{ role: 'user', content: buildPrompt(sampled) }],
  })

  const text = res.content.find((b) => b.type === 'text')?.text || ''
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  let parsed: { pain_points?: unknown; top_questions?: unknown } = {}
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // If Claude didn't return valid JSON, persist an empty synthesis but
    // keep the raw data so the admin can see what came back.
    return {
      pain_points: [],
      top_questions: [],
      demographic: RESEARCH_CONFIG.demographic,
      source_breakdown: sourceBreakdown,
    }
  }

  return {
    pain_points: Array.isArray(parsed.pain_points) ? (parsed.pain_points as SynthesisOutput['pain_points']) : [],
    top_questions: Array.isArray(parsed.top_questions) ? (parsed.top_questions as SynthesisOutput['top_questions']) : [],
    demographic: RESEARCH_CONFIG.demographic,
    source_breakdown: sourceBreakdown,
  }
}
