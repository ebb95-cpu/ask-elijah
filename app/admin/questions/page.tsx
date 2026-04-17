'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminQuestionsPage() {
  const [items, setItems] = useState<PlayerQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [toast, setToast] = useState<string | null>(null)
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

  const load = useCallback(async (status: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/queue?status=${status}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setItems(data.questions || [])
    } catch (e) {
      console.error('Queue load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(filter === 'answered' ? 'answered' : filter)
    setOpenId(null)
  }, [filter, load])

  const handleApprove = async (questionId: string) => {
    if (!draft.trim()) return
    const group = items.find((q) => q.id === questionId)
    const dupeIds = group?.dupes?.map((d) => d.id) ?? []
    const allIds = [questionId, ...dupeIds]
    setApproving(true)
    setError(null)
    try {
      // One approver, N recipients: if the card represents a cluster,
      // bulk-approve sends the same answer to every asker in the cluster.
      // Single card still goes through approve-question because that's the
      // path wired to scorecard + shared approve pipeline.
      if (allIds.length > 1) {
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
        setToast(`Approved ${data.succeeded ?? allIds.length} — emails sent`)
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
      setOpenId(null)
      setDraft('')
      setSources([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve')
    } finally {
      setApproving(false)
    }
  }

  const handleRemix = async () => {
    if (!openItem || !draft.trim() || remixing) return
    setRemixing(true)
    setError(null)
    try {
      // Whatever's in the textarea is the raw material — previous draft plus
      // any notes Elijah inlined. The endpoint writes a new cohesive answer
      // from scratch using it.
      const res = await fetch('/api/admin/regenerate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: openItem.question, context: draft }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `${res.status}`)
      }
      const data = await res.json()
      if (!data.draft) throw new Error('Empty remix response')
      setDraft(data.draft)
      setSources(Array.isArray(data.sources) ? data.sources : [])
      setToast(
        data.sources?.length
          ? `Remixed — ${data.sources.length} source${data.sources.length === 1 ? '' : 's'} consulted`
          : 'Remixed — review the new draft'
      )
      setTimeout(() => setToast(null), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remix')
    } finally {
      setRemixing(false)
    }
  }

  const handleSkip = async (questionId: string) => {
    try {
      const { getSupabaseClient } = await import('@/lib/supabase-client')
      const supabase = getSupabaseClient()
      await supabase.from('questions').update({ status: 'skipped' }).eq('id', questionId)
      setItems((prev) => prev.filter((q) => q.id !== questionId))
      setOpenId(null)
    } catch {
      setError('Failed to skip')
    }
  }

  const openItem = openId ? items.find((q) => q.id === openId) : null

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
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)' }}>
        <button
          onClick={() => { setOpenId(null); setDraft(''); setError(null); setSources([]) }}
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
            {openItem.email || 'anon'} · {formatDate(openItem.created_at)}
            {openItem.dupes && openItem.dupes.length > 0 && (
              <> · <span style={{ color: '#fbbf24' }}>+{openItem.dupes.length} asked the same</span></>
            )}
          </p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.4, margin: 0 }}>
            {openItem.question}
          </p>
        </div>

        {/* Dupes list — everyone else who asked this same question (different
            wording). Approving sends the same answer to all of them. */}
        {openItem.dupes && openItem.dupes.length > 0 && (
          <details style={{ marginBottom: 20, padding: 12, border: '1px solid #2a2015', borderRadius: 6, background: '#15100a' }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>
              Also asked by {openItem.dupes.length} {openItem.dupes.length === 1 ? 'person' : 'people'} — all get the same answer on approve
            </summary>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {openItem.dupes.map((d) => (
                <div key={d.id} style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>
                  <span style={{ color: '#888', fontSize: 11 }}>
                    {(d.email || 'anon').split('@')[0]} · {formatDate(d.created_at)}
                  </span>
                  <br />
                  <span style={{ fontStyle: 'italic' }}>&ldquo;{d.question}&rdquo;</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Editable answer */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            {openItem.status === 'approved' ? 'Answer (editable — update & re-send)' : 'Your answer (editable)'}
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            style={{
              width: '100%', background: '#0a0a0a', color: '#fff',
              border: '1px solid #333', borderRadius: 6, padding: 12,
              fontSize: 16, lineHeight: 1.6, resize: 'vertical',
              outline: 'none', fontFamily: '-apple-system, sans-serif',
              boxSizing: 'border-box',
            }}
          />
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
            onClick={() => handleApprove(openItem.id)}
            disabled={approving || !draft.trim()}
            style={{
              background: approving ? '#ccc' : '#6366f1', color: '#fff',
              border: 'none', borderRadius: 6, padding: '14px 24px',
              fontSize: 15, fontWeight: 700, cursor: approving ? 'wait' : 'pointer',
              opacity: !draft.trim() ? 0.5 : 1, minHeight: 48,
              fontFamily: '-apple-system, sans-serif',
            }}
          >
            {approving ? 'Sending...' : openItem.status === 'approved' ? 'Update & re-send →' : 'Approve →'}
          </button>
          <button
            onClick={handleRemix}
            disabled={remixing || !draft.trim()}
            title="Edit the draft, add notes inline, then Remix to regenerate a fresh answer from what's in the textarea."
            style={{
              background: 'none',
              border: '1px solid #fff',
              borderRadius: 6,
              color: '#fff',
              fontSize: 14, fontWeight: 700,
              padding: '12px 20px',
              cursor: remixing ? 'wait' : 'pointer',
              opacity: !draft.trim() ? 0.4 : 1, minHeight: 48,
              fontFamily: '-apple-system, sans-serif',
            }}
          >
            {remixing ? 'Remixing...' : 'Remix ↻'}
          </button>
          <button
            onClick={() => handleSkip(openItem.id)}
            style={{
              background: 'none', border: '1px solid #333', borderRadius: 6,
              color: '#888', fontSize: 14, padding: '12px 20px', cursor: 'pointer',
              minHeight: 48, fontFamily: '-apple-system, sans-serif',
            }}
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  // ── Grid view ──────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 800, color: '#fff', margin: 0, fontFamily: '-apple-system, sans-serif' }}>
          Question Queue
        </h1>
      </div>

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
        <p style={{ color: '#555', fontSize: 14, fontFamily: '-apple-system, sans-serif' }}>Loading...</p>
      )}

      {/* Empty */}
      {!loading && items.length === 0 && (
        <p style={{ color: '#555', fontSize: 14, fontFamily: '-apple-system, sans-serif' }}>
          No {filter} questions.
        </p>
      )}

      {/* Grid */}
      {!loading && items.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 10,
        }}>
          {items.map((q) => (
            <button
              key={q.id}
              onClick={() => {
                setOpenId(q.id)
                setDraft(q.answer || '')
                setError(null)
              }}
              style={{
                background: '#0a0d1a',
                // Reviewed cards get a subtle green accent so they're
                // visually distinct from raw AI-drafted or pending cards.
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
                <span
                  title="Reviewed by Elijah"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#34d399',
                    background: '#0a1f15',
                    border: '1px solid #1f4030',
                    borderRadius: 999,
                    padding: '2px 6px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  ✓ Reviewed
                </span>
              )}
              <p style={{
                fontSize: 13, fontWeight: 600, color: '#fff', margin: 0,
                lineHeight: 1.4, overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical' as const,
                // Leave room for the badge in the top-right corner on reviewed cards.
                paddingRight: q.reviewed_by_elijah ? 72 : 0,
              }}>
                {q.question}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                {/* Email can be null on pain-point-style records. Crashed the
                    admin queue on mobile when .split was called on null. */}
                <span style={{ fontSize: 10, color: '#555' }}>
                  {q.email ? q.email.split('@')[0] : 'anon'}
                  {q.dupes && q.dupes.length > 0 && (
                    <>
                      {' '}
                      <span style={{
                        color: '#fbbf24',
                        background: '#2a2015',
                        padding: '1px 6px',
                        borderRadius: 10,
                        fontWeight: 700,
                        marginLeft: 2,
                      }}>
                        +{q.dupes.length}
                      </span>
                    </>
                  )}
                </span>
                <span style={{ fontSize: 10, color: '#3a4570' }}>{formatDate(q.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
