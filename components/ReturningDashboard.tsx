'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getLocal, setLocal } from '@/lib/safe-storage'

/**
 * Returning-user dashboard for /ask.
 *
 * What returning students see instead of the cold "Ask anything" form:
 *   1. Greeting + their questions with status (waiting / answered / reflected)
 *   2. Unread-answer dot for any approved question they haven't tapped yet
 *   3. Trending community questions
 *   4. Single Ask CTA that hands control back to /ask's input mode
 *
 * Hooked-aligned: trigger (status badges), action (one-tap continue, ask, or
 * upvote), variable reward (community trending shifts daily), investment (
 * reflecting on prior answers + asking follow-ups).
 */

type MyQuestion = {
  id: string
  question: string
  answer: string | null
  status: 'pending' | 'approved'
  action_steps: string | null
  asked_at: string
  answered_at: string | null
  reviewed_by_elijah: boolean
  has_reflection: boolean
}

type TrendingQuestion = {
  id: string
  question: string
  upvote_count: number
}

const VIEWED_KEY = 'ask_elijah_viewed_question_ids'

function getViewedIds(): Set<string> {
  try {
    const raw = getLocal(VIEWED_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function markViewed(id: string) {
  const set = getViewedIds()
  if (set.has(id)) return
  set.add(id)
  try {
    setLocal(VIEWED_KEY, JSON.stringify(Array.from(set)))
  } catch {
    /* localStorage blocked */
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d} days ago`
  const mo = Math.floor(d / 30)
  return `${mo}mo ago`
}

type KbQuote = {
  text: string
  source_title: string
  source_url: string | null
  voice?: string
}

export default function ReturningDashboard({
  email,
  trending,
  onAsk,
  onContinueThread,
}: {
  email: string
  trending: TrendingQuestion[]
  onAsk: () => void
  onContinueThread: (priorQuestion: string) => void
}) {
  const [questions, setQuestions] = useState<MyQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Variable-reward slot: one Craig Manning quote tied to the student's most
  // recent question. Changes every visit — Nir Eyal's stickiness principle.
  const [kbQuote, setKbQuote] = useState<KbQuote | null>(null)

  // Hydrate viewed-set from localStorage on mount.
  useEffect(() => {
    setViewedIds(getViewedIds())
  }, [])

  // Pull the user's questions across statuses.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/my-questions?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setQuestions(d.questions || [])
      })
      .catch(() => {
        if (!cancelled) setQuestions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [email])

  const unreadCount = useMemo(
    () => questions.filter((q) => q.status === 'approved' && !viewedIds.has(q.id)).length,
    [questions, viewedIds]
  )

  // Fetch a Craig Manning quote once we know the student's most recent topic.
  useEffect(() => {
    const topic = questions[0]?.question
    if (!topic) return
    let cancelled = false
    fetch(`/api/kb-quote?topic=${encodeURIComponent(topic)}`)
      .then((r) => r.json())
      .then((d: KbQuote) => {
        if (!cancelled && d?.text) setKbQuote(d)
      })
      .catch(() => {
        /* fallback handled by API */
      })
    return () => {
      cancelled = true
    }
  }, [questions])

  const handleExpand = useCallback((q: MyQuestion) => {
    if (q.status !== 'approved') return
    setExpandedId((prev) => (prev === q.id ? null : q.id))
    if (!viewedIds.has(q.id)) {
      markViewed(q.id)
      setViewedIds((prev) => {
        const next = new Set(prev)
        next.add(q.id)
        return next
      })
    }
  }, [viewedIds])

  const firstName = email.split('@')[0].split(/[._-]/)[0]
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1)

  return (
    <div className="w-full max-w-2xl mx-auto px-5 md:px-6 py-6 md:py-8 flex flex-col gap-8">
      {/* Header + ask CTA */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-1">
            Welcome back, {displayName}.
          </h1>
          {unreadCount > 0 ? (
            <p className="text-sm text-emerald-400">
              Elijah wrote back on {unreadCount} {unreadCount === 1 ? 'question' : 'questions'}.
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              Anything new on your mind?
            </p>
          )}
        </div>
        <button
          onClick={onAsk}
          className="bg-white text-black text-sm font-semibold px-5 py-2.5 rounded-full hover:opacity-80 transition-opacity shrink-0"
        >
          Ask Elijah →
        </button>
      </div>

      {/* Variable-reward slot — Craig Manning quote tied to last topic. */}
      {kbQuote && (
        <section className="border border-gray-900 bg-gray-950/50 rounded-lg px-5 py-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
            One thing to chew on
          </p>
          <p className="text-base text-gray-200 leading-relaxed italic mb-2">
            &ldquo;{kbQuote.text}&rdquo;
          </p>
          <p className="text-xs text-gray-600">
            — {kbQuote.voice || 'Elijah'}
            {kbQuote.source_url ? (
              <>
                {' · '}
                <a
                  href={kbQuote.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  {kbQuote.source_title}
                </a>
              </>
            ) : (
              <>{' · '}{kbQuote.source_title}</>
            )}
          </p>
        </section>
      )}

      {/* Your questions */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[10px] text-gray-500 uppercase tracking-widest">
            Your questions {questions.length > 0 && <span className="text-gray-700">· {questions.length}</span>}
          </h2>
          {questions.length > 0 && (
            <Link href="/history" className="text-[10px] text-gray-600 hover:text-white transition-colors uppercase tracking-widest">
              See all →
            </Link>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-gray-700">Loading...</div>
        ) : questions.length === 0 ? (
          <p className="text-sm text-gray-600">
            You haven&apos;t asked anything yet. Hit the button up top to start.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {questions.slice(0, 5).map((q) => {
              const isUnread = q.status === 'approved' && !viewedIds.has(q.id)
              const isWaiting = q.status === 'pending'
              const isExpanded = expandedId === q.id
              return (
                <li
                  key={q.id}
                  className={`border rounded-lg transition-colors ${
                    isUnread ? 'border-emerald-900/60 bg-emerald-950/15' : 'border-gray-900 bg-gray-950'
                  }`}
                >
                  <button
                    onClick={() => handleExpand(q)}
                    disabled={isWaiting}
                    className="w-full text-left px-4 py-3 flex items-start gap-3"
                  >
                    {/* Status badge */}
                    <span
                      className={`mt-0.5 text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                        isWaiting
                          ? 'bg-amber-950/40 text-amber-400 border border-amber-900/60'
                          : isUnread
                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/60'
                            : 'bg-gray-900 text-gray-500 border border-gray-800'
                      }`}
                    >
                      {isWaiting ? '⏱ Waiting' : isUnread ? '✓ New' : '✓ Answered'}
                    </span>

                    {/* Question + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white leading-snug">
                        {q.question}
                      </p>
                      <p className="text-[11px] text-gray-600 mt-1">
                        Asked {timeAgo(q.asked_at)}
                        {q.status === 'approved' && q.answered_at && (
                          <> · Answered {timeAgo(q.answered_at)}</>
                        )}
                        {q.has_reflection && <> · You reflected ✓</>}
                      </p>
                    </div>

                    {q.status === 'approved' && (
                      <span className="text-gray-700 text-xs mt-1 shrink-0">
                        {isExpanded ? '▴' : '▾'}
                      </span>
                    )}
                  </button>

                  {/* Expanded answer */}
                  {isExpanded && q.answer && (
                    <div className="px-4 pb-4 pt-1 border-t border-gray-900 mt-1">
                      <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap mb-4">
                        {q.answer}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onContinueThread(q.question)
                          }}
                          className="text-xs bg-white text-black font-semibold px-4 py-2 rounded-full hover:opacity-80 transition-opacity"
                        >
                          Ask a follow-up →
                        </button>
                        {!q.has_reflection && q.action_steps && (
                          <Link
                            href="/history"
                            className="text-xs text-gray-400 hover:text-white transition-colors"
                          >
                            Reflect on this
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Trending */}
      {trending.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[10px] text-gray-500 uppercase tracking-widest">
              Trending now
            </h2>
            <Link href="/browse" className="text-[10px] text-gray-600 hover:text-white transition-colors uppercase tracking-widest">
              See all →
            </Link>
          </div>
          <ul className="flex flex-col gap-1">
            {trending.slice(0, 5).map((t) => (
              <li key={t.id}>
                <Link
                  href={`/browse?q=${encodeURIComponent(t.question)}`}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-gray-950 transition-colors"
                >
                  <span className="text-xs text-gray-600 mt-0.5 shrink-0 w-6">
                    ↑ {t.upvote_count}
                  </span>
                  <span className="text-sm text-gray-300 leading-snug">
                    {t.question}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
