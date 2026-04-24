'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import LoadingDots from '@/components/ui/LoadingDots'

/**
 * Feedback + bug triage dashboard.
 *
 * One admin surface for three signals:
 *   1. Thumbs up/down on answers — "which answers land"
 *   2. Bug reports — user-submitted, one-click resolve
 *   3. Client crashes — auto-captured by ErrorCatcher, read-only
 *
 * Tabs at the top toggle the active feed; summary stats stay visible on
 * all tabs so the overall health of the product is always in frame.
 */

type Summary = {
  total_feedback: number
  thumbs_up: number
  thumbs_down: number
  up_ratio: number | null
  open_bugs: number
  total_bugs: number
  recent_crashes: number
  sentry_issues: number
  sentry_configured: boolean
  sentry_dashboard_url: string | null
}
type SentryIssue = {
  id: string
  title: string
  culprit: string | null
  permalink: string
  count: string
  user_count: number
  last_seen: string | null
  level: string | null
}
type Feedback = {
  id: string
  question_id: string
  email: string | null
  rating: 'up' | 'down'
  comment: string | null
  created_at: string
  question: string | null
}
type Bug = {
  id: string
  email: string | null
  page_url: string | null
  user_agent: string | null
  message: string
  resolved_at: string | null
  created_at: string
}
type Crash = {
  id: string
  message: string
  context: Record<string, unknown> | null
  created_at: string
}

type Tab = 'feedback' | 'bugs' | 'crashes' | 'sentry'

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

export default function FeedbackPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [bugs, setBugs] = useState<Bug[]>([])
  const [crashes, setCrashes] = useState<Crash[]>([])
  const [sentryIssues, setSentryIssues] = useState<SentryIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('feedback')
  const [hideResolved, setHideResolved] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/feedback')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setSummary(data.summary)
      setFeedback(data.feedback || [])
      setBugs(data.bugs || [])
      setCrashes(data.crashes || [])
      setSentryIssues(data.sentry_issues || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggleResolve(id: string, currentlyResolved: boolean) {
    await fetch('/api/admin/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: currentlyResolved ? 'reopen' : 'resolve' }),
    })
    load()
  }

  const visibleBugs = useMemo(
    () => (hideResolved ? bugs.filter((b) => !b.resolved_at) : bugs),
    [bugs, hideResolved]
  )

  // Thumbs-down with comment is the highest-signal feedback. Sort those to
  // the top of the feedback tab.
  const sortedFeedback = useMemo(() => {
    const priority = (f: Feedback) => {
      if (f.rating === 'down' && f.comment) return 0
      if (f.rating === 'down') return 1
      if (f.comment) return 2
      return 3
    }
    return [...feedback].sort((a, b) => priority(a) - priority(b))
  }, [feedback])

  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Feedback</h1>
        <Link href="/admin/questions" style={{ fontSize: 12, color: '#555' }}>← Queue</Link>
        <button
          onClick={load}
          style={{
            marginLeft: 'auto',
            fontSize: 12, padding: '6px 12px',
            background: 'transparent', color: '#aaa',
            border: '1px solid #333', borderRadius: 4, cursor: 'pointer',
          }}
        >
          ↻
        </button>
      </div>

      {loading && <div style={{ color: '#777', fontSize: 13 }}><LoadingDots label="Loading" /></div>}

      {summary && (
        <div style={summaryStyle}>
          <Stat label="Answers rated" value={String(summary.total_feedback)} />
          <Stat
            label="Helpful rate"
            value={summary.up_ratio === null ? '—' : `${Math.round(summary.up_ratio * 100)}%`}
            color={summary.up_ratio === null ? '#666' : summary.up_ratio > 0.7 ? '#34d399' : summary.up_ratio > 0.4 ? '#f59e0b' : '#ef4444'}
          />
          <Stat label="👍" value={String(summary.thumbs_up)} color="#34d399" />
          <Stat label="👎" value={String(summary.thumbs_down)} color="#ef4444" />
          <Stat label="Open bugs" value={String(summary.open_bugs)} color={summary.open_bugs > 0 ? '#f59e0b' : '#34d399'} />
          <Stat label="Recent crashes" value={String(summary.recent_crashes)} color={summary.recent_crashes > 0 ? '#ef4444' : '#666'} />
          <Stat
            label="Sentry issues"
            value={summary.sentry_configured ? String(summary.sentry_issues) : '—'}
            color={summary.sentry_issues > 0 ? '#ef4444' : '#666'}
          />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #1a1a1a', marginBottom: 16 }}>
        <TabBtn active={tab === 'feedback'} onClick={() => setTab('feedback')}>
          Answer feedback {feedback.length > 0 && <Counter n={feedback.length} />}
        </TabBtn>
        <TabBtn active={tab === 'bugs'} onClick={() => setTab('bugs')}>
          Bug reports {summary && summary.open_bugs > 0 && <Counter n={summary.open_bugs} attn />}
        </TabBtn>
        <TabBtn active={tab === 'crashes'} onClick={() => setTab('crashes')}>
          Client crashes {crashes.length > 0 && <Counter n={crashes.length} attn />}
        </TabBtn>
        <TabBtn active={tab === 'sentry'} onClick={() => setTab('sentry')}>
          Sentry {sentryIssues.length > 0 && <Counter n={sentryIssues.length} attn />}
        </TabBtn>
      </div>

      {tab === 'feedback' && (
        <>
          {sortedFeedback.length === 0 ? (
            <Empty>No thumbs yet. They&apos;ll start flowing once students read approved answers.</Empty>
          ) : (
            <ul style={listStyle}>
              {sortedFeedback.map((f) => (
                <li key={f.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{f.rating === 'up' ? '👍' : '👎'}</span>
                    <span style={{ fontSize: 11, color: '#888' }}>{f.email || 'anon'}</span>
                    <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>{timeAgo(f.created_at)} ago</span>
                  </div>
                  {f.question && (
                    <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 6px 0', fontStyle: 'italic' }}>
                      &ldquo;{f.question}&rdquo;
                    </p>
                  )}
                  {f.comment && (
                    <p style={{
                      fontSize: 13, color: '#ddd', margin: 0, padding: '8px 10px',
                      background: f.rating === 'down' ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)',
                      borderLeft: `2px solid ${f.rating === 'down' ? '#ef4444' : '#34d399'}`,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {f.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'bugs' && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888', marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={hideResolved} onChange={(e) => setHideResolved(e.target.checked)} />
            Hide resolved
          </label>
          {visibleBugs.length === 0 ? (
            <Empty>No open bug reports. 🎉</Empty>
          ) : (
            <ul style={listStyle}>
              {visibleBugs.map((b) => (
                <li key={b.id} style={{ ...cardStyle, opacity: b.resolved_at ? 0.5 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 14 }}>🐛</span>
                    <span style={{ fontSize: 11, color: '#888' }}>{b.email || 'anon'}</span>
                    <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>{timeAgo(b.created_at)} ago</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#eee', margin: '0 0 8px 0', whiteSpace: 'pre-wrap' }}>
                    {b.message}
                  </p>
                  {b.page_url && (
                    <p style={{ fontSize: 11, color: '#666', margin: '0 0 4px 0' }}>
                      Page: <span style={{ color: '#888', fontFamily: 'ui-monospace, Menlo, monospace' }}>{b.page_url}</span>
                    </p>
                  )}
                  {b.user_agent && (
                    <p style={{ fontSize: 11, color: '#666', margin: '0 0 8px 0' }}>
                      UA: <span style={{ color: '#888', fontFamily: 'ui-monospace, Menlo, monospace' }}>{b.user_agent}</span>
                    </p>
                  )}
                  <button
                    onClick={() => toggleResolve(b.id, !!b.resolved_at)}
                    style={{
                      fontSize: 11, padding: '4px 10px',
                      background: b.resolved_at ? 'transparent' : '#1a1a1a',
                      color: b.resolved_at ? '#aaa' : '#fff',
                      border: `1px solid ${b.resolved_at ? '#333' : '#444'}`,
                      borderRadius: 4, cursor: 'pointer',
                    }}
                  >
                    {b.resolved_at ? 'Reopen' : 'Mark resolved'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'sentry' && (
        <>
          {summary && !summary.sentry_configured ? (
            <Empty>
              Sentry API integration not configured. Add these env vars to pull
              unresolved issues inline:
              <br />
              <code style={{ display: 'inline-block', marginTop: 8, fontSize: 11, color: '#aaa' }}>
                SENTRY_AUTH_TOKEN · SENTRY_ORG_SLUG · SENTRY_PROJECT_SLUG
              </code>
              <br />
              <br />
              <a
                href={summary.sentry_dashboard_url || 'https://askelijah.sentry.io/issues/'}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#7dd3fc', fontSize: 13 }}
              >
                Open Sentry dashboard ↗
              </a>
            </Empty>
          ) : sentryIssues.length === 0 ? (
            <Empty>
              No unresolved Sentry issues. 🎉
              <br />
              <br />
              <a
                href={summary?.sentry_dashboard_url || 'https://askelijah.sentry.io/issues/'}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#7dd3fc', fontSize: 13 }}
              >
                Open Sentry dashboard ↗
              </a>
            </Empty>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <a
                  href={summary?.sentry_dashboard_url || 'https://askelijah.sentry.io/issues/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11, color: '#7dd3fc', textDecoration: 'none' }}
                >
                  Open all in Sentry ↗
                </a>
              </div>
              <ul style={listStyle}>
                {sentryIssues.map((i) => {
                  const levelColor =
                    i.level === 'error' || i.level === 'fatal' ? '#ef4444' :
                    i.level === 'warning' ? '#f59e0b' :
                    '#888'
                  return (
                    <li key={i.id} style={cardStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          color: '#000', background: levelColor,
                          padding: '2px 6px', borderRadius: 3,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {i.level || 'info'}
                        </span>
                        <span style={{ fontSize: 11, color: '#888' }}>
                          {i.count} event{i.count === '1' ? '' : 's'} · {i.user_count} user{i.user_count === 1 ? '' : 's'}
                        </span>
                        {i.last_seen && (
                          <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>
                            {timeAgo(i.last_seen)} ago
                          </span>
                        )}
                      </div>
                      <p style={{
                        fontSize: 13, color: '#eee', margin: '0 0 4px 0',
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {i.title}
                      </p>
                      {i.culprit && (
                        <p style={{ fontSize: 11, color: '#888', margin: '0 0 8px 0', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                          {i.culprit}
                        </p>
                      )}
                      <a
                        href={i.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: '#7dd3fc', textDecoration: 'none' }}
                      >
                        View in Sentry ↗
                      </a>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}

      {tab === 'crashes' && (
        <>
          {crashes.length === 0 ? (
            <Empty>No client crashes recorded. Good.</Empty>
          ) : (
            <ul style={listStyle}>
              {crashes.map((c) => {
                const ctx = (c.context || {}) as Record<string, unknown>
                const url = typeof ctx.url === 'string' ? ctx.url : null
                const extra = typeof ctx.extra === 'string' ? ctx.extra : null
                return (
                  <li key={c.id} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14 }}>💥</span>
                      <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>{timeAgo(c.created_at)} ago</span>
                    </div>
                    <p style={{
                      fontSize: 13, color: '#eee', margin: '0 0 6px 0',
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {c.message}
                    </p>
                    {url && (
                      <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px 0' }}>{url}</p>
                    )}
                    {extra && (
                      <details style={{ fontSize: 11, color: '#666' }}>
                        <summary style={{ cursor: 'pointer' }}>Stack</summary>
                        <pre style={{ marginTop: 6, padding: 8, background: '#050505', borderRadius: 4, overflow: 'auto', fontSize: 10, color: '#999' }}>
                          {extra}
                        </pre>
                      </details>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: color || '#eee' }}>{value}</span>
    </div>
  )
}

function TabBtn({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12,
        padding: '8px 14px',
        background: 'transparent',
        color: active ? '#fff' : '#888',
        border: 'none',
        borderBottom: active ? '2px solid #fff' : '2px solid transparent',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
    </button>
  )
}

function Counter({ n, attn = false }: { n: number; attn?: boolean }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      background: attn ? '#ef4444' : '#333',
      color: '#fff',
      borderRadius: 999,
      padding: '1px 6px',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {n}
    </span>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '32px 20px', textAlign: 'center', color: '#666', fontSize: 13, border: '1px dashed #1a1a1a', borderRadius: 6 }}>
      {children}
    </div>
  )
}

const summaryStyle: React.CSSProperties = {
  display: 'flex',
  gap: 28,
  flexWrap: 'wrap',
  padding: '14px 16px',
  background: '#0a0a0a',
  border: '1px solid #1a1a1a',
  borderRadius: 6,
  marginBottom: 18,
}
const cardStyle: React.CSSProperties = {
  padding: 14,
  background: '#0a0a0a',
  border: '1px solid #1a1a1a',
  borderRadius: 6,
}
const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}
