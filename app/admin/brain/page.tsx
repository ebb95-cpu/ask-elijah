'use client'

import { useEffect, useState } from 'react'
import LoadingDots from '@/components/ui/LoadingDots'

type AlertSetting = {
  key: string
  enabled: boolean
  threshold: number | null
  description: string | null
}

type BrainData = {
  readiness: {
    score: number
    label: string
    parts: Record<string, number>
  }
  gaps: Array<{ type: string; title: string; detail: string }>
  weak_topics: Array<{ topic: string; questions: number; approved: number; gold: number; sources: number }>
  interview_prompts: Array<{ topic: string; prompt: string; why: string }>
  alerts: AlertSetting[]
  personalization: Array<{ email: string; memories: Array<{ type: string; text: string; created_at: string }> }>
  recent_preferences: Array<{ id: string; preference: string; category: string; confidence: number | null }>
}

const labelFor: Record<string, string> = {
  repeat_question: 'Repeated question',
  bad_feedback: 'Bad feedback',
  weak_topic: 'Weak topic',
  watchdog_failure: 'Technical failure',
}

export default function BrainPage() {
  const [data, setData] = useState<BrainData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/brain')
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  async function saveAlerts(next = data?.alerts || []) {
    setSaving(true)
    setToast(null)
    try {
      const res = await fetch('/api/admin/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: next }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      setToast('Alert settings saved')
      setTimeout(() => setToast(null), 2500)
    } catch {
      setToast('Could not save alert settings')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const updateAlert = (key: string, patch: Partial<AlertSetting>) => {
    if (!data) return
    const alerts = data.alerts.map((a) => a.key === key ? { ...a, ...patch } : a)
    setData({ ...data, alerts })
  }

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(24px, 5vw, 48px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <p style={eyebrow}>Second brain</p>
          <h1 style={{ margin: 0, fontSize: 'clamp(42px, 8vw, 82px)', letterSpacing: '-0.07em', lineHeight: 0.92 }}>
            Elijah Brain.
          </h1>
          <p style={{ color: '#777', fontSize: 16, lineHeight: 1.6, maxWidth: 650, marginTop: 18 }}>
            Readiness, gaps, interview prompts, alerts, and player memory in one backend control room.
          </p>
        </div>
        <button onClick={load} style={ghostButton}>Refresh</button>
      </div>

      {loading ? (
        <div style={{ color: '#777', padding: '44px 0' }}><LoadingDots label="Reading brain" /></div>
      ) : data ? (
        <>
          {toast && <div style={toastStyle}>{toast}</div>}

          <section style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 0.9fr) minmax(280px, 2fr)',
            gap: 14,
            marginBottom: 14,
          }}>
            <div style={scoreCard}>
              <p style={eyebrow}>Readiness score</p>
              <p style={{ fontSize: 72, lineHeight: 0.9, margin: '14px 0 6px', fontWeight: 900, letterSpacing: '-0.06em' }}>
                {data.readiness.score}
              </p>
              <p style={{ color: '#fbbf24', margin: 0, fontWeight: 900 }}>{data.readiness.label}</p>
            </div>
            <div style={gridCard}>
              {Object.entries(data.readiness.parts).map(([key, value]) => (
                <Stat key={key} label={key.replace(/_/g, ' ')} value={value} />
              ))}
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
            <Panel title="Interview mode" note="Questions to ask yourself so the brain gets smarter.">
              {data.interview_prompts.length === 0 ? <Empty>No interview prompts right now.</Empty> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.interview_prompts.map((item, index) => (
                    <article key={`${item.topic}-${index}`} style={innerCard}>
                      <p style={{ color: '#fbbf24', fontSize: 11, fontWeight: 900, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.topic}</p>
                      <p style={{ color: '#eee', fontSize: 15, lineHeight: 1.45, margin: '0 0 8px', fontWeight: 800 }}>{item.prompt}</p>
                      <p style={{ color: '#666', fontSize: 12, lineHeight: 1.45, margin: 0 }}>{item.why}</p>
                    </article>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Knowledge gaps" note="Places where the brain is thin or demand is repeating.">
              {data.gaps.length === 0 ? <Empty>No obvious gaps.</Empty> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.gaps.map((gap, index) => (
                    <article key={`${gap.title}-${index}`} style={innerCard}>
                      <p style={{ color: '#888', fontSize: 10, fontWeight: 900, margin: '0 0 7px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{gap.type.replace(/_/g, ' ')}</p>
                      <p style={{ color: '#eee', fontSize: 14, lineHeight: 1.4, margin: '0 0 7px', fontWeight: 800 }}>{gap.title}</p>
                      <p style={{ color: '#666', fontSize: 12, lineHeight: 1.45, margin: 0 }}>{gap.detail}</p>
                    </article>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Weak topics" note="Topics with demand but not enough gold/source coverage.">
              {data.weak_topics.length === 0 ? <Empty>Topic coverage looks balanced.</Empty> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.weak_topics.map((topic) => (
                    <div key={topic.topic} style={rowCard}>
                      <div>
                        <p style={{ color: '#fff', fontWeight: 850, margin: '0 0 4px' }}>{topic.topic}</p>
                        <p style={{ color: '#666', fontSize: 12, margin: 0 }}>{topic.questions} questions · {topic.approved} approved · {topic.gold} gold · {topic.sources} sources</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Alerts" note="Choose what should interrupt you.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.alerts.map((alert) => (
                  <div key={alert.key} style={innerCard}>
                    <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#fff', fontWeight: 850, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={alert.enabled}
                        onChange={(e) => updateAlert(alert.key, { enabled: e.target.checked })}
                      />
                      {labelFor[alert.key] || alert.key}
                    </label>
                    <p style={{ color: '#666', fontSize: 12, lineHeight: 1.45, margin: '7px 0' }}>{alert.description}</p>
                    <label style={{ color: '#777', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      Threshold
                      <input
                        type="number"
                        value={alert.threshold ?? ''}
                        onChange={(e) => updateAlert(alert.key, { threshold: e.target.value ? Number(e.target.value) : null })}
                        style={numberInput}
                      />
                    </label>
                  </div>
                ))}
                <button onClick={() => saveAlerts()} disabled={saving} style={primaryButton}>
                  {saving ? <LoadingDots label="Saving" /> : 'Save alerts'}
                </button>
              </div>
            </Panel>

            <Panel title="Player memory" note="What the app is learning about individual players.">
              {data.personalization.length === 0 ? <Empty>No player memories yet.</Empty> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.personalization.map((player) => (
                    <details key={player.email} style={innerCard}>
                      <summary style={{ color: '#fff', cursor: 'pointer', fontWeight: 850 }}>{player.email}</summary>
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {player.memories.map((memory, i) => (
                          <p key={`${memory.text}-${i}`} style={{ color: '#aaa', fontSize: 12, lineHeight: 1.45, margin: 0 }}>
                            <span style={{ color: '#fbbf24', textTransform: 'uppercase', fontSize: 10, fontWeight: 900 }}>{memory.type}</span>
                            {' '} {memory.text}
                          </p>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Elijah preferences" note="Reusable coaching/style rules learned from your edits.">
              {data.recent_preferences.length === 0 ? <Empty>No learned preferences yet.</Empty> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.recent_preferences.map((pref) => (
                    <div key={pref.id} style={rowCard}>
                      <p style={{ color: '#ddd', fontSize: 13, lineHeight: 1.45, margin: 0 }}>{pref.preference}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      ) : (
        <p style={{ color: '#ef4444' }}>Could not load Elijah Brain.</p>
      )}
    </main>
  )
}

function Panel({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section style={panelStyle}>
      <p style={eyebrow}>{title}</p>
      <p style={{ color: '#666', fontSize: 13, lineHeight: 1.45, margin: '0 0 16px' }}>{note}</p>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid #1f1f1f', borderRadius: 12, padding: 14, background: '#050505' }}>
      <p style={{ color: '#fff', fontSize: 24, lineHeight: 1, margin: '0 0 8px', fontWeight: 900 }}>{value}</p>
      <p style={{ color: '#666', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{label}</p>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ color: '#666', fontSize: 13, lineHeight: 1.45, margin: 0 }}>{children}</p>
}

const eyebrow: React.CSSProperties = {
  margin: '0 0 10px',
  color: '#6b7280',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
}

const panelStyle: React.CSSProperties = {
  border: '1px solid #181818',
  borderRadius: 18,
  padding: 18,
  background: '#050505',
}

const scoreCard: React.CSSProperties = {
  border: '1px solid #3b2f12',
  borderRadius: 18,
  padding: 22,
  background: 'radial-gradient(circle at 20% 0%, rgba(251,191,36,0.14), transparent 34%), #050505',
}

const gridCard: React.CSSProperties = {
  border: '1px solid #181818',
  borderRadius: 18,
  padding: 14,
  background: '#050505',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: 10,
}

const innerCard: React.CSSProperties = {
  border: '1px solid #202020',
  borderRadius: 12,
  padding: 12,
  background: '#090909',
}

const rowCard: React.CSSProperties = {
  border: '1px solid #202020',
  borderRadius: 12,
  padding: 12,
  background: '#090909',
}

const ghostButton: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #262626',
  borderRadius: 999,
  color: '#aaa',
  cursor: 'pointer',
  fontWeight: 800,
  padding: '10px 14px',
}

const primaryButton: React.CSSProperties = {
  background: '#fff',
  border: 0,
  borderRadius: 999,
  color: '#000',
  cursor: 'pointer',
  fontWeight: 900,
  padding: '11px 14px',
}

const numberInput: React.CSSProperties = {
  width: 64,
  background: '#050505',
  border: '1px solid #262626',
  borderRadius: 8,
  color: '#fff',
  padding: '6px 8px',
}

const toastStyle: React.CSSProperties = {
  background: '#0a1f15',
  border: '1px solid #1f4030',
  borderRadius: 12,
  color: '#34d399',
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 14,
  padding: 12,
}
