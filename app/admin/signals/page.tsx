'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Signals = {
  windows: { last7: number; prev7: number; last30: number }
  trendingTopics: { key: string; count: number; prev: number; delta: number }[]
  mode7: { key: string; count: number }[]
  level7: { key: string; count: number }[]
  askerType7: { key: string; count: number }[]
  gaps: {
    count: number
    sample: { id: string; question: string; topic: string | null; topic_confidence: number | null; mode: string | null }[]
  }
  editQuality: { key: string; avgEdits: number; n: number }[]
  corrections: { count: number }
}

function Card({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ border: '1px solid #1a2040', borderRadius: '8px', background: '#080b14', padding: '20px' }}>
      <p style={{ fontSize: '11px', color: '#4a5180', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px', fontFamily: '-apple-system, sans-serif' }}>{title}</p>
      {hint && <p style={{ fontSize: '11px', color: '#3a4570', margin: '0 0 12px', fontFamily: '-apple-system, sans-serif' }}>{hint}</p>}
      {children}
    </div>
  )
}

function Bar({ label, count, max, extra }: { label: string; count: number; max: number; extra?: React.ReactNode }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div style={{ marginBottom: '10px', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '12px' }}>
        <span style={{ color: '#ccc' }}>{label}</span>
        <span style={{ color: '#888' }}>
          {count}
          {extra}
        </span>
      </div>
      <div style={{ height: '3px', background: '#111', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#3b82f6' }} />
      </div>
    </div>
  )
}

export default function SignalsPage() {
  const [data, setData] = useState<Signals | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/signals')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ color: '#666', padding: '40px', fontFamily: '-apple-system, sans-serif' }}>Loading signals…</div>
  }
  if (err || !data) {
    return <div style={{ color: '#ef4444', padding: '40px', fontFamily: '-apple-system, sans-serif' }}>Failed to load signals {err ? `(${err})` : ''}</div>
  }

  const wow = data.windows.last7 - data.windows.prev7
  const wowPct = data.windows.prev7 > 0 ? Math.round((wow / data.windows.prev7) * 100) : null
  const topicMax = Math.max(1, ...data.trendingTopics.map((t) => t.count))
  const modeMax = Math.max(1, ...data.mode7.map((m) => m.count))
  const levelMax = Math.max(1, ...data.level7.map((l) => l.count))

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 24px)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: '-apple-system, sans-serif' }}>
            Signals
          </h1>
          <p style={{ color: '#666', fontSize: '13px', margin: '4px 0 0', fontFamily: '-apple-system, sans-serif' }}>
            What players are really asking. Rolling 7 and 30 day windows.
          </p>
        </div>
        <Link
          href="/admin/questions"
          style={{ fontSize: '12px', color: '#888', textDecoration: 'none', fontFamily: '-apple-system, sans-serif' }}
        >
          ← Queue
        </Link>
      </div>

      {/* Windows summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        <Card title="Questions this week">
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#fff', margin: 0, fontFamily: '-apple-system, sans-serif' }}>{data.windows.last7}</p>
          {wowPct !== null && (
            <p style={{ fontSize: '12px', color: wow >= 0 ? '#4ade80' : '#ef4444', margin: '4px 0 0', fontFamily: '-apple-system, sans-serif' }}>
              {wow >= 0 ? '+' : ''}{wow} vs last week ({wowPct >= 0 ? '+' : ''}{wowPct}%)
            </p>
          )}
        </Card>
        <Card title="Last 30 days">
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#fff', margin: 0, fontFamily: '-apple-system, sans-serif' }}>{data.windows.last30}</p>
        </Card>
        <Card title="Content gaps this week" hint="No RAG match or low confidence">
          <p style={{ fontSize: '28px', fontWeight: 800, color: data.gaps.count > 10 ? '#f59e0b' : '#fff', margin: 0, fontFamily: '-apple-system, sans-serif' }}>{data.gaps.count}</p>
        </Card>
        <Card title="Corrections (30d)" hint="Approved with VERIFY flags">
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#fff', margin: 0, fontFamily: '-apple-system, sans-serif' }}>{data.corrections.count}</p>
        </Card>
      </div>

      {/* Main two-col: trending topics + mode/level */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card title="Trending topics (7d)" hint="Arrow = change vs previous 7d">
          {data.trendingTopics.length === 0 ? (
            <p style={{ color: '#666', fontSize: '12px', fontFamily: '-apple-system, sans-serif' }}>No topics tagged yet.</p>
          ) : (
            data.trendingTopics.slice(0, 8).map((t) => (
              <Bar
                key={t.key}
                label={t.key}
                count={t.count}
                max={topicMax}
                extra={
                  t.delta !== 0 ? (
                    <span style={{ marginLeft: '8px', color: t.delta > 0 ? '#4ade80' : '#ef4444', fontSize: '11px' }}>
                      {t.delta > 0 ? '↑' : '↓'}{Math.abs(t.delta)}
                    </span>
                  ) : null
                }
              />
            ))
          )}
        </Card>

        <Card title="Entry modes (7d)" hint="How players came in">
          {data.mode7.length === 0 ? (
            <p style={{ color: '#666', fontSize: '12px', fontFamily: '-apple-system, sans-serif' }}>No mode data yet.</p>
          ) : (
            data.mode7.map((m) => <Bar key={m.key} label={m.key} count={m.count} max={modeMax} />)
          )}
        </Card>

        <Card title="Levels (7d)" hint="From profile.level_snapshot">
          {data.level7.length === 0 || (data.level7.length === 1 && data.level7[0].key === '—') ? (
            <p style={{ color: '#666', fontSize: '12px', fontFamily: '-apple-system, sans-serif' }}>No level data yet. Collect level on signup.</p>
          ) : (
            data.level7.map((l) => <Bar key={l.key} label={l.key} count={l.count} max={levelMax} />)
          )}
        </Card>

        <Card title="Edit quality by topic (30d)" hint="Lower avg edits = AI captures voice better">
          {data.editQuality.length === 0 ? (
            <p style={{ color: '#666', fontSize: '12px', fontFamily: '-apple-system, sans-serif' }}>Need at least 2 approved answers per topic.</p>
          ) : (
            data.editQuality.slice(0, 8).map((q) => (
              <div key={q.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px', color: '#ccc', borderBottom: '1px solid #111', fontFamily: '-apple-system, sans-serif' }}>
                <span>{q.key}</span>
                <span style={{ color: q.avgEdits >= 1 ? '#f59e0b' : '#4ade80' }}>
                  {q.avgEdits.toFixed(2)} avg · {q.n} answers
                </span>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Gaps detail */}
      <Card title={`Recent content gaps (${data.gaps.count} this week)`} hint="Questions where retrieval failed — record content about these">
        {data.gaps.sample.length === 0 ? (
          <p style={{ color: '#666', fontSize: '12px', fontFamily: '-apple-system, sans-serif' }}>No gaps this week. Nice.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            {data.gaps.sample.map((g) => (
              <div key={g.id} style={{ borderLeft: '2px solid #f59e0b', paddingLeft: '12px', fontFamily: '-apple-system, sans-serif' }}>
                <p style={{ fontSize: '13px', color: '#fff', margin: '0 0 3px', lineHeight: 1.5 }}>{g.question}</p>
                <p style={{ fontSize: '11px', color: '#666', margin: 0 }}>
                  {g.mode ? `mode: ${g.mode} · ` : ''}
                  {g.topic ? `topic: ${g.topic} (${g.topic_confidence?.toFixed(2) ?? '?'})` : 'no topic'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Asker type */}
      {data.askerType7.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <Card title="Asker types (7d)">
            {data.askerType7.map((a) => <Bar key={a.key} label={a.key} count={a.count} max={Math.max(...data.askerType7.map(x => x.count))} />)}
          </Card>
        </div>
      )}

    </div>
  )
}
