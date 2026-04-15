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

// ── Upload Panel ──────────────────────────────────────────────────────────────

/**
 * Knowledge base upload: paste text, drop a PDF, or give it a URL.
 * Everything gets chunked, embedded, and pushed into Pinecone so future
 * questions can retrieve from it. This is the "feed the AI" input.
 */
function UploadPanel() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'text' | 'url' | 'file'>('text')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const canSubmit = !!title.trim() && (
    (mode === 'text' && text.trim().length > 50) ||
    (mode === 'url' && /^https?:\/\//i.test(url)) ||
    (mode === 'file' && !!file)
  )

  const reset = () => {
    setText('')
    setUrl('')
    setFile(null)
    setTitle('')
    setTopic('')
    setLevel('')
  }

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setResult(null)
    try {
      let body: Record<string, unknown> = { source_title: title, topic: topic || undefined, level: level || undefined }

      if (mode === 'text') {
        body = { ...body, type: 'text', content: text }
      } else if (mode === 'url') {
        body = { ...body, type: 'url', content: url, source_url: url }
      } else if (mode === 'file' && file) {
        // Base64-encode the file. Chunked to avoid call-stack overflow for
        // large PDFs (apply/spread has a ~100k argument limit).
        const buf = new Uint8Array(await file.arrayBuffer())
        let binary = ''
        const chunk = 0x8000
        for (let i = 0; i < buf.length; i += chunk) {
          binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)))
        }
        const b64 = btoa(binary)
        body = { ...body, type: 'pdf_base64', content: b64 }
      }

      const res = await fetch('/api/admin/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ ok: false, msg: data.error || 'Upload failed' })
      } else {
        setResult({ ok: true, msg: `Added ${data.chunks} chunk${data.chunks === 1 ? '' : 's'} from "${data.source_title}"` })
        reset()
      }
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : 'Upload failed' })
    } finally {
      setSubmitting(false)
    }
  }

  const TABS: { id: typeof mode; label: string }[] = [
    { id: 'text', label: 'Paste text' },
    { id: 'url', label: 'URL' },
    { id: 'file', label: 'PDF' },
  ]

  return (
    <div
      style={{
        border: '1px solid #1a2040',
        borderRadius: '8px',
        background: '#080b14',
        marginBottom: '24px',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '14px 18px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#ffffff',
          fontFamily: '-apple-system, sans-serif',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              background: '#1e3a8a',
              color: '#93c5fd',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: '4px',
            }}
          >
            Knowledge Base
          </span>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Feed the AI</span>
          <span style={{ fontSize: '12px', color: '#666' }}>Paste text, drop a PDF, or give it a URL</span>
        </div>
        <span style={{ fontSize: '18px', color: '#666' }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid #1a2040' }}>
          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '16px', marginBottom: '16px' }}>
            {TABS.map((t) => {
              const active = mode === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setMode(t.id)}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    background: active ? '#1e3a8a' : 'transparent',
                    border: `1px solid ${active ? '#1e3a8a' : '#1a2040'}`,
                    color: active ? '#93c5fd' : '#666',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontFamily: '-apple-system, sans-serif',
                  }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Title */}
          <label style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: '-apple-system, sans-serif', display: 'block', marginBottom: '6px' }}>
            Source title (how this will appear in citations)
          </label>
          <input
            type="text"
            placeholder="e.g. Kobe 24-hour rule, How I handled my rookie year"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: '100%',
              background: '#0a0a0a',
              color: '#ffffff',
              border: '1px solid #333',
              borderRadius: '6px',
              padding: '10px',
              fontSize: '13px',
              fontFamily: '-apple-system, sans-serif',
              marginBottom: '12px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />

          {/* Mode-specific input */}
          {mode === 'text' && (
            <textarea
              placeholder="Paste transcript, newsletter, notes, or anything Elijah has said…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              style={{
                width: '100%',
                background: '#0a0a0a',
                color: '#ffffff',
                border: '1px solid #333',
                borderRadius: '6px',
                padding: '10px',
                fontSize: '13px',
                lineHeight: '1.6',
                fontFamily: '-apple-system, sans-serif',
                marginBottom: '12px',
                boxSizing: 'border-box',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          )}

          {mode === 'url' && (
            <input
              type="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{
                width: '100%',
                background: '#0a0a0a',
                color: '#ffffff',
                border: '1px solid #333',
                borderRadius: '6px',
                padding: '10px',
                fontSize: '13px',
                fontFamily: '-apple-system, sans-serif',
                marginBottom: '12px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          )}

          {mode === 'file' && (
            <div
              style={{
                border: '1px dashed #333',
                borderRadius: '6px',
                padding: '24px',
                textAlign: 'center',
                marginBottom: '12px',
                background: '#0a0a0a',
              }}
            >
              <input
                id="kb-file-input"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
              />
              <label
                htmlFor="kb-file-input"
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  background: '#1a2040',
                  color: '#93c5fd',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: '-apple-system, sans-serif',
                  cursor: 'pointer',
                }}
              >
                {file ? `Selected: ${file.name}` : 'Choose a PDF'}
              </label>
              {file && (
                <p style={{ fontSize: '11px', color: '#666', marginTop: '8px', fontFamily: '-apple-system, sans-serif' }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
          )}

          {/* Optional tags */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: '-apple-system, sans-serif', display: 'block', marginBottom: '4px' }}>Topic (optional)</label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0a0a0a',
                  color: '#ffffff',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  padding: '8px',
                  fontSize: '12px',
                  fontFamily: '-apple-system, sans-serif',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">—</option>
                {['confidence', 'pressure', 'consistency', 'focus', 'slump', 'coaching', 'team', 'mindset', 'motivation', 'identity'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: '-apple-system, sans-serif', display: 'block', marginBottom: '4px' }}>Level (optional)</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0a0a0a',
                  color: '#ffffff',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  padding: '8px',
                  fontSize: '12px',
                  fontFamily: '-apple-system, sans-serif',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">—</option>
                {['middle_school', 'jv', 'varsity', 'aau', 'college', 'pro', 'rec'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={submit}
              disabled={!canSubmit || submitting}
              style={{
                background: canSubmit && !submitting ? '#1e3a8a' : '#222',
                color: canSubmit && !submitting ? '#ffffff' : '#666',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
                fontFamily: '-apple-system, sans-serif',
              }}
            >
              {submitting ? 'Ingesting…' : 'Add to knowledge base →'}
            </button>
            {result && (
              <span
                style={{
                  fontSize: '12px',
                  color: result.ok ? '#4ade80' : '#ef4444',
                  fontFamily: '-apple-system, sans-serif',
                }}
              >
                {result.msg}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
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
  const ppDirty = draft.trim() !== ((item.draft_answer || item.final_answer || '').trim())

  return (
    <div
      data-card-id={`pp-${item.id}`}
      data-dirty={ppDirty ? 'true' : 'false'}
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
  onToast,
}: {
  item: PlayerQuestion
  focused: boolean
  onFocus: () => void
  onApproved: (id: string) => void
  onSkipped: (id: string) => void
  onToast?: (msg: string) => void
}) {
  const [draft, setDraft] = useState(item.answer || '')
  const [approving, setApproving] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typingInTextarea, setTypingInTextarea] = useState(false)
  const [similarQuestions, setSimilarQuestions] = useState<{ id: string; question: string; email: string; similarity: number }[]>([])
  const [showSimilarModal, setShowSimilarModal] = useState(false)
  const [selectedSimilar, setSelectedSimilar] = useState<Set<string>>(new Set())
  const [bulkApproving, setBulkApproving] = useState(false)
  const [originalDraft] = useState(item.answer || '')
  const [regenerating, setRegenerating] = useState(false)
  const [showRegenBanner, setShowRegenBanner] = useState(false)
  const [undoDraft, setUndoDraft] = useState<string | null>(null)

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
      onToast?.(`Email sent to ${item.email}`)

      // After approving, look for similar pending questions
      try {
        const simRes = await fetch('/api/admin/find-similar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: item.id, questionText: item.question }),
        })
        const simData = await simRes.json()
        if (simData.similar?.length > 0) {
          setSimilarQuestions(simData.similar)
          // Pre-select all by default
          setSelectedSimilar(new Set(simData.similar.map((q: { id: string }) => q.id)))
          setShowSimilarModal(true)
          return // Don't auto-dismiss — wait for modal action
        }
      } catch { /* fail silently — similarity check is best-effort */ }

      setApproved(true)
      setTimeout(() => onApproved(item.id), 800)
    } catch {
      setError('Failed to approve. Try again.')
    } finally {
      setApproving(false)
    }
  }, [draft, item.id, item.question, onApproved])

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

  const handleBulkApprove = async () => {
    if (selectedSimilar.size === 0) {
      setShowSimilarModal(false)
      setApproved(true)
      setTimeout(() => onApproved(item.id), 800)
      return
    }
    setBulkApproving(true)
    try {
      await fetch('/api/admin/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: Array.from(selectedSimilar), finalAnswer: draft }),
      })
      onToast?.(`Answer sent to ${selectedSimilar.size + 1} players`)
    } catch { /* fail silently */ }
    setBulkApproving(false)
    setShowSimilarModal(false)
    setApproved(true)
    setTimeout(() => onApproved(item.id), 800)
  }

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

  const isDirty = draft.trim() !== (originalDraft || '').trim()

  return (
    <div
      data-card-id={`pq-${item.id}`}
      data-dirty={isDirty ? 'true' : 'false'}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{
          background: '#3730a3', color: '#a5b4fc', fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px',
        }}>
          Player Question
        </span>
        <span style={{ fontSize: '12px', color: '#4a5180', fontFamily: '-apple-system, sans-serif' }}>
          From your site
        </span>
        <span style={{ fontSize: '12px', color: '#2d3a6b', fontFamily: '-apple-system, sans-serif' }}>
          ·
        </span>
        <span style={{ fontSize: '11px', color: '#3a4570', fontFamily: '-apple-system, sans-serif' }}>
          {item.email}
        </span>
        <span style={{ fontSize: '11px', color: '#2d3a6b', fontFamily: '-apple-system, sans-serif' }}>
          ·
        </span>
        <span style={{ fontSize: '11px', color: '#3a4570', fontFamily: '-apple-system, sans-serif' }}>
          {(() => {
            const d = new Date(item.created_at)
            return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
          })()}
        </span>
        {isDirty && (
          <span style={{ fontSize: '10px', color: '#f59e0b', fontFamily: '-apple-system, sans-serif' }}>
            ● unsaved
          </span>
        )}
        {focused && (
          <span style={{ fontSize: '10px', color: '#333', marginLeft: 'auto', fontFamily: '-apple-system, sans-serif' }}>
            ⌘↵ approve · S skip · J/K navigate
          </span>
        )}
      </div>

      {/* Question text */}
      <p style={{
        fontSize: 'clamp(16px, 4vw, 20px)', fontWeight: 700, color: '#ffffff', lineHeight: '1.4',
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
          onChange={(val) => {
            setDraft(val)
            setShowRegenBanner(val !== originalDraft)
          }}
          onFocus={() => setTypingInTextarea(true)}
          onBlur={() => setTypingInTextarea(false)}
        />

        {/* Regenerate banner — appears when Elijah adds new context */}
        {showRegenBanner && (
          <div style={{
            marginTop: '10px', background: '#0f1f35', border: '1px solid #1e3a5f',
            borderRadius: '6px', padding: '12px 16px', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
          }}>
            <p style={{ fontSize: '13px', color: '#93c5fd', margin: 0, fontFamily: '-apple-system, sans-serif', lineHeight: 1.4 }}>
              You edited the draft. Want Claude to clean it up with your notes?
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              {undoDraft !== null && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDraft(undoDraft)
                    setUndoDraft(null)
                    setShowRegenBanner(undoDraft !== originalDraft)
                  }}
                  style={{
                    background: 'none', border: 'none', color: '#6b7280', fontSize: '13px',
                    cursor: 'pointer', fontFamily: '-apple-system, sans-serif', textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Undo
                </button>
              )}
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  setUndoDraft(draft)
                  setRegenerating(true)
                  try {
                    const res = await fetch('/api/admin/regenerate-draft', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        question: item.question,
                        context: draft,
                      }),
                    })
                    const data = await res.json()
                    if (data.draft) {
                      setDraft(data.draft)
                      setShowRegenBanner(false)
                    }
                  } catch { /* fail silently */ }
                  setRegenerating(false)
                }}
                disabled={regenerating}
                style={{
                  background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px',
                  padding: '10px 16px', fontSize: '13px', fontWeight: 700,
                  cursor: regenerating ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                  opacity: regenerating ? 0.7 : 1,
                  fontFamily: '-apple-system, sans-serif', minHeight: '40px',
                }}
              >
                {regenerating ? 'Rewriting...' : 'Regenerate draft →'}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p style={{ fontSize: '13px', color: '#ef4444', margin: '0 0 12px', fontFamily: '-apple-system, sans-serif' }}>
          {error}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <button
          onClick={(e) => { e.stopPropagation(); handleApprove() }}
          disabled={approving || !draft.trim()}
          style={{
            background: approving ? '#ccc' : '#6366f1', color: '#ffffff', border: 'none',
            borderRadius: '6px', padding: '14px 24px', fontSize: '15px', fontWeight: 700,
            cursor: approving ? 'wait' : 'pointer', fontFamily: '-apple-system, sans-serif',
            opacity: !draft.trim() ? 0.5 : 1, minHeight: '48px',
          }}
        >
          {approving ? 'Sending...' : 'Approve →'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleSkip() }}
          disabled={skipping}
          style={{
            background: 'none', border: '1px solid #2a2a2a', borderRadius: '6px',
            color: '#555', fontSize: '14px', padding: '14px 20px', minHeight: '48px',
            cursor: skipping ? 'wait' : 'pointer', fontFamily: '-apple-system, sans-serif',
          }}
        >
          {skipping ? 'Skipping...' : 'Skip'}
        </button>
      </div>

      {/* Similar questions modal */}
      {showSimilarModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          }}
        >
          <div style={{
            background: '#0d1117', border: '1px solid #1e2d40', borderRadius: '12px',
            padding: '32px', maxWidth: '560px', width: '100%', fontFamily: '-apple-system, sans-serif',
          }}>
            <p style={{ fontSize: '11px', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
              Your answer applies to more players
            </p>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', margin: '0 0 6px' }}>
              Send to {similarQuestions.length} similar question{similarQuestions.length !== 1 ? 's' : ''}?
            </h3>
            <p style={{ fontSize: '13px', color: '#555', margin: '0 0 24px', lineHeight: 1.6 }}>
              These players asked essentially the same thing. Deselect any that don&apos;t fit.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {similarQuestions.map((q) => {
                const selected = selectedSimilar.has(q.id)
                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      const next = new Set(selectedSimilar)
                      selected ? next.delete(q.id) : next.add(q.id)
                      setSelectedSimilar(next)
                    }}
                    style={{
                      textAlign: 'left', background: selected ? '#0f1f35' : '#080b14',
                      border: `1px solid ${selected ? '#3b82f6' : '#1a2040'}`,
                      borderRadius: '8px', padding: '14px 16px', cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <span style={{
                        width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${selected ? '#3b82f6' : '#333'}`,
                        background: selected ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0, marginTop: '2px',
                      }}>
                        {selected && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700 }}>✓</span>}
                      </span>
                      <div>
                        <p style={{ fontSize: '14px', color: '#d1d5db', margin: '0 0 4px', lineHeight: 1.4 }}>{q.question}</p>
                        <p style={{ fontSize: '11px', color: '#374151', margin: 0 }}>
                          {q.email} · {Math.round(q.similarity * 100)}% match
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleBulkApprove}
                disabled={bulkApproving}
                style={{
                  background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px',
                  padding: '12px 24px', fontSize: '14px', fontWeight: 700, cursor: bulkApproving ? 'wait' : 'pointer',
                  opacity: bulkApproving ? 0.7 : 1,
                }}
              >
                {bulkApproving
                  ? 'Sending...'
                  : selectedSimilar.size > 0
                    ? `Send to ${selectedSimilar.size} more player${selectedSimilar.size !== 1 ? 's' : ''} →`
                    : 'Done, skip others →'}
              </button>
              <button
                onClick={() => {
                  setShowSimilarModal(false)
                  setApproved(true)
                  setTimeout(() => onApproved(item.id), 800)
                }}
                style={{ background: 'none', border: 'none', color: '#555', fontSize: '14px', cursor: 'pointer' }}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
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

interface WaitlistEntry {
  id: string
  email: string
  name: string | null
  challenge: string | null
  confirmed: boolean
  approved: boolean
  notified: boolean
  created_at: string
}

export default function AdminQuestionsPage() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [counts, setCounts] = useState<StatusCounts>({ pending: 0, answered: 0, skipped: 0 })
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null)
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null)
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([])
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const waitlistRef = useRef<HTMLDivElement>(null)

  // Run research state
  const [researching, setResearching] = useState(false)
  const [researchResult, setResearchResult] = useState<string | null>(null)

  // Notify waitlist state
  const [notifying, setNotifying] = useState(false)
  const [notifyResult, setNotifyResult] = useState<string | null>(null)

  const supabase = getSupabaseClient()

  async function loadCounts() {
    // handled by loadDashStats via /api/admin/stats
  }

  async function loadDashStats() {
    try {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) return
      const data = await res.json()
      setCounts(data.counts)
      setDashStats(data.dash)
    } catch { /* fail silently */ }
  }

  async function load(status: StatusFilter) {
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/queue?status=${status}`)
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()

      const painPoints: QueueItem[] = ((data.painPoints as PainPoint[]) || []).map((d) => ({
        kind: 'pain_point',
        data: d,
      }))

      const playerQuestions: QueueItem[] = ((data.questions as PlayerQuestion[]) || []).map((d) => ({
        kind: 'player_question',
        data: d,
      }))

    // Deduplicate player questions by question text — keep the most recent per unique (email, question) pair
    const seenPQ = new Map<string, QueueItem>()
    for (const item of playerQuestions) {
      const key = `${(item.data as PlayerQuestion).email}::${(item.data as PlayerQuestion).question.toLowerCase().trim()}`
      if (!seenPQ.has(key)) seenPQ.set(key, item)
    }
    const dedupedQuestions = Array.from(seenPQ.values())

    // Interleave: player questions first (they're real humans), then pain points
    const merged: QueueItem[] = []
    const maxLen = Math.max(painPoints.length, dedupedQuestions.length)
    for (let i = 0; i < maxLen; i++) {
      if (i < dedupedQuestions.length) merged.push(dedupedQuestions[i])
      if (i < painPoints.length) merged.push(painPoints[i])
    }

    setItems(merged)
    setLoading(false)
    } catch {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(filter)
    loadCounts()
    setFocusedId(null)
    setSearchQuery('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  // Global j/k navigation between queue cards
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when typing in a textarea/input
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key !== 'j' && e.key !== 'k') return
      if (items.length === 0) return

      const ids = items.map((it) => (it.kind === 'pain_point' ? `pp-${it.data.id}` : `pq-${it.data.id}`))
      const currentIdx = focusedId ? ids.indexOf(focusedId) : -1
      const nextIdx = e.key === 'j' ? Math.min(ids.length - 1, currentIdx + 1) : Math.max(0, currentIdx - 1)
      const nextId = ids[nextIdx === -1 ? 0 : nextIdx]
      if (nextId) {
        setFocusedId(nextId)
        // Scroll into view
        requestAnimationFrame(() => {
          document.querySelector(`[data-card-id="${nextId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, focusedId])

  // Unsaved-changes warning: if any card's textarea is dirty, warn on navigate-away
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (typeof window === 'undefined') return
      const dirty = document.querySelector('[data-dirty="true"]')
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    loadDashStats()
    fetch('/api/waitlist')
      .then(r => r.json())
      .then(d => {
        const list: WaitlistEntry[] = d.waitlist || []
        setWaitlistEntries(list)
        setWaitlistCount(list.filter(w => w.approved && w.confirmed && !w.notified).length)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleApproveEntry(id: string, approved: boolean) {
    await fetch('/api/admin/approve-waitlist-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved }),
    })
    setWaitlistEntries(prev => prev.map(w => w.id === id ? { ...w, approved } : w))
    setWaitlistCount(prev => {
      const updated = waitlistEntries.map(w => w.id === id ? { ...w, approved } : w)
      return updated.filter(w => w.approved && w.confirmed && !w.notified).length
    })
  }

  async function handleNotifyWaitlist() {
    if (!confirm(`Email all ${waitlistCount} people on the waitlist that spots are open?`)) return
    setNotifying(true)
    setNotifyResult(null)
    try {
      const res = await fetch('/api/admin/notify-waitlist', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setNotifyResult(`Error: ${data.error || 'Unknown'}`)
      } else {
        setNotifyResult(`Sent to ${data.sent} people`)
        setWaitlistCount(0)
      }
    } catch {
      setNotifyResult('Error: Network failure')
    } finally {
      setNotifying(false)
    }
  }

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
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 24px)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: '-apple-system, sans-serif', flex: 1, minWidth: '160px' }}>
          Question Queue
        </h1>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>

        {/* Notify waitlist button */}
        {waitlistCount !== null && waitlistCount > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <button
              onClick={handleNotifyWaitlist}
              disabled={notifying}
              style={{
                background: 'none',
                border: '1px solid #2a5a2a',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                color: notifying ? '#555' : '#4ade80',
                cursor: notifying ? 'wait' : 'pointer',
                fontFamily: '-apple-system, sans-serif',
              }}
            >
              {notifying ? 'Sending...' : `Notify ${waitlistCount} on waitlist`}
            </button>
            {notifyResult && (
              <span style={{ fontSize: '11px', color: notifyResult.startsWith('Error') ? '#ef4444' : '#22c55e', fontFamily: '-apple-system, sans-serif' }}>
                {notifyResult}
              </span>
            )}
          </div>
        )}

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

        </div>{/* end action buttons */}
      </div>

      {/* Knowledge-base upload bar */}
      <UploadPanel />

      {/* Dashboard stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        {[
          {
            label: 'Total Players',
            value: dashStats ? dashStats.totalPlayers : '—',
            sub: 'unique emails',
            onClick: () => setFilter('answered'),
          },
          {
            label: 'This Week',
            value: dashStats ? dashStats.questionsThisWeek : '—',
            sub: 'questions submitted',
            onClick: () => setFilter('pending'),
          },
          {
            label: 'Answer Rate',
            value: dashStats ? `${dashStats.answerRate}%` : '—',
            sub: 'questions answered',
            onClick: () => setFilter('answered'),
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
            onClick: null,
          },
          {
            label: 'Waitlist',
            value: waitlistCount === null ? '—' : waitlistCount,
            sub: 'waiting for access',
            onClick: () => {
              setShowWaitlist(true)
              setTimeout(() => waitlistRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            },
          },
        ].map((stat) => (
          <div
            key={stat.label}
            onClick={stat.onClick ?? undefined}
            style={{
              background: '#0a0a0a',
              border: '1px solid #1a1a1a',
              borderRadius: '8px',
              padding: 'clamp(12px, 3vw, 16px)',
              fontFamily: '-apple-system, sans-serif',
              cursor: stat.onClick ? 'pointer' : 'default',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={stat.onClick ? (e) => (e.currentTarget.style.borderColor = '#333') : undefined}
            onMouseLeave={stat.onClick ? (e) => (e.currentTarget.style.borderColor = '#1a1a1a') : undefined}
          >
            <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
              {stat.label}
            </p>
            <p style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 800, color: '#ffffff', margin: '0 0 4px', lineHeight: 1 }}>
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

      {/* Waitlist panel */}
      {waitlistEntries.filter(w => !w.notified).length > 0 && (
        <div ref={waitlistRef} style={{ marginBottom: '32px', border: '1px solid #1a1a1a', borderRadius: '8px', overflow: 'hidden' }}>
          <button
            onClick={() => setShowWaitlist(v => !v)}
            style={{
              width: '100%', background: '#0a0a0a', border: 'none', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', fontFamily: '-apple-system, sans-serif',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
              Waitlist ({waitlistEntries.filter(w => !w.notified).length})
            </span>
            <span style={{ fontSize: '11px', color: '#555' }}>{showWaitlist ? '▲ Hide' : '▼ Show'}</span>
          </button>

          {showWaitlist && (
            <div>
              {waitlistEntries.filter(w => !w.notified).map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: '14px 16px',
                    borderTop: '1px solid #1a1a1a',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    background: entry.approved ? '#0a1a0a' : '#0a0a0a',
                  }}
                >
                  {/* Status dot */}
                  <div style={{ paddingTop: '4px', flexShrink: 0 }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: !entry.confirmed ? '#555' : entry.approved ? '#22c55e' : '#f59e0b',
                    }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', margin: '0 0 2px', fontFamily: '-apple-system, sans-serif' }}>
                      {entry.name || '—'}
                    </p>
                    <p style={{ fontSize: '12px', color: '#555', margin: '0 0 4px', fontFamily: '-apple-system, sans-serif' }}>
                      {entry.email}
                    </p>
                    {entry.challenge && (
                      <p style={{ fontSize: '12px', color: '#777', margin: 0, fontStyle: 'italic', fontFamily: '-apple-system, sans-serif' }}>
                        &ldquo;{entry.challenge}&rdquo;
                      </p>
                    )}
                    {!entry.confirmed && (
                      <p style={{ fontSize: '11px', color: '#555', margin: '4px 0 0', fontFamily: '-apple-system, sans-serif' }}>
                        Not confirmed yet
                      </p>
                    )}
                  </div>

                  {/* Approve / unapprove */}
                  {entry.confirmed && (
                    <button
                      onClick={() => handleApproveEntry(entry.id, !entry.approved)}
                      style={{
                        flexShrink: 0,
                        background: 'none',
                        border: `1px solid ${entry.approved ? '#2a5a2a' : '#2a2a2a'}`,
                        borderRadius: '4px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        color: entry.approved ? '#22c55e' : '#777',
                        cursor: 'pointer',
                        fontFamily: '-apple-system, sans-serif',
                      }}
                    >
                      {entry.approved ? 'Approved ✓' : 'Approve'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          background: '#111',
          border: '1px solid #2a2a2a',
          borderRadius: '8px',
          padding: '14px 20px',
          fontSize: '14px',
          color: '#ffffff',
          fontFamily: '-apple-system, sans-serif',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          zIndex: 9999,
          animation: 'fadeInUp 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{ color: '#22c55e', fontSize: '16px' }}>✓</span>
          {toast}
        </div>
      )}

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
                onToast={(msg) => { setToast(msg); setTimeout(() => setToast(null), 3500) }}
              />
            )
          }
        })
      )}
    </div>
  )
}
