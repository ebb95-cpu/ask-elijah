'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ThreeDots from '@/components/ui/ThreeDots'
import LoadingDots from '@/components/ui/LoadingDots'

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuestionDupe {
  id: string
  question: string
  email: string | null
  created_at: string
}

interface PlayerQuestion {
  id: string
  question: string
  answer: string | null
  status: string
  email: string | null
  created_at: string
  item_type?: 'question' | 'pain_point'
  source_url?: string | null
  source_context?: string | null
  // True when this question's answer went through manual approval in the
  // admin queue (vs. a future auto-approve path). Surfaced as a badge on
  // the card so Elijah can see at a glance which ones he's already touched.
  reviewed_by_elijah?: boolean
  // Added by /api/admin/queue when pending questions cluster together by
  // semantic similarity. Representative row is returned with the rest of
  // the cluster collapsed into this field.
  dupes?: QuestionDupe[]
}

type StatusFilter = 'pending' | 'answered' | 'skipped'
type QueueReason = { label: string; tone: 'gold' | 'blue' | 'green' | 'gray' }
type RemixPreset = 'shorter' | 'more_elijah' | 'more_practical'
type RemixNotice = {
  at: Date
  beforeWords: number
  afterWords: number
  changed: boolean
}

function dupeCount(q: PlayerQuestion) {
  return q.dupes?.length ?? 0
}

function queueScore(q: PlayerQuestion) {
  const ageHours = Math.max(0, (Date.now() - new Date(q.created_at).getTime()) / 3600000)
  const recencyBoost = Math.max(0, 24 - ageHours) / 24
  return dupeCount(q) * 10 + (q.item_type === 'pain_point' ? 6 : 4) + recencyBoost
}

function getQueueReasons(q: PlayerQuestion): QueueReason[] {
  const reasons: QueueReason[] = []
  if (q.item_type === 'pain_point') reasons.push({ label: 'Needs Elijah POV', tone: 'blue' })
  else reasons.push({ label: 'Real player', tone: 'green' })
  if (dupeCount(q) > 0) reasons.push({ label: `${dupeCount(q) + 1} players ask this`, tone: 'gold' })
  if (q.source_context) reasons.push({ label: 'Research signal', tone: 'gray' })
  return reasons
}

function getAnswerBrief(q: PlayerQuestion) {
  const text = q.question.toLowerCase()
  const topic = text.includes('shoot') || text.includes('shot')
    ? 'Shooting confidence'
    : text.includes('coach') || text.includes('minutes') || text.includes('playing time')
      ? 'Role and trust'
      : text.includes('freeze') || text.includes('calm') || text.includes('nerv') || text.includes('confidence')
        ? 'Pressure and composure'
        : text.includes('strong') || text.includes('weak hand') || text.includes('handle')
          ? 'Skill development'
          : 'Player growth'
  const emotion = text.includes('scared') || text.includes('freeze') || text.includes('nerv')
    ? 'They probably need calm, certainty, and one thing to do next.'
    : text.includes('coach') || text.includes('bench') || text.includes('minutes')
      ? 'They probably feel frustrated and want control back.'
      : 'They need a clear answer they can use today.'
  const include = topic === 'Pressure and composure'
    ? 'One mindset shift, one pre-game routine, and one in-game cue.'
    : topic === 'Role and trust'
      ? 'One honest truth, one controllable behavior, and one way to earn trust.'
      : 'One direct principle, one drill or habit, and one action step.'

  return { topic, emotion, include }
}

function getWordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

function getQualityChecks(draft: string) {
  const wordCount = getWordCount(draft)
  const lower = draft.toLowerCase()
  return [
    { label: 'Clear answer', passed: wordCount >= 35 },
    { label: 'Action step', passed: /today|next game|practice|write|try|do this|routine|drill/.test(lower) },
    { label: 'Sounds personal', passed: /\byou\b|\byour\b|\bi\b|\bmy\b/.test(lower) },
    { label: 'Not too long', passed: wordCount > 0 && wordCount <= 260 },
  ]
}

function getRemixInstruction(preset: RemixPreset) {
  if (preset === 'shorter') return 'Make this tighter, clearer, and under 180 words without losing the main point.'
  if (preset === 'more_elijah') return 'Make this sound more direct, lived-in, and personal in Elijah Bryant’s voice.'
  return 'Make this more practical with a specific next action the player can do today.'
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminQuestionsPage() {
  const [items, setItems] = useState<PlayerQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [toast, setToast] = useState<string | null>(null)
  const [researching, setResearching] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Remix: takes whatever's currently in the answer textarea (original draft
  // plus whatever notes the admin inlined) and regenerates a fresh, cohesive
  // answer from it via /api/admin/regenerate-draft.
  const [remixing, setRemixing] = useState(false)
  // Sources the LLM consulted via web_search / web_fetch when remixing.
  // Rendered under the draft so admin can verify quotes before approving.
  const [sources, setSources] = useState<{ title: string; url: string }[]>([])
  const [remixNotice, setRemixNotice] = useState<RemixNotice | null>(null)

  const load = useCallback(async (status: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/queue?status=${status}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      const loaded = data.questions || []
      setItems(
        status === 'pending'
          ? [...loaded].sort((a: PlayerQuestion, b: PlayerQuestion) => {
              if (a.item_type === b.item_type) return 0
              return a.item_type === 'pain_point' ? -1 : 1
            })
          : loaded
      )
    } catch (e) {
      console.error('Queue load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(filter === 'answered' ? 'answered' : filter)
    setOpenId(null)
    setRemixNotice(null)
  }, [filter, load])

  const researchItems = items.filter((q) => q.item_type === 'pain_point')
  const playerItems = items.filter((q) => q.item_type !== 'pain_point')

  const runResearchNow = async () => {
    if (researching) return
    setResearching(true)
    setToast('Running research. This can take a minute...')
    try {
      const res = await fetch('/api/admin/pain-research', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `${res.status}`)
      }
      setToast('Research started. Refresh in a minute for new cards.')
      setTimeout(() => load(filter === 'answered' ? 'answered' : filter), 5000)
    } catch (e) {
      setToast(`Research failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setResearching(false)
      setTimeout(() => setToast(null), 6000)
    }
  }

  const handleApprove = async (questionId: string, openNext = false) => {
    if (!draft.trim()) return
    const group = items.find((q) => q.id === questionId)
    const isPainPoint = group?.item_type === 'pain_point'
    const dupeIds = group?.dupes?.map((d) => d.id) ?? []
    const allIds = [questionId, ...dupeIds]
    const nextItem = openNext
      ? [...items]
          .filter((q) => q.id !== questionId)
          .sort((a, b) => queueScore(b) - queueScore(a))[0]
      : null
    setApproving(true)
    setError(null)
    try {
      if (isPainPoint) {
        const res = await fetch(`/api/admin/questions/${questionId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ finalAnswer: draft }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `${res.status}`)
        }
        setToast('Added to knowledge base')
      } else if (allIds.length > 1) {
        // One approver, N recipients: if the card represents a cluster,
        // bulk-approve sends the same answer to every asker in the cluster.
        const res = await fetch('/api/admin/bulk-approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionIds: allIds, finalAnswer: draft }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `${res.status}`)
        }
        const data = await res.json()
        setToast(
          data.failed
            ? `Approved ${data.succeeded ?? 0}; ${data.failed} need a retry`
            : `Approved ${data.succeeded ?? allIds.length} — emails sent`
        )
      } else {
        const res = await fetch('/api/admin/approve-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId, finalAnswer: draft }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `${res.status}`)
        }
        setToast('Approved — email sent')
      }
      setTimeout(() => setToast(null), 3000)
      setItems((prev) => prev.filter((q) => q.id !== questionId))
      setOpenId(nextItem?.id ?? null)
      setDraft(nextItem?.answer || '')
      setSources([])
      setRemixNotice(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to approve'
      setError(/^\d+$/.test(message) ? `Approval failed with server error ${message}. Try again or check logs.` : message)
    } finally {
      setApproving(false)
    }
  }

  const handleRemix = async (preset?: RemixPreset) => {
    if (!openItem || !draft.trim() || remixing) return
    const previousDraft = draft
    const beforeWords = getWordCount(previousDraft)
    setRemixing(true)
    setError(null)
    setRemixNotice(null)
    try {
      // Whatever's in the textarea is the raw material — previous draft plus
      // any notes Elijah inlined. The endpoint writes a new cohesive answer
      // from scratch using it.
      const res = await fetch('/api/admin/regenerate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: openItem.question,
          context: draft,
          remixInstruction: preset ? getRemixInstruction(preset) : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `${res.status}`)
      }
      const data = await res.json()
      if (!data.draft) throw new Error('Empty remix response')
      setDraft(data.draft)
      setSources(Array.isArray(data.sources) ? data.sources : [])
      const afterWords = getWordCount(data.draft)
      const changed = data.draft.trim() !== previousDraft.trim()
      setRemixNotice({ at: new Date(), beforeWords, afterWords, changed })
      setToast(
        changed
          ? `New remix generated — ${beforeWords} → ${afterWords} words`
          : 'Remix finished, but the draft came back unchanged. Add a stronger note and try again.'
      )
      setTimeout(() => setToast(null), 3000)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to remix'
      setError(/^\d+$/.test(message) ? `Remix failed with server error ${message}. Try again in a moment.` : message)
    } finally {
      setRemixing(false)
    }
  }

  const handleSkip = async (questionId: string) => {
    try {
      const group = items.find((q) => q.id === questionId)
      const res = await fetch(`/api/admin/questions/${questionId}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType: group?.item_type || 'question' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `${res.status}`)
      }
      setItems((prev) => prev.filter((q) => q.id !== questionId))
      setOpenId(null)
      setDraft('')
      setSources([])
      setRemixNotice(null)
      setError(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to skip'
      setError(/^\d+$/.test(message) ? `Skip failed with server error ${message}. Try again in a moment.` : message)
    }
  }

  const openItem = openId ? items.find((q) => q.id === openId) : null
  const prioritizedItems = [...items].sort((a, b) => queueScore(b) - queueScore(a))
  const focusItems = filter === 'pending' ? prioritizedItems.slice(0, 5) : []
  const focusIds = new Set(focusItems.map((q) => q.id))
  const backlogItems = filter === 'pending' ? prioritizedItems.filter((q) => !focusIds.has(q.id)) : items
  const nextFocus = focusItems[0]

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000)
    if (diffH < 1) return 'Just now'
    if (diffH < 24) return `${diffH}h ago`
    if (diffH < 48) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // ── Detail overlay ──────────────────────────────────────────────────────────
  if (openItem) {
    const brief = getAnswerBrief(openItem)
    const checks = getQualityChecks(draft)
    const wordCount = getWordCount(draft)
    const hasNextAfterApprove = items.some((q) => q.id !== openItem.id)

    return (
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)' }}>
        <button
          onClick={() => { setOpenId(null); setDraft(''); setError(null); setSources([]); setRemixNotice(null) }}
          style={{
            background: 'none', border: '1px solid #333', borderRadius: 6,
            color: '#888', fontSize: 13, padding: '8px 16px', cursor: 'pointer',
            marginBottom: 20, minHeight: 44, fontFamily: '-apple-system, sans-serif',
          }}
        >
          ← Back to queue
        </button>

        {/* Question */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            {openItem.item_type === 'pain_point' ? 'research' : (openItem.email || 'anon')} · {formatDate(openItem.created_at)}
            {openItem.dupes && openItem.dupes.length > 0 && (
              <> · <span style={{ color: '#fbbf24' }}>+{openItem.dupes.length} asked the same</span></>
            )}
            {openItem.source_context && <> · <span style={{ color: '#7dd3fc' }}>{openItem.source_context}</span></>}
          </p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.4, margin: 0 }}>
            {openItem.question}
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 18,
          alignItems: 'start',
        }}>
          <main>
            {/* Editable answer */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <p style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                  {openItem.status === 'approved' ? 'Answer (editable — update & re-send)' : 'Your answer (editable)'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {remixNotice && (
                    <span style={{
                      background: remixNotice.changed ? '#0a1f15' : '#2a2015',
                      border: remixNotice.changed ? '1px solid #1f4030' : '1px solid #4a3512',
                      borderRadius: 999,
                      color: remixNotice.changed ? '#34d399' : '#fbbf24',
                      fontSize: 10,
                      fontWeight: 900,
                      padding: '4px 8px',
                    }}>
                      {remixNotice.changed ? 'New remix' : 'No visible change'} · {remixNotice.beforeWords} → {remixNotice.afterWords} words
                    </span>
                  )}
                  <span style={{ color: wordCount > 260 ? '#fbbf24' : '#666', fontSize: 11, fontWeight: 700 }}>
                    {wordCount} words
                  </span>
                </div>
              </div>
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  if (error) setError(null)
                  if (remixNotice) setRemixNotice(null)
                }}
                rows={13}
                style={{
                  width: '100%', background: '#0a0a0a', color: '#fff',
                  border: remixNotice?.changed ? '1px solid #1f4030' : '1px solid #333', borderRadius: 10, padding: 16,
                  fontSize: 16, lineHeight: 1.6, resize: 'vertical',
                  outline: 'none', fontFamily: '-apple-system, sans-serif',
                  boxSizing: 'border-box',
                  boxShadow: remixNotice?.changed ? '0 0 0 3px rgba(52, 211, 153, 0.08)' : 'none',
                }}
              />
              {remixNotice && (
                <p style={{ color: remixNotice.changed ? '#34d399' : '#fbbf24', fontSize: 12, margin: '8px 0 0', lineHeight: 1.45 }}>
                  {remixNotice.changed
                    ? `Fresh remix generated at ${remixNotice.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Review the new draft before approving.`
                    : 'Remix completed, but the answer looked the same. Add a direct note like "include this exact point..." and remix again.'}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
              {([
                ['shorter', 'Shorter'],
                ['more_elijah', 'More Elijah'],
                ['more_practical', 'More practical'],
              ] as Array<[RemixPreset, string]>).map(([preset, label]) => (
                <button
                  key={preset}
                  onClick={() => handleRemix(preset)}
                  disabled={remixing || !draft.trim()}
                  style={{
                    background: '#080808',
                    border: '1px solid #2a2a2a',
                    borderRadius: 999,
                    color: '#ddd',
                    cursor: remixing ? 'wait' : 'pointer',
                    fontFamily: '-apple-system, sans-serif',
                    fontSize: 12,
                    fontWeight: 800,
                    opacity: !draft.trim() ? 0.45 : 1,
                    padding: '9px 12px',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Sources consulted by the LLM during Remix. Review each before
                approving to verify any quotes or facts pulled from the web. */}
            {sources.length > 0 && (
              <div
                style={{
                  marginBottom: 20,
                  padding: '12px 14px',
                  background: '#0a0a0a',
                  border: '1px solid #1a1a1a',
                  borderRadius: 6,
                }}
              >
                <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, marginBottom: 8 }}>
                  Sources consulted ({sources.length}) — verify before approving
                </p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sources.map((s, i) => (
                    <li key={i} style={{ fontSize: 13, lineHeight: 1.4 }}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#7dd3fc', textDecoration: 'none' }}
                      >
                        {s.title}
                      </a>
                      <span style={{ color: '#555', marginLeft: 8, fontSize: 11 }}>
                        {(() => {
                          try { return new URL(s.url).hostname.replace(/^www\./, '') } catch { return '' }
                        })()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>
            )}

            {/* Actions. Remix sits between Approve and Skip — edit the draft
                inline (add notes, rewrites, whatever), hit Remix, and it writes
                a fresh cohesive answer from what's currently in the textarea. */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => handleApprove(openItem.id, true)}
                disabled={approving || !draft.trim() || !hasNextAfterApprove}
                style={{
                  background: approving ? '#ccc' : '#fbbf24', color: '#111',
                  border: 'none', borderRadius: 8, padding: '14px 24px',
                  fontSize: 15, fontWeight: 900, cursor: approving ? 'wait' : 'pointer',
                  opacity: !draft.trim() || !hasNextAfterApprove ? 0.5 : 1, minHeight: 48,
                  fontFamily: '-apple-system, sans-serif',
                }}
              >
                {approving ? <LoadingDots label="Sending" /> : 'Approve & next →'}
              </button>
              <button
                onClick={() => handleApprove(openItem.id)}
                disabled={approving || !draft.trim()}
                style={{
                  background: approving ? '#ccc' : '#6366f1', color: '#fff',
                  border: 'none', borderRadius: 8, padding: '14px 22px',
                  fontSize: 15, fontWeight: 800, cursor: approving ? 'wait' : 'pointer',
                  opacity: !draft.trim() ? 0.5 : 1, minHeight: 48,
                  fontFamily: '-apple-system, sans-serif',
                }}
              >
                {approving ? <LoadingDots label="Sending" /> : openItem.status === 'approved' ? 'Update & re-send' : 'Approve'}
              </button>
              <button
                onClick={() => handleRemix()}
                disabled={remixing || !draft.trim()}
                title="Edit the draft, add notes inline, then Remix to regenerate a fresh answer from what's in the textarea."
                style={{
                  background: 'none',
                  border: '1px solid #fff',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14, fontWeight: 700,
                  padding: '12px 20px',
                  cursor: remixing ? 'wait' : 'pointer',
                  opacity: !draft.trim() ? 0.4 : 1, minHeight: 48,
                  fontFamily: '-apple-system, sans-serif',
                }}
              >
                {remixing ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <ThreeDots size={3} animate color="#fff" />
                    <span>Remixing</span>
                  </span>
                ) : 'Remix ↻'}
              </button>
              <button
                onClick={() => handleSkip(openItem.id)}
                style={{
                  background: 'none', border: '1px solid #333', borderRadius: 8,
                  color: '#888', fontSize: 14, padding: '12px 20px', cursor: 'pointer',
                  minHeight: 48, fontFamily: '-apple-system, sans-serif',
                }}
              >
                Skip
              </button>
            </div>
          </main>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AnswerBriefCard brief={brief} />
            <QualityChecklist checks={checks} wordCount={wordCount} />

            {openItem.source_url && (
              <InfoCard title="Source">
                <a href={openItem.source_url} target="_blank" rel="noopener noreferrer" style={{ color: '#7dd3fc', fontSize: 13, textDecoration: 'none' }}>
                  View source ↗
                </a>
              </InfoCard>
            )}

            {/* Dupes list — everyone else who asked this same question (different
                wording). Approving sends the same answer to all of them. */}
            {openItem.dupes && openItem.dupes.length > 0 && (
              <details style={{ padding: 14, border: '1px solid #2a2015', borderRadius: 10, background: '#15100a' }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: '#fbbf24', fontWeight: 800 }}>
                  {openItem.dupes.length + 1} players need this answer
                </summary>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {openItem.dupes.map((d) => (
                    <div key={d.id} style={{ fontSize: 12, color: '#ccc', lineHeight: 1.5 }}>
                      <span style={{ color: '#888', fontSize: 10 }}>
                        {(d.email || 'anon').split('@')[0]} · {formatDate(d.created_at)}
                      </span>
                      <br />
                      <span style={{ fontStyle: 'italic' }}>&ldquo;{d.question}&rdquo;</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </aside>
        </div>
      </div>
    )
  }

  // ── Grid view ──────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 6px' }}>
            Daily Dashboard
          </p>
          <h1 style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 800, color: '#fff', margin: 0, fontFamily: '-apple-system, sans-serif' }}>
            Questions Ready For You
          </h1>
        </div>
        <button
          onClick={runResearchNow}
          disabled={researching}
          style={{
            background: researching ? '#222' : '#fff',
            color: researching ? '#777' : '#000',
            border: '1px solid #fff',
            borderRadius: 6,
            padding: '10px 14px',
            fontSize: 12,
            fontWeight: 800,
            cursor: researching ? 'wait' : 'pointer',
            fontFamily: '-apple-system, sans-serif',
          }}
        >
          {researching ? <LoadingDots label="Researching" /> : 'Find new pain points'}
        </button>
      </div>

      {filter === 'pending' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}>
          <SummaryCard label="Research prompts" value={researchItems.length} color="#7dd3fc" />
          <SummaryCard label="Player questions" value={playerItems.length} color="#fbbf24" />
          <SummaryCard label="Total ready" value={items.length} color="#fff" />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 6, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#4ade80', fontFamily: '-apple-system, sans-serif' }}>
          ✓ {toast}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, borderBottom: '1px solid #1a1a1a', paddingBottom: 10 }}>
        {(['pending', 'answered', 'skipped'] as StatusFilter[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              background: 'none', border: 'none',
              color: filter === tab ? '#fff' : '#555',
              fontWeight: filter === tab ? 700 : 400,
              fontSize: 14, cursor: 'pointer',
              borderBottom: filter === tab ? '2px solid #fff' : '2px solid transparent',
              paddingBottom: 4, fontFamily: '-apple-system, sans-serif',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ color: '#777', fontSize: 14, fontFamily: '-apple-system, sans-serif' }}>
          <LoadingDots label="Loading" />
        </div>
      )}

      {/* Empty */}
      {!loading && items.length === 0 && (
        <p style={{ color: '#555', fontSize: 14, fontFamily: '-apple-system, sans-serif' }}>
          No {filter} questions.
        </p>
      )}

      {/* Focus queue */}
      {!loading && items.length > 0 && (
        <>
          {filter === 'pending' ? (
            <>
              <div style={{
                border: '1px solid #23231b',
                background: 'linear-gradient(135deg, #11110b 0%, #08090f 52%, #061018 100%)',
                borderRadius: 14,
                padding: 'clamp(16px, 4vw, 22px)',
                marginBottom: 18,
                boxShadow: '0 18px 60px rgba(0,0,0,0.35)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <p style={{ color: '#fbbf24', fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 6px' }}>
                      Today&apos;s focus
                    </p>
                    <h2 style={{ color: '#fff', fontSize: 20, lineHeight: 1.15, margin: 0 }}>
                      Answer these 5 first
                    </h2>
                    <p style={{ color: '#777', fontSize: 12, lineHeight: 1.5, margin: '8px 0 0', maxWidth: 460 }}>
                      Sorted by repeat demand, real-player urgency, research signal, and recency.
                    </p>
                  </div>
                  {nextFocus && (
                    <button
                      onClick={() => {
                        setOpenId(nextFocus.id)
                        setDraft(nextFocus.answer || '')
                        setError(null)
                        setSources([])
                        setRemixNotice(null)
                      }}
                      style={{
                        background: '#fbbf24',
                        border: '1px solid #fbbf24',
                        borderRadius: 999,
                        color: '#111',
                        cursor: 'pointer',
                        fontFamily: '-apple-system, sans-serif',
                        fontSize: 12,
                        fontWeight: 900,
                        padding: '10px 14px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Start answering →
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {focusItems.map((q, index) => (
                    <FocusCard
                      key={q.id}
                      q={q}
                      rank={index + 1}
                      onOpen={() => {
                        setOpenId(q.id)
                        setDraft(q.answer || '')
                        setError(null)
                        setSources([])
                        setRemixNotice(null)
                      }}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </div>

              {backlogItems.length > 0 && (
                <details style={{ marginBottom: 22 }}>
                  <summary style={{
                    color: '#aaa',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 800,
                    marginBottom: 12,
                    userSelect: 'none',
                  }}>
                    Backlog ({backlogItems.length}) — open when you want more
                  </summary>
                  <QueueSection title="More questions" subtitle="Lower priority for now, but still available." />
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 10,
                  }}>
                    {backlogItems.map((q) => (
                      <QueueCard
                        key={q.id}
                        q={q}
                        onOpen={() => {
                          setOpenId(q.id)
                          setDraft(q.answer || '')
                          setError(null)
                          setSources([])
                          setRemixNotice(null)
                        }}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : (
            <>
              <QueueSection
                title={filter === 'answered' ? 'Answered archive' : 'Skipped archive'}
                subtitle={filter === 'answered' ? 'Questions already approved or answered.' : 'Questions you decided not to answer.'}
              />
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 10,
              }}>
                {items.map((q) => (
                  <QueueCard
                    key={q.id}
                    q={q}
                    onOpen={() => {
                      setOpenId(q.id)
                      setDraft(q.answer || '')
                      setError(null)
                      setSources([])
                      setRemixNotice(null)
                    }}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ border: '1px solid #171717', background: '#050505', borderRadius: 8, padding: 14 }}>
      <p style={{ color, fontSize: 24, fontWeight: 900, lineHeight: 1, margin: '0 0 8px' }}>{value}</p>
      <p style={{ color: '#666', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{label}</p>
    </div>
  )
}

function AnswerBriefCard({ brief }: { brief: ReturnType<typeof getAnswerBrief> }) {
  return (
    <InfoCard title="Answer brief">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <BriefRow label="Topic" value={brief.topic} />
        <BriefRow label="Player needs" value={brief.emotion} />
        <BriefRow label="Include" value={brief.include} />
      </div>
    </InfoCard>
  )
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ color: '#666', fontSize: 10, letterSpacing: '0.1em', margin: '0 0 4px', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ color: '#ddd', fontSize: 13, lineHeight: 1.45, margin: 0 }}>{value}</p>
    </div>
  )
}

function QualityChecklist({
  checks,
  wordCount,
}: {
  checks: Array<{ label: string; passed: boolean }>
  wordCount: number
}) {
  return (
    <InfoCard title="Ready check">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {checks.map((check) => (
          <div key={check.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              alignItems: 'center',
              background: check.passed ? '#0a1f15' : '#171717',
              border: check.passed ? '1px solid #1f4030' : '1px solid #2a2a2a',
              borderRadius: 999,
              color: check.passed ? '#34d399' : '#666',
              display: 'flex',
              fontSize: 10,
              fontWeight: 900,
              height: 18,
              justifyContent: 'center',
              width: 18,
            }}>
              {check.passed ? '✓' : '·'}
            </span>
            <span style={{ color: check.passed ? '#ddd' : '#777', fontSize: 13, fontWeight: 700 }}>
              {check.label}
            </span>
          </div>
        ))}
        {wordCount > 260 && (
          <p style={{ color: '#fbbf24', fontSize: 12, lineHeight: 1.45, margin: '4px 0 0' }}>
            This is getting long. Try the Shorter remix before approving.
          </p>
        )}
      </div>
    </InfoCard>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#070707',
      border: '1px solid #1e1e1e',
      borderRadius: 12,
      padding: 14,
    }}>
      <p style={{ color: '#888', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', margin: '0 0 12px', textTransform: 'uppercase' }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function QueueSection({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ margin: '18px 0 10px' }}>
      <p style={{ color: '#fff', fontSize: 13, fontWeight: 800, margin: '0 0 4px' }}>{title}</p>
      <p style={{ color: '#555', fontSize: 12, margin: 0 }}>{subtitle}</p>
    </div>
  )
}

function FocusCard({
  q,
  rank,
  onOpen,
  formatDate,
}: {
  q: PlayerQuestion
  rank: number
  onOpen: () => void
  formatDate: (iso: string) => string
}) {
  const reasons = getQueueReasons(q)

  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%',
        background: rank === 1 ? 'rgba(251, 191, 36, 0.08)' : 'rgba(10, 13, 26, 0.92)',
        border: rank === 1 ? '1px solid rgba(251, 191, 36, 0.38)' : '1px solid #1a2040',
        borderRadius: 12,
        color: '#fff',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '34px 1fr auto',
        gap: 12,
        alignItems: 'center',
        padding: 14,
        textAlign: 'left',
        fontFamily: '-apple-system, sans-serif',
      }}
    >
      <span style={{
        alignItems: 'center',
        background: rank === 1 ? '#fbbf24' : '#111827',
        border: rank === 1 ? '1px solid #fbbf24' : '1px solid #293044',
        borderRadius: 999,
        color: rank === 1 ? '#111' : '#aaa',
        display: 'flex',
        fontSize: 12,
        fontWeight: 900,
        height: 30,
        justifyContent: 'center',
        width: 30,
      }}>
        {rank}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{
          color: '#fff',
          display: '-webkit-box',
          fontSize: 15,
          fontWeight: 800,
          lineHeight: 1.35,
          marginBottom: 8,
          overflow: 'hidden',
          WebkitBoxOrient: 'vertical' as const,
          WebkitLineClamp: 2,
        }}>
          {q.question}
        </span>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {reasons.map((reason) => (
            <ReasonPill key={reason.label} reason={reason} />
          ))}
        </span>
      </span>
      <span style={{ color: '#596080', fontSize: 11, whiteSpace: 'nowrap' }}>
        {formatDate(q.created_at)}
      </span>
    </button>
  )
}

function QueueCard({
  q,
  onOpen,
  formatDate,
}: {
  q: PlayerQuestion
  onOpen: () => void
  formatDate: (iso: string) => string
}) {
  return (
    <button
      key={q.id}
      onClick={onOpen}
      style={{
        background: '#0a0d1a',
        border: q.reviewed_by_elijah ? '1px solid #1f4030' : '1px solid #1a2040',
        borderRadius: 8,
        padding: 14,
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: '-apple-system, sans-serif',
        minHeight: 100,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 8,
        position: 'relative',
      }}
    >
      {q.reviewed_by_elijah && (
        <span style={badgeStyle('#34d399', '#0a1f15', '#1f4030')}>✓ Reviewed</span>
      )}
      {q.item_type === 'pain_point' && (
        <span title="Researched pain point" style={badgeStyle('#7dd3fc', '#07131a', '#123040')}>Research</span>
      )}
      <p style={{
        fontSize: 13, fontWeight: 600, color: '#fff', margin: 0,
        lineHeight: 1.4, overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical' as const,
        paddingRight: q.reviewed_by_elijah || q.item_type === 'pain_point' ? 72 : 0,
      }}>
        {q.question}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#555' }}>
          {q.item_type === 'pain_point' ? 'research' : q.email ? q.email.split('@')[0] : 'anon'}
          {q.dupes && q.dupes.length > 0 && (
            <span style={{ color: '#fbbf24', background: '#2a2015', padding: '1px 6px', borderRadius: 10, fontWeight: 700, marginLeft: 4 }}>
              +{q.dupes.length}
            </span>
          )}
        </span>
        <span style={{ fontSize: 10, color: '#3a4570' }}>{formatDate(q.created_at)}</span>
      </div>
    </button>
  )
}

function ReasonPill({ reason }: { reason: QueueReason }) {
  const tones: Record<QueueReason['tone'], { color: string; background: string; border: string }> = {
    blue: { color: '#7dd3fc', background: '#07131a', border: '#123040' },
    gold: { color: '#fbbf24', background: '#2a2015', border: '#4a3512' },
    green: { color: '#34d399', background: '#0a1f15', border: '#1f4030' },
    gray: { color: '#aaa', background: '#111', border: '#252525' },
  }
  const tone = tones[reason.tone]

  return (
    <span style={{
      background: tone.background,
      border: `1px solid ${tone.border}`,
      borderRadius: 999,
      color: tone.color,
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '0.02em',
      padding: '3px 7px',
      whiteSpace: 'nowrap',
    }}>
      {reason.label}
    </span>
  )
}

function badgeStyle(color: string, background: string, border: string): React.CSSProperties {
  return {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 9,
    fontWeight: 700,
    color,
    background,
    border: `1px solid ${border}`,
    borderRadius: 999,
    padding: '2px 6px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  }
}
