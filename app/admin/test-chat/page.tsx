'use client'

import { useMemo, useState } from 'react'
import LoadingDots from '@/components/ui/LoadingDots'

type Message = {
  role: 'student' | 'elijah'
  text: string
}

type Source = {
  title: string
  url: string
  type: string
}

const SAMPLE_QUESTIONS = [
  "How do I stop overthinking after I miss my first two shots?",
  "My coach does not trust me yet. What can I do this week?",
  "I get nervous in the fourth quarter. How do I stay calm?",
]

const LEVELS = [
  { value: 'middle_school', label: 'Middle school' },
  { value: 'jv', label: 'JV' },
  { value: 'varsity', label: 'Varsity' },
  { value: 'aau', label: 'AAU' },
  { value: 'college', label: 'College' },
]

export default function AdminTestChatPage() {
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS[0])
  const [age, setAge] = useState('15')
  const [level, setLevel] = useState('varsity')
  const [position, setPosition] = useState('Guard')
  const [challenge, setChallenge] = useState('Confidence after mistakes')
  const [messages, setMessages] = useState<Message[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSend = useMemo(() => question.trim().length > 0 && !loading, [question, loading])

  const send = async () => {
    const q = question.trim()
    if (!q || loading) return
    setLoading(true)
    setError('')
    setSources([])
    setMessages((prev) => [...prev, { role: 'student', text: q }])

    try {
      const res = await fetch('/api/admin/test-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          profile: { age, level, position, challenge },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `${res.status}`)
      setMessages((prev) => [...prev, { role: 'elijah', text: data.answer || '' }])
      setSources(Array.isArray(data.sources) ? data.sources : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not test that question')
      setMessages((prev) => prev.filter((m, index) => index !== prev.length - 1))
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setMessages([])
    setSources([])
    setError('')
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 50px)', padding: 'clamp(18px, 4vw, 36px)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
          <div>
            <p style={eyebrow}>V1 Control Room</p>
            <h1 style={{ color: '#fff', fontSize: 'clamp(28px, 5vw, 48px)', letterSpacing: 0, lineHeight: 1.02, margin: 0 }}>
              Test Chat
            </h1>
          </div>
          <a href="/admin/questions" style={quietLink}>Queue</a>
        </header>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
          <main style={{ flex: '1 1 620px', minWidth: 0 }}>
            <div style={chatSurface}>
              <div style={threadStyle}>
                {messages.length === 0 ? (
                  <div style={{ minHeight: 280, display: 'grid', placeItems: 'center', color: '#555', textAlign: 'center', padding: 24 }}>
                    <div>
                      <p style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>No test yet.</p>
                      <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>Start with one real question.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      style={{
                        alignSelf: message.role === 'student' ? 'flex-end' : 'flex-start',
                        background: message.role === 'student' ? '#ffffff' : '#101010',
                        border: message.role === 'student' ? '1px solid #ffffff' : '1px solid #242424',
                        borderRadius: message.role === 'student' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        color: message.role === 'student' ? '#000' : '#f5f5f5',
                        fontSize: 15,
                        lineHeight: 1.58,
                        maxWidth: message.role === 'student' ? 520 : 700,
                        padding: '14px 16px',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {message.text}
                    </div>
                  ))
                )}
                {loading && (
                  <div style={{ alignSelf: 'flex-start', background: '#101010', border: '1px solid #242424', borderRadius: '18px 18px 18px 4px', color: '#fff', padding: '14px 16px' }}>
                    <LoadingDots label="Thinking" />
                  </div>
                )}
              </div>

              <div style={composerStyle}>
                <textarea
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value)
                    if (error) setError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  maxLength={500}
                  rows={3}
                  placeholder="Ask a test question..."
                  style={textareaStyle}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <span style={{ color: error ? '#f87171' : '#555', fontSize: 12 }}>
                    {error || `${question.length}/500`}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={reset} style={secondaryButton}>Clear</button>
                    <button type="button" onClick={send} disabled={!canSend} style={{ ...primaryButton, opacity: canSend ? 1 : 0.35 }}>
                      {loading ? <LoadingDots label="" color="#000" /> : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {sources.length > 0 && (
              <div style={{ marginTop: 14, border: '1px solid #1f1f1f', borderRadius: 10, padding: 14, background: '#070707' }}>
                <p style={{ ...eyebrow, marginBottom: 10 }}>Sources</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#d6d6d6', fontSize: 13, lineHeight: 1.35, textDecoration: 'none' }}
                    >
                      {source.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </main>

          <aside style={sideStyle}>
            <section style={panelStyle}>
              <p style={eyebrow}>Student</p>
              <div style={{ display: 'grid', gap: 10 }}>
                <Field label="Age" value={age} onChange={setAge} />
                <label style={labelStyle}>
                  Level
                  <select value={level} onChange={(e) => setLevel(e.target.value)} style={inputStyle}>
                    {LEVELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <Field label="Position" value={position} onChange={setPosition} />
                <Field label="Challenge" value={challenge} onChange={setChallenge} />
              </div>
            </section>

            <section style={panelStyle}>
              <p style={eyebrow}>Samples</p>
              <div style={{ display: 'grid', gap: 8 }}>
                {SAMPLE_QUESTIONS.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setQuestion(sample)}
                    style={sampleButton}
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </section>

            <section style={panelStyle}>
              <p style={eyebrow}>V1 Admin</p>
              <div style={{ display: 'grid', gap: 8 }}>
                <AdminLink href="/admin/questions">Queue</AdminLink>
                <AdminLink href="/admin/access">Players</AdminLink>
                <AdminLink href="/admin/kb-sources">Knowledge</AdminLink>
                <AdminLink href="/admin/launch">Launch</AdminLink>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={labelStyle}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  )
}

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} style={sampleButton}>{children}</a>
}

const eyebrow: React.CSSProperties = {
  color: '#666',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.14em',
  margin: '0 0 8px',
  textTransform: 'uppercase',
}

const quietLink: React.CSSProperties = {
  border: '1px solid #2a2a2a',
  borderRadius: 999,
  color: '#aaa',
  fontSize: 13,
  fontWeight: 800,
  padding: '9px 14px',
  textDecoration: 'none',
}

const chatSurface: React.CSSProperties = {
  background: '#050505',
  border: '1px solid #1b1b1b',
  borderRadius: 14,
  overflow: 'hidden',
}

const threadStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minHeight: 420,
  padding: 18,
}

const composerStyle: React.CSSProperties = {
  borderTop: '1px solid #1b1b1b',
  padding: 14,
  background: '#080808',
}

const textareaStyle: React.CSSProperties = {
  background: '#000',
  border: '1px solid #242424',
  borderRadius: 10,
  boxSizing: 'border-box',
  color: '#fff',
  fontFamily: '-apple-system, sans-serif',
  fontSize: 15,
  lineHeight: 1.5,
  outline: 'none',
  padding: 14,
  resize: 'vertical',
  width: '100%',
}

const primaryButton: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #fff',
  borderRadius: 999,
  color: '#000',
  cursor: 'pointer',
  fontFamily: '-apple-system, sans-serif',
  fontSize: 13,
  fontWeight: 900,
  minHeight: 38,
  minWidth: 82,
  padding: '9px 16px',
}

const secondaryButton: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #2a2a2a',
  borderRadius: 999,
  color: '#aaa',
  cursor: 'pointer',
  fontFamily: '-apple-system, sans-serif',
  fontSize: 13,
  fontWeight: 800,
  minHeight: 38,
  padding: '9px 14px',
}

const sideStyle: React.CSSProperties = {
  display: 'flex',
  flex: '0 1 320px',
  flexDirection: 'column',
  gap: 12,
  minWidth: 280,
}

const panelStyle: React.CSSProperties = {
  background: '#050505',
  border: '1px solid #1b1b1b',
  borderRadius: 12,
  padding: 14,
}

const labelStyle: React.CSSProperties = {
  color: '#777',
  display: 'grid',
  fontSize: 11,
  fontWeight: 800,
  gap: 6,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const inputStyle: React.CSSProperties = {
  background: '#000',
  border: '1px solid #242424',
  borderRadius: 8,
  color: '#fff',
  fontFamily: '-apple-system, sans-serif',
  fontSize: 14,
  letterSpacing: 0,
  minHeight: 38,
  outline: 'none',
  padding: '8px 10px',
  textTransform: 'none',
}

const sampleButton: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #242424',
  borderRadius: 8,
  color: '#d6d6d6',
  cursor: 'pointer',
  fontFamily: '-apple-system, sans-serif',
  fontSize: 13,
  lineHeight: 1.35,
  padding: '10px 11px',
  textAlign: 'left',
  textDecoration: 'none',
}
