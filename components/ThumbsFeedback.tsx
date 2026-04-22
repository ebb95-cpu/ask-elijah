'use client'

import { useState } from 'react'
import { simFetch } from '@/lib/simulator'

/**
 * One-tap feedback widget attached to an approved answer. Thumbs-up is
 * silent fire-and-forget. Thumbs-down opens a small textarea so the
 * student can optionally say why — that explanation is the highest-signal
 * feedback this product can get.
 *
 * Stores the vote in localStorage so the UI reflects prior state on
 * reload, and so a user can't double-count themselves.
 *
 * Props:
 *   - questionId: approved question UUID
 *   - email: student's email (optional — anonymous feedback still accepted)
 *   - compact: tighter styling for emails or dense lists
 */

type Vote = 'up' | 'down' | null

const LS_KEY = 'ask_elijah_answer_feedback'

function readVotes(): Record<string, Vote> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function writeVote(questionId: string, vote: Vote) {
  if (typeof window === 'undefined') return
  try {
    const current = readVotes()
    if (vote === null) delete current[questionId]
    else current[questionId] = vote
    window.localStorage.setItem(LS_KEY, JSON.stringify(current))
  } catch {
    /* localStorage blocked */
  }
}

export default function ThumbsFeedback({
  questionId,
  email,
  compact = false,
}: {
  questionId: string
  email?: string | null
  compact?: boolean
}) {
  const [vote, setVote] = useState<Vote>(() => readVotes()[questionId] ?? null)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (rating: 'up' | 'down', withComment?: string) => {
    if (sending) return
    setSending(true)
    try {
      await simFetch(
        '/api/feedback',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_id: questionId,
            email: email || null,
            rating,
            comment: withComment || null,
          }),
        },
        { ok: true }
      )
      writeVote(questionId, rating)
      setVote(rating)
      if (rating === 'down' && !withComment) {
        // Prompt them for the explanation — it's the real signal.
        setShowComment(true)
      } else {
        setDone(true)
        setShowComment(false)
      }
    } catch {
      /* fail silently — we don't want feedback UX to break the page */
    } finally {
      setSending(false)
    }
  }

  if (done && !showComment) {
    return (
      <div style={{ fontSize: compact ? 11 : 12, color: '#888', padding: compact ? '4px 0' : '8px 0' }}>
        Thanks. Logged.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: compact ? '4px 0' : '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: compact ? 10 : 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Was this helpful?
        </span>
        <button
          onClick={() => submit('up')}
          disabled={sending}
          aria-label="Helpful"
          style={thumbBtnStyle(vote === 'up')}
        >
          👍
        </button>
        <button
          onClick={() => submit('down')}
          disabled={sending}
          aria-label="Not helpful"
          style={thumbBtnStyle(vote === 'down')}
        >
          👎
        </button>
      </div>

      {showComment && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What was off about it? (optional, goes straight to Elijah)"
            rows={3}
            autoFocus
            style={{
              width: '100%',
              background: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: 4,
              padding: 8,
              fontSize: 13,
              color: '#fff',
              outline: 'none',
              resize: 'vertical',
              fontFamily: '-apple-system, sans-serif',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => submit('down', comment.trim())}
              disabled={sending}
              style={{
                fontSize: 11,
                padding: '5px 12px',
                background: '#fff',
                color: '#000',
                border: 'none',
                borderRadius: 4,
                cursor: sending ? 'wait' : 'pointer',
                fontWeight: 600,
              }}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
            <button
              onClick={() => {
                setShowComment(false)
                setDone(true)
              }}
              style={{
                fontSize: 11,
                padding: '5px 12px',
                background: 'transparent',
                color: '#888',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function thumbBtnStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 16,
    background: active ? '#1a1a1a' : 'transparent',
    border: `1px solid ${active ? '#444' : '#222'}`,
    borderRadius: 999,
    width: 32,
    height: 32,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    opacity: active ? 1 : 0.7,
  }
}
