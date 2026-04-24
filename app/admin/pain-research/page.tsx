'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import LoadingDots from '@/components/ui/LoadingDots'

/**
 * Pain-research admin dashboard.
 *
 * Shows the latest synthesis run: clustered pain points with real quotes
 * from YouTube/Reddit, and the most-asked questions that surfaced. Plus
 * a trigger button for manual runs and a small history list so the admin
 * can see how pain patterns shift over time.
 */

type Synthesis = {
  pain_points: Array<{
    title: string
    summary: string
    score: number
    quotes: Array<{ text: string; source_url: string | null }>
  }>
  top_questions: Array<{ question: string; score: number }>
  demographic: string
  source_breakdown: { youtube: number; reddit: number; autocomplete: number }
}

type Run = {
  id: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'completed' | 'failed'
  raw_count: number | null
  pain_count: number | null
  question_count: number | null
  error?: string | null
  synthesis?: Synthesis | null
}

type HistoryItem = Omit<Run, 'synthesis'>

export default function PainResearchPage() {
  const [latest, setLatest] = useState<Run | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pain-research')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setLatest(data.latest)
      setHistory(data.history || [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Poll while a run is in progress so the dashboard updates without a
  // manual refresh.
  useEffect(() => {
    if (latest?.status !== 'running') return
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [latest?.status, load])

  const runNow = async () => {
    if (starting) return
    setStarting(true)
    setToast('Starting a fresh research run — this usually takes 1–3 minutes...')
    try {
      const res = await fetch('/api/admin/pain-research', { method: 'POST' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `${res.status}`)
      }
      setTimeout(load, 2000)
    } catch (e) {
      setToast(`Failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setStarting(false)
      setTimeout(() => setToast(null), 6000)
    }
  }

  const synthesis = latest?.synthesis || null

  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Pain Research</h1>
        <Link href="/admin/questions" style={{ fontSize: 12, color: '#555' }}>
          ← Queue
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button
            onClick={runNow}
            disabled={starting || latest?.status === 'running'}
            style={{
              fontSize: 12,
              padding: '6px 14px',
              background: '#fff',
              color: '#000',
              border: '1px solid #fff',
              borderRadius: 4,
              cursor: starting ? 'wait' : 'pointer',
              fontWeight: 600,
              opacity: starting || latest?.status === 'running' ? 0.5 : 1,
            }}
          >
            {latest?.status === 'running' ? <LoadingDots label="Running" /> : 'Run now'}
          </button>
          <button
            onClick={load}
            style={{
              fontSize: 12,
              padding: '6px 12px',
              background: 'transparent',
              color: '#aaa',
              border: '1px solid #333',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            ↻
          </button>
        </div>
      </div>

      {toast && (
        <div style={toastStyle}>{toast}</div>
      )}

      {loading && <div style={{ color: '#777', fontSize: 13 }}><LoadingDots label="Loading" /></div>}
      {error && <div style={{ color: '#ff6666', fontSize: 13 }}>Error: {error}</div>}

      {!loading && !latest && (
        <div style={emptyStyle}>
          No research runs yet. Hit <strong>Run now</strong> to kick off the first scrape across YouTube, Reddit, and Google autocomplete.
        </div>
      )}

      {latest && (
        <>
          {/* Run summary */}
          <div style={summaryStyle}>
            <Pair
              label="Last run"
              value={
                latest.finished_at
                  ? new Date(latest.finished_at).toLocaleString()
                  : new Date(latest.started_at).toLocaleString() + ' (running)'
              }
            />
            <Pair label="Status" value={latest.status} valueColor={
              latest.status === 'completed' ? '#34d399' :
              latest.status === 'running' ? '#f59e0b' : '#ef4444'
            } />
            <Pair label="Raw items collected" value={String(latest.raw_count ?? 0)} />
            <Pair label="Pain points" value={String(latest.pain_count ?? 0)} />
            <Pair label="Top questions" value={String(latest.question_count ?? 0)} />
            {synthesis?.source_breakdown && (
              <Pair
                label="By source"
                value={`YT ${synthesis.source_breakdown.youtube} · RD ${synthesis.source_breakdown.reddit} · AC ${synthesis.source_breakdown.autocomplete}`}
              />
            )}
          </div>

          {latest.error && (
            <div style={{ ...emptyStyle, borderColor: '#3a1515', color: '#ef4444' }}>
              Run failed: {latest.error}
            </div>
          )}

          {/* Pain points */}
          {synthesis && synthesis.pain_points.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={sectionTitleStyle}>Pain points · sorted by signal</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {synthesis.pain_points.map((p, i) => (
                  <div key={i} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={scoreBadgeStyle(p.score)}>{p.score}</span>
                      <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{p.title}</h3>
                    </div>
                    <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                      {p.summary}
                    </p>
                    {p.quotes.length > 0 && (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {p.quotes.slice(0, 4).map((q, j) => (
                          <li key={j} style={{ fontSize: 12, color: '#999', lineHeight: 1.5, paddingLeft: 12, borderLeft: '2px solid #222' }}>
                            &ldquo;{q.text}&rdquo;
                            {q.source_url && (
                              <>
                                {' '}
                                <a
                                  href={q.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#7dd3fc', textDecoration: 'none', fontSize: 11 }}
                                >
                                  source ↗
                                </a>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Top questions */}
          {synthesis && synthesis.top_questions.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={sectionTitleStyle}>Questions being asked · sorted by frequency</h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {synthesis.top_questions.map((q, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 0', borderBottom: '1px solid #111' }}>
                    <span style={{ fontSize: 10, color: '#666', width: 28, fontVariantNumeric: 'tabular-nums' }}>{q.score}</span>
                    <span style={{ fontSize: 13, color: '#ddd' }}>{q.question}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* History */}
      {history.length > 1 && (
        <section>
          <h2 style={sectionTitleStyle}>Previous runs</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {history.slice(1).map((r) => (
              <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 12, color: '#888', borderBottom: '1px solid #111' }}>
                <span style={{ width: 140 }}>{new Date(r.started_at).toLocaleString()}</span>
                <span style={{ color: r.status === 'completed' ? '#34d399' : r.status === 'failed' ? '#ef4444' : '#f59e0b', width: 80 }}>{r.status}</span>
                <span>raw {r.raw_count ?? '—'} · pain {r.pain_count ?? '—'} · q {r.question_count ?? '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Pair({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ fontSize: 13, color: valueColor || '#eee' }}>{value}</span>
    </div>
  )
}

const summaryStyle: React.CSSProperties = {
  display: 'flex',
  gap: 24,
  flexWrap: 'wrap',
  padding: '14px 16px',
  background: '#0a0a0a',
  border: '1px solid #1a1a1a',
  borderRadius: 6,
  marginBottom: 24,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#555',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: '0 0 12px 0',
  fontWeight: 500,
}

const cardStyle: React.CSSProperties = {
  padding: 14,
  background: '#0a0a0a',
  border: '1px solid #1a1a1a',
  borderRadius: 6,
}

const emptyStyle: React.CSSProperties = {
  padding: '16px 18px',
  background: '#0a0a0a',
  border: '1px solid #1a1a1a',
  borderRadius: 6,
  fontSize: 13,
  color: '#888',
  marginBottom: 20,
}

const toastStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#ccc',
  background: '#1a1a1a',
  padding: '10px 14px',
  borderRadius: 4,
  marginBottom: 16,
}

function scoreBadgeStyle(score: number): React.CSSProperties {
  const hue = score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#888'
  return {
    fontSize: 10,
    fontWeight: 700,
    color: '#000',
    background: hue,
    borderRadius: 4,
    padding: '2px 6px',
    fontVariantNumeric: 'tabular-nums',
  }
}
