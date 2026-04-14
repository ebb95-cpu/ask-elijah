'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase-client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface KbSource {
  title: string
  url: string
  type: string
  text: string
}

interface PainPoint {
  id: string
  source: string
  source_url: string | null
  source_context: string | null
  original_text: string
  cleaned_question: string
  status: string
  draft_answer: string | null
  kb_sources: KbSource[]
  final_answer: string | null
  created_at: string
}

interface PlayerQuestion {
  id: string
  question: string
  answer: string | null
  status: string
  email: string
  created_at: string
}

type QueueItem =
  | { kind: 'pain_point'; data: PainPoint }
  | { kind: 'player_question'; data: PlayerQuestion }

type StatusFilter = 'pending' | 'answered' | 'skipped'

interface StatusCounts {
  pending: number
  answered: number
  skipped: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function AutoResizeTextarea({
  value,
  onChange,
  onFocus,
  onBlur,
}: {
  value: string
  onChange: (v: string) => void
  onFocus?: () => void
  onBlur?: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = `${ref.current.scrollHeight}px`
    }
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      rows={5}
      style={{
        width: '100%',
        background: '#0a0a0a',
        color: '#ffffff',
        border: '1px solid #333',
        borderRadius: '6px',
        padding: '12px',
        fontSize: '14px',
        lineHeight: '1.7',
        resize: 'none',
        outline: 'none',
        fontFamily: '-apple-system, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    />
  )
}

// ── Pain Point Card ───────────────────────────────────────────────────────────

function PainPointCard({
  item,
  focused,
  onFocus,
  onPublished,
  onSkipped,
}: {
  item: PainPoint
  focused: boolean
  onFocus: () => void
  onPublished: (id: string) => void
  onSkipped: (id: string) => void
}) {
  const [draft, setDraft] = useState(item.draft_answer || item.final_answer || '')
  const [expanded, setExpanded] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typingInTextarea, setTypingInTextarea] = useState(false)

  const handlePublish = useCallback(async () => {
    if (!draft.trim()) return
    setPublishing(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/questions/${item.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalAnswer: draft }),
      })
      if (!res.ok) throw new Error('Failed to publish')
      setPublished(true)
      setTimeout(() => onPublished(item.id), 800)
    } catch {
      setError('Failed to publish. Try again.')
    } finally {
      setPublishing(false)
    }
  }, [draft, item.id, onPublished])

  const handleSkip = useCallback(async () => {
    setSkipping(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/questions/${item.id}/skip`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to skip')
      onSkipped(item.id)
    } catch {
      setError('Failed to skip. Try again.')
    } finally {
      setSkipping(false)
    }
  }, [item.id, onSkipped])

  // Keyboard shortcuts when focused
  useEffect(() => {
    if (!focused) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handlePublish()
      } else if (e.key === 's' && !typingInTextarea && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        handleSkip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focused, typingInTextarea, handlePublish, handleSkip])

  if (published) {
    return (
      <div style={{
        border: '1px solid #1a3a1a', borderRadius: '8px', padding: '20px',
        background: '#0a1a0a', marginBottom: '16px', opacity: 0.5,
      }}>
        <p style={{ color: '#22c55e', fontSize: '14px', fontWeight: 600, margin: 0 }}>Published</p>
      </div>
    )
  }

  const kbSources: KbSource[] = Array.isArray(item.kb_sources) ? item.kb_sources : []

  return (
    <div
      onClick={onFocus}
      style={{
        border: `1px solid ${focused ? '#444' : '#222'}`,
        borderRadius: '8px',
        padding: '24px',
        background: focused ? '#0d0d0d' : '#0a0a0a',
        marginBottom: '16px',
        cursor: 'default',
        outline: 'none',
      }}
    >
      {/* Source badge + link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span style={{
          background: '#c2410c', color: '#ffffff', fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px',
        }}>
          Reddit
        </span>
        {item.source_context && (
          <span style={{ fontSize: '12px', color: '#555', fontFamily: '-apple-system, sans-serif' }}>
            r/{item.source_context}
          </span>
        )}
        {item.source_url && (
          <a href={item.source_url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '12px', color: '#555', textDecoration: 'none', marginLeft: 'auto' }}>
            View post →
          </a>
        )}
        {focused && (
          <span style={{ fontSize: '10px', color: '#333', marginLeft: item.source_url ? '0' : 'auto', fontFamily: '-apple-system, sans-serif' }}>
            ⌘↵ publish · S skip
          </span>
        )}
      </div>

      {/* Cleaned question */}
      <p style={{
        fontSize: '20px', fontWeight: 700, color: '#ffffff', lineHeight: '1.4',
        margin: '0 0 16px', fontFamily: '-apple-system, sans-serif',
      }}>
        {item.cleaned_question}
      </p>

      {/* Collapsible original post */}
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          style={{ background: 'none', border: 'none', color: '#555', fontSize: '12px', cursor: 'pointer', padding: 0, fontFamily: '-apple-system, sans-serif' }}
        >
          {expanded ? 'Hide' : 'Show'} original post
        </button>
        {expanded && (
          <p style={{
            fontSize: '13px', color: '#666', lineHeight: '1.6', margin: '10px 0 0',
            fontFamily: '-apple-system, sans-serif', whiteSpace: 'pre-wrap',
          }}>
            {item.original_text}
          </p>
        )}
      </div>

      {/* KB Sources */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px', fontFamily: '-apple-system, sans-serif' }}>
          Knowledge base found:
        </p>
        {kbSources.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {kbSources.map((s, i) => (
              <div key={i} style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '6px', padding: '8px 12px', maxWidth: '300px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#888', margin: '0 0 4px', fontFamily: '-apple-system, sans-serif' }}>
                  {s.title}
                </p>
                <p style={{ fontSize: '12px', color: '#555', margin: 0, lineHeight: '1.5', fontFamily: '-apple-system, sans-serif' }}>
                  &ldquo;{s.text.slice(0, 100)}{s.text.length > 100 ? '...' : ''}&rdquo;
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: '#444', margin: 0, fontStyle: 'italic', fontFamily: '-apple-system, sans-serif' }}>
            No matches found — answer from scratch
          </p>
        )}
      </div>

      {/* Draft answer textarea */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px', fontFamily: '-apple-system, sans-serif' }}>
          Your answer (editable)
        </p>
        <AutoResizeTextarea
          value={draft}
          onChange={setDraft}
          onFocus={() => setTypingInTextarea(true)}
          onBlur={() => setTypingInTextarea(false)}
        />
      </div>

      {error && (
        <p style={{ fontSize: '13px', color: '#ef4444', margin: '0 0 12px', fontFamily: '-apple-system, sans-serif' }}>
          {error}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); handlePublish() }}
          disabled={publishing || !draft.trim()}
          style={{
            background: publishing ? '#ccc' : '#ffffff', color: '#000000', border: 'none',
            borderRadius: '6px', padding: '10px 20px', fontSize: '14px', fontWeight: 700,
            cursor: publishing ? 'wait' : 'pointer', fontFamily: '-apple-system, sans-serif',
            opacity: !draft.trim() ? 0.5 : 1,
          }}
        >
          {publishing ? 'Publishing...' : 'Publish →'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleSkip() }}
          disabled={skipping}
          style={{
            background: 'none', border: 'none', color: '#555', fontSize: '14px',
            cursor: skipping ? 'wait' : 'pointer', fontFamily: '-apple-system, sans-serif',
          }}
        >
          {skipping ? 'Skipping...' : 'Skip'}
        </button>
      </div>
    </div>
  )
}

// ── Player Question Card ──────────────────────────────────────────────────────

function PlayerQuestionCard({
  item,
  focused,
  onFocus,
  onApproved,
  onSkipped,
}: {
  item: PlayerQuestion
  focused: boolean
  onFocus: () => void
  onApproved: (id: string) => void
  onSkipped: (id: string) => void
}) {
  const [draft, setDraft] = useState(item.answer || '')
  const [approving, setApproving] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typingInTextarea, setTypingInTextarea] = useState(false)

  const supabase = getSupabaseClient()

  const handleApprove = useCallback(async () => {
    if (!draft.trim()) return
    setApproving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/approve-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: item.id, finalAnswer: draft }),
      })
      if (!res.ok) throw new Error('Failed to approve')
      setApproved(true)
      setTimeout(() => onApproved(item.id), 800)
    } catch {
      setError('Failed to approve. Try again.')
    } finally {
      setApproving(false)
    }
  }, [draft, item.id, onApproved])

  const handleSkip = useCallback(async () => {
    setSkipping(true)
    setError(null)
    try {
      const { error: dbError } = await supabase
        .from('questions')
        .update({ status: 'skipped' })
        .eq('id', item.id)
      if (dbError) throw dbError
      onSkipped(item.id)
    } catch {
      setError('Failed to skip. Try again.')
    } finally {
      setSkipping(false)
    }
  }, [item.id, onSkipped, supabase])

  // Keyboard shortcuts when focused
  useEffect(() => {
    if (!focused) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleApprove()
      } else if (e.key === 's' && !typingInTextarea && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        handleSkip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focused, typingInTextarea, handleApprove, handleSkip])

  if (approved) {
    return (
      <div style={{
        border: '1px solid #1a3a1a', borderRadius: '8px', padding: '20px',
        background: '#0a1a0a', marginBottom: '16px', opacity: 0.5,
      }}>
        <p style={{ color: '#22c55e', fontSize: '14px', fontWeight: 600, margin: 0 }}>Approved — email sent</p>
      </div>
    )
  }

  return (
    <div
      onClick={onFocus}
      style={{
        border: `1px solid ${focused ? '#2d3a6b' : '#1a2040'}`,
        borderRadius: '8px',
        padding: '24px',
        background: focused ? '#0a0d1a' : '#080b14',
        marginBottom: '16px',
        cursor: 'default',
      }}
    >
      {/* Source badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span style={{
          background: '#3730a3', color: '#a5b4fc', fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px',
        }}>
          Player Question
        </span>
        <span style={{ fontSize: '12px', color: '#4a5180', fontFamily: '-apple-system, sans-serif' }}>
          From your site
        </span>
        {focused && (
          <span style={{ fontSize: '10px', color: '#333', marginLeft: 'auto', fontFamily: '-apple-system, sans-serif' }}>
            ⌘↵ approve · S skip
          </span>
        )}
      </div>

      {/* Question text */}
      <p style={{
        fontSize: '20px', fontWeight: 700, color: '#ffffff', lineHeight: '1.4',
        margin: '0 0 16px', fontFamily: '-apple-system, sans-serif',
      }}>
        {item.question}
      </p>

      {/* KB sources label */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', color: '#4a5180', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px', fontFamily: '-apple-system, sans-serif' }}>
          Source
        </p>
        <p style={{ fontSize: '13px', color: '#444', margin: 0, fontStyle: 'italic', fontFamily: '-apple-system, sans-serif' }}>
          From your site — Claude draft pre-loaded
        </p>
      </div>

      {/* Draft answer textarea */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px', fontFamily: '-apple-system, sans-serif' }}>
          Your answer (editable)
        </p>
        <AutoResizeTextarea
          value={draft}
          onChange={setDraft}
          onFocus={() => setTypingInTextarea(true)}
          onBlur={() => setTypingInTextarea(false)}
        />
      </div>

      {error && (
        <p style={{ fontSize: '13px', color: '#ef4444', margin: '0 0 12px', fontFamily: '-apple-system, sans-serif' }}>
          {error}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); handleApprove() }}
          disabled={approving || !draft.trim()}
          style={{
            background: approving ? '#ccc' : '#6366f1', color: '#ffffff', border: 'none',
            borderRadius: '6px', padding: '10px 20px', fontSize: '14px', fontWeight: 700,
            cursor: approving ? 'wait' : 'pointer', fontFamily: '-apple-system, sans-serif',
            opacity: !draft.trim() ? 0.5 : 1,
          }}
        >
          {approving ? 'Approving...' : 'Approve →'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleSkip() }}
          disabled={skipping}
          style={{
            background: 'none', border: 'none', color: '#555', fontSize: '14px',
            cursor: skipping ? 'wait' : 'pointer', fontFamily: '-apple-system, sans-serif',
          }}
        >
          {skipping ? 'Skipping...' : 'Skip'}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalPlayers: number
  questionsThisWeek: number
  answerRate: number
  avgResponseHours: number | null
}

export default function AdminQuestionsPage() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [counts, setCounts] = useState<StatusCounts>({ pending: 0, answered: 0, skipped: 0 })
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null)

  // Run research state
  const [researching, setResearching] = useState(false)
  const [researchResult, setResearchResult] = useState<string | null>(null)

  const supabase = getSupabaseClient()

  // Load counts for all statuses
  async function loadCounts() {
    const [pp, pq] = await Promise.all([
      supabase.from('pain_points').select('status'),
      supabase.from('questions').select('status'),
    ])

    const allRows = [
      ...(pp.data || []),
      ...(pq.data || []),
    ]

    const pending = allRows.filter((r) => r.status === 'pending').length
    const answered = allRows.filter((r) => r.status === 'answered' || r.status === 'approved').length
    const skipped = allRows.filter((r) => r.status === 'skipped').length
    setCounts({ pending, answered, skipped })
  }

  async function loadDashStats() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [allQ, weekQ, answeredQ] = await Promise.all([
      supabase.from('questions').select('email, status, created_at, answered_at'),
      supabase.from('questions').select('id').gte('created_at', weekAgo),
      supabase.from('questions').select('created_at, answered_at').eq('status', 'approved').not('answered_at', 'is', null),
    ])

    const all = allQ.data || []
    const uniqueEmails = new Set(all.map((r: { email: string }) => r.email?.toLowerCase()).filter(Boolean))
    const totalPlayers = uniqueEmails.size

    const questionsThisWeek = (weekQ.data || []).length

    const totalAnswered = all.filter((r: { status: string }) => r.status === 'approved' || r.status === 'answered').length
    const answerRate = all.length > 0 ? Math.round((totalAnswered / all.length) * 100) : 0

    const answeredRows = answeredQ.data || []
    let avgResponseHours: number | null = null
    if (answeredRows.length > 0) {
      const diffs = answeredRows
        .filter((r: { created_at: string; answered_at: string }) => r.created_at && r.answered_at)
        .map((r: { created_at: string; answered_at: string }) =>
          (new Date(r.answered_at).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60)
        )
        .filter((h: number) => h > 0)
      if (diffs.length > 0) {
        avgResponseHours = Math.round(diffs.reduce((a: number, b: number) => a + b, 0) / diffs.length)
      }
    }

    setDashStats({ totalPlayers, questionsThisWeek, answerRate, avgResponseHours })
  }

  async function load(status: StatusFilter) {
    setLoading(true)

    const ppStatus = status === 'answered' ? ['answered'] : [status]
    const pqStatus = status === 'answered' ? ['approved', 'answered'] : [status]

    const [ppRes, pqRes] = await Promise.all([
      supabase
        .from('pain_points')
        .select('*')
        .in('status', ppStatus)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('questions')
        .select('*')
        .in('status', pqStatus)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const painPoints: QueueItem[] = ((ppRes.data as PainPoint[]) || []).map((d) => ({
      kind: 'pain_point',
      data: d,
    }))

    const playerQuestions: QueueItem[] = ((pqRes.data as PlayerQuestion[]) || []).map((d) => ({
      kind: 'player_question',
      data: d,
    }))

    // Interleave: player questions first (they're real humans), then pain points
    const merged: QueueItem[] = []
    const maxLen = Math.max(painPoints.length, playerQuestions.length)
    for (let i = 0; i < maxLen; i++) {
      if (i < playerQuestions.length) merged.push(playerQuestions[i])
      if (i < painPoints.length) merged.push(painPoints[i])
    }

    setItems(merged)
    setLoading(false)
  }

  useEffect(() => {
    load(filter)
    loadCounts()
    setFocusedId(null)
    setSearchQuery('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  useEffect(() => {
    loadDashStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.data.id !== id))
  }

  function handlePublished(id: string) {
    removeItem(id)
    setCounts((c) => ({ ...c, pending: Math.max(0, c.pending - 1), answered: c.answered + 1 }))
  }

  function handleSkipped(id: string) {
    removeItem(id)
    if (filter === 'pending') {
      setCounts((c) => ({ ...c, pending: Math.max(0, c.pending - 1), skipped: c.skipped + 1 }))
    }
  }

  async function handleRunResearch() {
    setResearching(true)
    setResearchResult(null)
    try {
      const res = await fetch('/api/admin/run-research', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setResearchResult(`Error: ${data.error || 'Unknown error'}`)
      } else {
        setResearchResult(`Done — ${data.pending ?? 0} new questions`)
        // Reload if on pending tab
        if (filter === 'pending') {
          await load('pending')
          await loadCounts()
        } else {
          await loadCounts()
        }
      }
    } catch {
      setResearchResult('Error: Network failure')
    } finally {
      setResearching(false)
    }
  }

  // Client-side search filter
  const filteredItems = searchQuery.trim()
    ? items.filter((item) => {
        const q = searchQuery.toLowerCase()
        if (item.kind === 'pain_point') {
          return item.data.cleaned_question.toLowerCase().includes(q)
        } else {
          return item.data.question.toLowerCase().includes(q)
        }
      })
    : items

  const tabs: StatusFilter[] = ['pending', 'answered', 'skipped']

  const pillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '100px',
    padding: '4px 12px',
    fontSize: '13px',
    color: '#888',
    fontFamily: '-apple-system, sans-serif',
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: '-apple-system, sans-serif', flex: 1 }}>
          Question Queue
        </h1>

        {/* Run Research button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <button
            onClick={handleRunResearch}
            disabled={researching}
            style={{
              background: 'none',
              border: '1px solid #2a2a2a',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              color: researching ? '#555' : '#777',
              cursor: researching ? 'wait' : 'pointer',
              fontFamily: '-apple-system, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {researching ? (
              <>
                <span style={{
                  display: 'inline-block', width: '10px', height: '10px',
                  border: '2px solid #444', borderTopColor: '#888',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                }} />
                Running...
              </>
            ) : (
              'Run Research Now'
            )}
          </button>
          {researchResult && (
            <span style={{ fontSize: '11px', color: researchResult.startsWith('Error') ? '#ef4444' : '#22c55e', fontFamily: '-apple-system, sans-serif' }}>
              {researchResult}
            </span>
          )}
        </div>
      </div>

      {/* Dashboard stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        {[
          {
            label: 'Total Players',
            value: dashStats ? dashStats.totalPlayers : '—',
            sub: 'unique emails',
          },
          {
            label: 'This Week',
            value: dashStats ? dashStats.questionsThisWeek : '—',
            sub: 'questions submitted',
          },
          {
            label: 'Answer Rate',
            value: dashStats ? `${dashStats.answerRate}%` : '—',
            sub: 'questions answered',
          },
          {
            label: 'Avg Response',
            value: dashStats
              ? dashStats.avgResponseHours === null
                ? '—'
                : dashStats.avgResponseHours < 24
                ? `${dashStats.avgResponseHours}h`
                : `${Math.round(dashStats.avgResponseHours / 24)}d`
              : '—',
            sub: 'time to answer',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: '#0a0a0a',
              border: '1px solid #1a1a1a',
              borderRadius: '8px',
              padding: '16px',
              fontFamily: '-apple-system, sans-serif',
            }}
          >
            <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
              {stat.label}
            </p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: '0 0 4px', lineHeight: 1 }}>
              {stat.value}
            </p>
            <p style={{ fontSize: '11px', color: '#444', margin: 0 }}>
              {stat.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Stats pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <span style={pillStyle}>
          <span style={{ color: '#ffffff', fontWeight: 600 }}>{counts.pending}</span>
          Pending
        </span>
        <span style={pillStyle}>
          <span style={{ color: '#ffffff', fontWeight: 600 }}>{counts.answered}</span>
          Answered
        </span>
        <span style={pillStyle}>
          <span style={{ color: '#ffffff', fontWeight: 600 }}>{counts.skipped}</span>
          Skipped
        </span>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="Search questions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            background: '#0a0a0a',
            color: '#ffffff',
            border: '1px solid #2a2a2a',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '14px',
            outline: 'none',
            fontFamily: '-apple-system, sans-serif',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '32px', borderBottom: '1px solid #1a1a1a' }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              background: 'none', border: 'none', padding: '10px 16px', fontSize: '14px',
              fontWeight: filter === tab ? 700 : 400, color: filter === tab ? '#ffffff' : '#555',
              cursor: 'pointer', borderBottom: filter === tab ? '2px solid #ffffff' : '2px solid transparent',
              marginBottom: '-1px', fontFamily: '-apple-system, sans-serif', textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Spinner keyframes (injected inline) */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Content */}
      {loading ? (
        <p style={{ color: '#555', fontSize: '14px', fontFamily: '-apple-system, sans-serif' }}>Loading...</p>
      ) : filteredItems.length === 0 ? (
        <p style={{ color: '#555', fontSize: '14px', fontFamily: '-apple-system, sans-serif' }}>
          {searchQuery ? 'No questions match your search.' : `No ${filter} questions.`}
        </p>
      ) : (
        filteredItems.map((item) => {
          if (item.kind === 'pain_point') {
            return (
              <PainPointCard
                key={`pp-${item.data.id}`}
                item={item.data}
                focused={focusedId === `pp-${item.data.id}`}
                onFocus={() => setFocusedId(`pp-${item.data.id}`)}
                onPublished={handlePublished}
                onSkipped={handleSkipped}
              />
            )
          } else {
            return (
              <PlayerQuestionCard
                key={`pq-${item.data.id}`}
                item={item.data}
                focused={focusedId === `pq-${item.data.id}`}
                onFocus={() => setFocusedId(`pq-${item.data.id}`)}
                onApproved={handlePublished}
                onSkipped={handleSkipped}
              />
            )
          }
        })
      )}
    </div>
  )
}
