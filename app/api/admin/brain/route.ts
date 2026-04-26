import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type AlertSetting = {
  key: string
  enabled: boolean
  threshold: number | null
  description: string | null
}
type PlayerMemoryGroup = {
  email: string
  memories: Array<{ type: string; text: string; created_at: string }>
}

const DEFAULT_ALERTS: AlertSetting[] = [
  { key: 'repeat_question', enabled: true, threshold: 5, description: 'Notify when multiple players are asking the same thing.' },
  { key: 'bad_feedback', enabled: true, threshold: 1, description: 'Notify when an answer gets negative written feedback.' },
  { key: 'weak_topic', enabled: true, threshold: 3, description: 'Notify when a topic has repeated questions but weak knowledge coverage.' },
  { key: 'watchdog_failure', enabled: true, threshold: 1, description: 'Notify when the watchdog or Sentry sees a technical problem.' },
]

function topicFromQuestion(question: string | null | undefined): string {
  const text = (question || '').toLowerCase()
  if (/confidence|doubt|scared|believe|fear/.test(text)) return 'Confidence'
  if (/pressure|nerv|freeze|calm|big game|clutch/.test(text)) return 'Pressure'
  if (/coach|bench|minutes|playing time|role/.test(text)) return 'Coach / Role'
  if (/shoot|slump|shot|score|bucket/.test(text)) return 'Scoring'
  if (/strong|handle|weak hand|dribble|defense|rebound/.test(text)) return 'Skill development'
  if (/nil|ncaa|eligibility|recruit|transfer|scholarship/.test(text)) return 'Rules / NIL'
  return 'General'
}

function readinessScore(parts: {
  sourceCount: number
  goldCount: number
  approvedCount: number
  preferenceCount: number
  memoryCount: number
  feedbackCount: number
  openGapCount: number
}) {
  const source = Math.min(25, parts.sourceCount * 2)
  const gold = Math.min(20, parts.goldCount * 3)
  const answers = Math.min(20, parts.approvedCount)
  const preferences = Math.min(15, parts.preferenceCount * 3)
  const personalization = Math.min(10, parts.memoryCount)
  const feedback = Math.min(10, parts.feedbackCount * 2)
  const penalty = Math.min(20, parts.openGapCount * 2)
  return Math.max(0, Math.min(100, source + gold + answers + preferences + personalization + feedback - penalty))
}

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const supabase = getSupabase()
  const [
    questionsRes,
    sourcesRes,
    prefsRes,
    memoriesRes,
    feedbackRes,
    painRes,
    settingsRes,
  ] = await Promise.all([
    supabase
      .from('questions')
      .select('id, question, answer, status, topic, sources, helpful_count, is_gold_answer, answer_quality_overall, created_at, approved_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('kb_sources')
      .select('id, source_title, source_type, source_url, chunk_count, published_at, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('elijah_preferences')
      .select('id, preference, category, confidence, active, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('player_memories')
      .select('email, fact_type, fact_text, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('answer_feedback')
      .select('question_id, email, rating, comment, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('pain_points')
      .select('id, cleaned_question, status, source_context, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('admin_alert_settings')
      .select('key, enabled, threshold, description')
      .order('key', { ascending: true }),
  ])

  const questions = questionsRes.data || []
  const sources = sourcesRes.data || []
  const prefs = prefsRes.data || []
  const memories = memoriesRes.data || []
  const feedback = feedbackRes.data || []
  const painPoints = painRes.data || []
  const settings = settingsRes.error ? DEFAULT_ALERTS : (settingsRes.data || DEFAULT_ALERTS)

  const approved = questions.filter((q) => q.status === 'approved' || q.status === 'answered')
  const gold = approved.filter((q) => q.is_gold_answer === true)
  const weakApproved = approved.filter((q) => {
    const sourceCount = Array.isArray(q.sources) ? q.sources.length : 0
    return sourceCount === 0 || (typeof q.answer_quality_overall === 'number' && q.answer_quality_overall < 75)
  })
  const pendingPain = painPoints.filter((p) => p.status === 'pending')
  const lowConfidence = questions.filter((q) => q.status === 'pending' || !q.topic)

  const topicCounts = new Map<string, { topic: string; questions: number; approved: number; gold: number; sources: number }>()
  for (const q of questions) {
    const topic = q.topic || topicFromQuestion(q.question)
    const current = topicCounts.get(topic) || { topic, questions: 0, approved: 0, gold: 0, sources: 0 }
    current.questions += 1
    if (q.status === 'approved' || q.status === 'answered') current.approved += 1
    if (q.is_gold_answer === true) current.gold += 1
    if (Array.isArray(q.sources)) current.sources += q.sources.length
    topicCounts.set(topic, current)
  }
  const weakTopics = Array.from(topicCounts.values())
    .filter((t) => t.questions >= 2 && (t.approved === 0 || t.gold === 0 || t.sources === 0))
    .sort((a, b) => b.questions - a.questions)
    .slice(0, 8)

  const gaps = [
    ...pendingPain.slice(0, 8).map((p) => ({
      type: 'research',
      title: p.cleaned_question,
      detail: p.source_context || 'Research-discovered pain point waiting for Elijah POV.',
    })),
    ...weakApproved.slice(0, 8).map((q) => ({
      type: 'weak_answer',
      title: q.question,
      detail: 'Approved, but missing sources or quality score is weak.',
    })),
    ...lowConfidence.slice(0, 6).map((q) => ({
      type: 'unanswered',
      title: q.question,
      detail: 'Needs a clearer Elijah answer or topic coverage.',
    })),
  ].slice(0, 12)

  const interviewPrompts = weakTopics.slice(0, 5).map((t) => ({
    topic: t.topic,
    prompt: `Players keep asking about ${t.topic.toLowerCase()}. What do you believe most coaches or players get wrong about this, and what would you tell a young hooper to do today?`,
    why: `${t.questions} related questions · ${t.gold} gold answers · ${t.sources} attached sources`,
  }))
  if (interviewPrompts.length < 5) {
    for (const gap of gaps.slice(0, 5 - interviewPrompts.length)) {
      interviewPrompts.push({
        topic: gap.type,
        prompt: `How would you answer this in your real voice: "${gap.title}"? Give the principle, the simple why, and one action step.`,
        why: gap.detail,
      })
    }
  }

  const memoryByEmail = new Map<string, PlayerMemoryGroup>()
  for (const m of memories) {
    if (!m.email) continue
    const current: PlayerMemoryGroup = memoryByEmail.get(m.email) || { email: m.email, memories: [] }
    if (current.memories.length < 5) {
      current.memories.push({ type: m.fact_type, text: m.fact_text, created_at: m.created_at })
    }
    memoryByEmail.set(m.email, current)
  }

  const score = readinessScore({
    sourceCount: sources.length,
    goldCount: gold.length,
    approvedCount: approved.length,
    preferenceCount: prefs.length,
    memoryCount: memories.length,
    feedbackCount: feedback.length,
    openGapCount: gaps.length,
  })

  return NextResponse.json({
    readiness: {
      score,
      label: score >= 85 ? 'Strong' : score >= 65 ? 'Getting strong' : score >= 45 ? 'Needs more Elijah' : 'Thin',
      parts: {
        sources: sources.length,
        chunks: sources.reduce((sum, s) => sum + (s.chunk_count || 0), 0),
        approved_answers: approved.length,
        gold_answers: gold.length,
        preferences: prefs.length,
        player_memories: memories.length,
        feedback_items: feedback.length,
        open_gaps: gaps.length,
      },
    },
    gaps,
    weak_topics: weakTopics,
    interview_prompts: interviewPrompts,
    alerts: settings,
    personalization: Array.from(memoryByEmail.values()).slice(0, 10),
    recent_preferences: prefs.slice(0, 8),
  })
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json()
  const settings = Array.isArray(body.settings) ? body.settings as AlertSetting[] : []
  if (settings.length === 0) return NextResponse.json({ error: 'settings required' }, { status: 400 })

  const rows = settings.map((s) => ({
    key: s.key,
    enabled: s.enabled !== false,
    threshold: typeof s.threshold === 'number' ? s.threshold : null,
    description: s.description || DEFAULT_ALERTS.find((d) => d.key === s.key)?.description || null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await getSupabase()
    .from('admin_alert_settings')
    .upsert(rows, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
