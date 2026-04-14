'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase-client'

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

type StatusFilter = 'pending' | 'answered' | 'skipped'

function AutoResizeTextarea({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
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

function QuestionCard({
  item,
  onPublished,
  onSkipped,
}: {
  item: PainPoint
  onPublished: (id: string) => void
  onSkipped: (id: string) => void
}) {
  const [draft, setDraft] = useState(item.draft_answer || item.final_answer || '')
  const [expanded, setExpanded] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePublish() {
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
  }

  async function handleSkip() {
    setSkipping(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/questions/${item.id}/skip`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to skip')
      onSkipped(item.id)
    } catch {
      setError('Failed to skip. Try again.')
    } finally {
      setSkipping(false)
    }
  }

  if (published) {
    return (
      <div
        style={{
          border: '1px solid #1a3a1a',
          borderRadius: '8px',
          padding: '20px',
          background: '#0a1a0a',
          marginBottom: '16px',
          transition: 'opacity 0.4s',
          opacity: 0.5,
        }}
      >
        <p style={{ color: '#22c55e', fontSize: '14px', fontWeight: 600, margin: 0 }}>Published</p>
      </div>
    )
  }

  const kbSources: KbSource[] = Array.isArray(item.kb_sources) ? item.kb_sources : []

  return (
    <div
      style={{
        border: '1px solid #222',
        borderRadius: '8px',
        padding: '24px',
        background: '#0a0a0a',
        marginBottom: '16px',
      }}
    >
      {/* Source badge + link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span
          style={{
            background: '#c2410c',
            color: '#ffffff',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: '4px',
          }}
        >
          Reddit
        </span>
        {item.source_context && (
          <span style={{ fontSize: '12px', color: '#555', fontFamily: '-apple-system, sans-serif' }}>
            r/{item.source_context}
          </span>
        )}
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '12px', color: '#555', textDecoration: 'none', marginLeft: 'auto' }}
          >
            View post →
          </a>
        )}
      </div>

      {/* Cleaned question */}
      <p
        style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#ffffff',
          lineHeight: '1.4',
          margin: '0 0 16px',
          fontFamily: '-apple-system, sans-serif',
        }}
      >
        {item.cleaned_question}
      </p>

      {/* Collapsible original post */}
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            color: '#555',
            fontSize: '12px',
            cursor: 'pointer',
            padding: 0,
            fontFamily: '-apple-system, sans-serif',
          }}
        >
          {expanded ? 'Hide' : 'Show'} original post
        </button>
        {expanded && (
          <p
            style={{
              fontSize: '13px',
              color: '#666',
              lineHeight: '1.6',
              margin: '10px 0 0',
              fontFamily: '-apple-system, sans-serif',
              whiteSpace: 'pre-wrap',
            }}
          >
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
              <div
                key={i}
                style={{
                  background: '#111',
                  border: '1px solid #2a2a2a',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  maxWidth: '300px',
                }}
              >
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
        <AutoResizeTextarea value={draft} onChange={setDraft} />
      </div>

      {/* Error */}
      {error && (
        <p style={{ fontSize: '13px', color: '#ef4444', margin: '0 0 12px', fontFamily: '-apple-system, sans-serif' }}>
          {error}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={handlePublish}
          disabled={publishing || !draft.trim()}
          style={{
            background: publishing ? '#ccc' : '#ffffff',
            color: '#000000',
            border: 'none',
            borderRadius: '6px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: publishing ? 'wait' : 'pointer',
            fontFamily: '-apple-system, sans-serif',
            opacity: !draft.trim() ? 0.5 : 1,
          }}
        >
          {publishing ? 'Publishing...' : 'Publish →'}
        </button>
        <button
          onClick={handleSkip}
          disabled={skipping}
          style={{
            background: 'none',
            border: 'none',
            color: '#555',
            fontSize: '14px',
            cursor: skipping ? 'wait' : 'pointer',
            fontFamily: '-apple-system, sans-serif',
            textDecoration: 'none',
          }}
        >
          {skipping ? 'Skipping...' : 'Skip'}
        </button>
      </div>
    </div>
  )
}

export default function AdminQuestionsPage() {
  const [items, setItems] = useState<PainPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [pendingCount, setPendingCount] = useState(0)

  const supabase = getSupabaseClient()

  async function load(status: StatusFilter) {
    setLoading(true)
    const { data } = await supabase
      .from('pain_points')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(50)
    setItems((data as PainPoint[]) || [])
    setLoading(false)
  }

  async function loadPendingCount() {
    const { count } = await supabase
      .from('pain_points')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
    setPendingCount(count || 0)
  }

  useEffect(() => {
    load(filter)
    loadPendingCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  function handlePublished(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    setPendingCount((c) => Math.max(0, c - 1))
  }

  function handleSkipped(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    if (filter === 'pending') setPendingCount((c) => Math.max(0, c - 1))
  }

  const tabs: StatusFilter[] = ['pending', 'answered', 'skipped']

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: '-apple-system, sans-serif' }}>
          Question Queue
        </h1>
        {pendingCount > 0 && (
          <span
            style={{
              background: '#ffffff',
              color: '#000000',
              fontSize: '12px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '100px',
              fontFamily: '-apple-system, sans-serif',
            }}
          >
            {pendingCount}
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '32px', borderBottom: '1px solid #1a1a1a', paddingBottom: '0' }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              background: 'none',
              border: 'none',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: filter === tab ? 700 : 400,
              color: filter === tab ? '#ffffff' : '#555',
              cursor: 'pointer',
              borderBottom: filter === tab ? '2px solid #ffffff' : '2px solid transparent',
              marginBottom: '-1px',
              fontFamily: '-apple-system, sans-serif',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <p style={{ color: '#555', fontSize: '14px', fontFamily: '-apple-system, sans-serif' }}>Loading...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#555', fontSize: '14px', fontFamily: '-apple-system, sans-serif' }}>
          No {filter} questions.
        </p>
      ) : (
        items.map((item) => (
          <QuestionCard
            key={item.id}
            item={item}
            onPublished={handlePublished}
            onSkipped={handleSkipped}
          />
        ))
      )}
    </div>
  )
}
