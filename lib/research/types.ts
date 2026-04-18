/**
 * Shared shapes for the pain-research pipeline. Every source module
 * normalises its output into RawInsight[] before the synthesis step
 * reads the combined pile.
 */

export type RawInsight = {
  source: 'youtube' | 'reddit' | 'autocomplete'
  source_url: string | null
  text: string
  author: string | null
  created_at: string | null
  // Free-form per-source metadata. Only the synthesis prompt sees this,
  // so use whatever's useful (upvote counts, video titles, subreddit name).
  metadata?: Record<string, unknown>
}

export type SynthesizedPainPoint = {
  title: string          // e.g. "Freezing up in big games"
  summary: string        // 1–2 sentence explanation of the pain in the student's voice
  score: number          // 0-100 — how strong / how many mentions
  quotes: Array<{ text: string; source_url: string | null }>
}

export type SynthesizedQuestion = {
  question: string
  score: number          // 0-100 — how frequently this is being asked
}

export type SynthesisOutput = {
  pain_points: SynthesizedPainPoint[]
  top_questions: SynthesizedQuestion[]
  demographic: string
  source_breakdown: {
    youtube: number
    reddit: number
    autocomplete: number
  }
}
