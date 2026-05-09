'use client'

import { useState } from 'react'
import Link from 'next/link'

type Stage = 'input' | 'refining' | 'review' | 'saving' | 'saved'

const TOPICS = [
  'confidence', 'pressure', 'consistency', 'focus', 'slump',
  'coaching', 'team', 'mindset', 'motivation', 'identity',
  'nutrition', 'recovery', 'workout', 'film', 'recruiting',
]

export default function KbAddPage() {
  const [stage, setStage] = useState<Stage>('input')
  const [rawNote, setRawNote] = useState('')
  const [askerType, setAskerType] = useState<'student' | 'parent'>('student')
  const [refined, setRefined] = useState('')
  const [suggestedQuestion, setSuggestedQuestion] = useState('')
  const [topic, setTopic] = useState('mindset')
  const [error, setError] = useState('')
  const [savedTitle, setSavedTitle] = useState('')

  const handleRefine = async () => {
    if (rawNote.trim().length < 10) {
      setError('Add more detail before refining.')
      return
    }
    setStage('refining')
    setError('')
    try {
      const res = await fetch('/api/admin/refine-kb-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawNote, askerType }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Refinement failed.'); setStage('input'); return }
      setRefined(data.refined)
      setSuggestedQuestion(data.suggestedQuestion)
      setTopic(data.topic)
      setStage('review')
    } catch {
      setError('Something went wrong.')
      setStage('input')
    }
  }

  const handleApprove = async () => {
    setStage('saving')
    setError('')
    try {
      const res = await fetch('/api/admin/save-kb-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refined, suggestedQuestion, topic, askerType }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Save failed.'); setStage('review'); return }
      setSavedTitle(data.sourceTitle)
      setStage('saved')
    } catch {
      setError('Something went wrong.')
      setStage('review')
    }
  }

  const handleReset = () => {
    setStage('input')
    setRawNote('')
    setRefined('')
    setSuggestedQuestion('')
    setTopic('mindset')
    setError('')
    setSavedTitle('')
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px', fontFamily: 'system-ui, sans-serif', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <Link href="/admin/kb-sources" style={{ fontSize: 12, color: '#555', textDecoration: 'none' }}>← KB Sources</Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Add to Knowledge Base</h1>
      </div>

      {/* Saved */}
      {stage === 'saved' && (
        <div style={{ background: '#0a2a1a', border: '1px solid #16a34a', borderRadius: 16, padding: 28 }}>
          <p style={{ fontSize: 11, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 8 }}>
            ✓ Added to Knowledge Base
          </p>
          <p style={{ color: '#fff', marginBottom: 4 }}>{savedTitle}</p>
          <p style={{ fontSize: 13, color: '#555', marginBottom: 24 }}>Elijah's thinking is now embedded and will inform every future answer on this topic.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleReset} style={primaryBtn}>Add another note →</button>
            <Link href="/admin/kb-sources" style={{ ...secondaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>View KB sources</Link>
          </div>
        </div>
      )}

      {/* Input stage */}
      {(stage === 'input' || stage === 'refining') && (
        <div>
          <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6, marginBottom: 28 }}>
            Type your raw thinking — a concept, a lesson, something you believe about the game. Claude will rewrite it grounded in neuroscience, psychology, and sports science, in your voice, formatted as an answer to a player or parent question. You approve it before anything gets saved.
          </p>

          {/* Asker type toggle */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Who does this answer?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['student', 'parent'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setAskerType(t)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 999,
                    border: '1px solid',
                    borderColor: askerType === t ? '#fff' : '#333',
                    background: askerType === t ? '#fff' : 'transparent',
                    color: askerType === t ? '#000' : '#888',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t === 'student' ? 'Player / Student' : 'Parent'}
                </button>
              ))}
            </div>
          </div>

          {/* Raw note input */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Your raw thinking
            </p>
            <textarea
              value={rawNote}
              onChange={(e) => { setRawNote(e.target.value); setError('') }}
              placeholder="e.g. When players miss shots they shouldn't think about it. They need to move on. Their brain needs to reset. I used to do this thing where I'd take a deep breath and say next play..."
              rows={8}
              style={{
                width: '100%',
                background: '#111',
                border: '1px solid #222',
                borderRadius: 12,
                padding: '14px 16px',
                color: '#fff',
                fontSize: 14,
                lineHeight: 1.7,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <button
            onClick={handleRefine}
            disabled={stage === 'refining' || rawNote.trim().length < 10}
            style={{ ...primaryBtn, opacity: stage === 'refining' || rawNote.trim().length < 10 ? 0.35 : 1 }}
          >
            {stage === 'refining' ? 'Refining with science...' : 'Refine with science →'}
          </button>
        </div>
      )}

      {/* Review stage */}
      {(stage === 'review' || stage === 'saving') && (
        <div>
          <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6, marginBottom: 28 }}>
            Here's what Claude wrote. Edit anything you want, then approve to save it to the KB.
          </p>

          {/* Suggested question */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Question this answers ({askerType === 'parent' ? 'parent' : 'player'})
            </p>
            <input
              value={suggestedQuestion}
              onChange={(e) => setSuggestedQuestion(e.target.value)}
              style={{
                width: '100%',
                background: '#111',
                border: '1px solid #222',
                borderRadius: 10,
                padding: '12px 14px',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Topic */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Topic
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 999,
                    border: '1px solid',
                    borderColor: topic === t ? '#fff' : '#333',
                    background: topic === t ? '#fff' : 'transparent',
                    color: topic === t ? '#000' : '#666',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Refined answer */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 700 }}>
              Is this what you want to say?
            </p>
            <textarea
              value={refined}
              onChange={(e) => setRefined(e.target.value)}
              rows={16}
              style={{
                width: '100%',
                background: '#0d0d0d',
                border: '1px solid #2a2a2a',
                borderRadius: 12,
                padding: '16px',
                color: '#fff',
                fontSize: 14,
                lineHeight: 1.8,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={handleApprove}
              disabled={stage === 'saving' || refined.trim().length < 20}
              style={{ ...primaryBtn, opacity: stage === 'saving' || refined.trim().length < 20 ? 0.35 : 1 }}
            >
              {stage === 'saving' ? 'Saving to KB...' : '✓ Approve & save to KB'}
            </button>
            <button onClick={() => setStage('input')} style={secondaryBtn}>
              ← Edit raw note
            </button>
            <button onClick={handleRefine} style={secondaryBtn}>
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  background: '#fff',
  color: '#000',
  border: 'none',
  borderRadius: 999,
  padding: '12px 24px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#666',
  border: '1px solid #333',
  borderRadius: 999,
  padding: '12px 20px',
  fontSize: 13,
  cursor: 'pointer',
}
