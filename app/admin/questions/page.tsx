'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlayerQuestion {
  id: string
  question: string
  answer: string | null
  status: string
  email: string
  created_at: string
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
  // Remix: extra context the admin wants woven into a fresh answer. Posts to
  // /api/admin/regenerate-draft with (question + current draft + this text)
  // and replaces the draft with whatever the model writes from scratch.
  const [remixInfo, setRemixInfo] = useState('')
  const [remixing, setRemixing] = useState(false)

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
    setApproving(true)
    setError(null)
    try {
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
      setTimeout(() => setToast(null), 3000)
      setItems((prev) => prev.filter((q) => q.id !== questionId))
      setOpenId(null)
      setDraft('')
      setRemixInfo('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve')
    } finally {
      setApproving(false)
    }
  }

  const handleRemix = async () => {
    if (!openItem || !remixInfo.trim() || remixing) return
    setRemixing(true)
    setError(null)
    try {
      // Combine the current draft + new info into one context block. The
      // endpoint treats it as raw material and writes a NEW answer from
      // scratch — doesn't append or reference either piece.
      const context = `Previous draft:\n${draft.trim() || '(none yet)'}\n\n---\n\nAdditional info from Elijah:\n${remixInfo.trim()}`
      const res = await fetch('/api/admin/regenerate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: openItem.question, context }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `${res.status}`)
      }
      const data = await res.json()
      if (!data.draft) throw new Error('Empty remix response')
      setDraft(data.draft)
      setRemixInfo('')
      setToast('Remixed — review the new draft')
      setTimeout(() => setToast(null), 2500)
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
      setRemixInfo('')
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
          onClick={() => { setOpenId(null); setDraft(''); setError(null); setRemixInfo('') }}
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
          </p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.4, margin: 0 }}>
            {openItem.question}
          </p>
        </div>

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

        {/* Remix: add more context and regenerate the answer from scratch.
            The endpoint takes (question + current draft + this box) and writes
            a fresh, cohesive answer — doesn't append, doesn't reference. */}
        <div style={{ marginBottom: 20, padding: 14, border: '1px solid #1a2040', borderRadius: 6, background: '#0a0d1a' }}>
          <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Add more info, then remix
          </p>
          <textarea
            value={remixInfo}
            onChange={(e) => setRemixInfo(e.target.value)}
            rows={4}
            placeholder="What's missing? Add context, angles to emphasize, stories, corrections — anything. Hit remix and I'll write a new answer using the draft above plus this."
            style={{
              width: '100%', background: '#000', color: '#fff',
              border: '1px solid #333', borderRadius: 6, padding: 12,
              fontSize: 16, lineHeight: 1.6, resize: 'vertical',
              outline: 'none', fontFamily: '-apple-system, sans-serif',
              boxSizing: 'border-box', marginBottom: 10,
            }}
          />
          <button
            onClick={handleRemix}
            disabled={remixing || !remixInfo.trim()}
            style={{
              background: remixing ? '#333' : '#fff',
              color: remixing ? '#888' : '#000',
              border: 'none', borderRadius: 6, padding: '10px 18px',
              fontSize: 14, fontWeight: 700,
              cursor: remixing ? 'wait' : 'pointer',
              opacity: !remixInfo.trim() ? 0.4 : 1, minHeight: 44,
              fontFamily: '-apple-system, sans-serif',
            }}
          >
            {remixing ? 'Remixing...' : 'Remix →'}
          </button>
        </div>

        {error && (
          <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}

        {/* Actions */}
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
        <Link href="/admin/signals" style={{ fontSize: 12, color: '#888', textDecoration: 'none' }}>Signals →</Link>
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
                border: '1px solid #1a2040',
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
              }}
            >
              <p style={{
                fontSize: 13, fontWeight: 600, color: '#fff', margin: 0,
                lineHeight: 1.4, overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical' as const,
              }}>
                {q.question}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Email can be null on pain-point-style records. Crashed the
                    admin queue on mobile when .split was called on null. */}
                <span style={{ fontSize: 10, color: '#555' }}>
                  {q.email ? q.email.split('@')[0] : 'anon'}
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
