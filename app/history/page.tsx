'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { usePostHog } from 'posthog-js/react'
import LoadingDots from '@/components/ui/LoadingDots'
import ThumbsFeedback from '@/components/ThumbsFeedback'
import ProfileCapture from '@/components/ProfileCapture'
import ShareAnswerButton from '@/components/ShareAnswerButton'
import SignOutButton from '@/components/SignOutButton'
import { getSourceAction, getSourceIcon } from '@/lib/source-labels'

type Question = {
  id: string
  question: string
  answer: string
  sources: { title: string; url: string; type: string }[]
  created_at: string
  status?: 'pending' | 'approved' | 'skipped'
  approved_at?: string | null
}

type PopularQuestion = {
  id: string
  question: string
  topic: string | null
  upvote_count: number
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 1) return 'Just now'
  if (diffH < 24) return `${diffH}h ago`
  if (diffH < 48) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}


export default function HistoryPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [popular, setPopular] = useState<PopularQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [newAnswer, setNewAnswer] = useState(false)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const readIdsRef = useRef<Set<string>>(new Set())
  const router = useRouter()
  const posthog = usePostHog()

  const fetchQuestions = async () => {
    const res = await fetch('/api/history')
    if (!res.ok) return []
    const data = await res.json()
    return data.questions || []
  }

  useEffect(() => {
    const init = async () => {
      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/sign-in'); return }
      setUserEmail(user.email || '')
      if (user.email) posthog?.identify(user.email, { email: user.email })
      // Kick off the popular-questions fetch in parallel with the user's own
      // history — it isn't render-critical for the top of the page so it can
      // finish whenever.
      void fetch(`/api/browse?email=${encodeURIComponent(user.email || '')}`)
        .then((r) => r.ok ? r.json() : { questions: [] })
        .then((data) => setPopular((data?.questions || []).slice(0, 6)))
        .catch(() => setPopular([]))
      const qs = await fetchQuestions()
      setQuestions(qs)
      knownIdsRef.current = new Set(qs.map((q: Question) => q.id))
      setLoading(false)
    }
    init()
  }, [router])

  // Poll for new answers / status changes
  useEffect(() => {
    const interval = setInterval(async () => {
      const qs = await fetchQuestions()
      const existingMap = new Map(questions.map((q) => [q.id, q.status]))
      const hasNew = qs.some((q: Question) => !knownIdsRef.current.has(q.id))
      const hasNewlyApproved = qs.some((q: Question) =>
        q.status === 'approved' && existingMap.get(q.id) === 'pending'
      )
      if (hasNew || hasNewlyApproved) {
        setNewAnswer(true)
        setQuestions(qs)
        qs.forEach((q: Question) => knownIdsRef.current.add(q.id))
      } else if (qs.length !== questions.length) {
        setQuestions(qs)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [questions])

  const openQuestion = openId ? questions.find((q) => q.id === openId) : null

  return (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col">
      {/* "Elijah wrote back" banner */}
      {newAnswer && (
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-white text-black px-5 py-3 flex items-center justify-between cursor-pointer slide-up"
          onClick={() => { setNewAnswer(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
        >
          <p className="text-sm font-bold">Elijah wrote back.</p>
          <button onClick={(e) => { e.stopPropagation(); setNewAnswer(false) }} className="text-gray-500 text-xs ml-4">✕</button>
        </div>
      )}

      {/* Nav — minimal */}
      <nav className="flex items-center justify-between px-5 py-4 shrink-0">
        <Link href="/ask" className="text-gray-500 hover:text-white transition-colors text-sm">← Ask</Link>
        <SignOutButton className="text-xs text-gray-600 hover:text-white transition-colors" />
      </nav>

      {/* Header — retention anchor. Totals + prominent Ask CTA up top so
          returning users are one tap from asking the next question instead
          of having to scroll past their grid to find it. */}
      <div className="px-5 pb-5 shrink-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Your questions</p>
            <h1 className="text-2xl font-bold tracking-tight">
              {questions.length > 0 ? `${questions.length} question${questions.length === 1 ? '' : 's'}` : 'No questions yet'}
            </h1>
            {questions.filter((q) => q.status === 'approved').length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {questions.filter((q) => q.status === 'approved').length} answered by Elijah
              </p>
            )}
          </div>
          {questions.length > 0 && (
            <Link
              href="/ask"
              className="shrink-0 bg-white text-black px-4 py-2 text-xs font-bold rounded-full hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              Ask Elijah →
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pb-28 md:pb-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingDots label="Loading your questions" className="text-sm text-gray-500" />
          </div>
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-500 text-sm mb-6">Ask Elijah something and your answers show up here.</p>
            <Link
              href="/ask"
              className="bg-white text-black px-6 py-3 text-sm font-bold rounded-full hover:opacity-80 transition-opacity"
            >
              Ask your first question →
            </Link>
          </div>
        ) : (
          <>
            {/* ── Hooked-style investment prompt ──
                Shown between the header and the grid while Elijah is reviewing
                their question. Frames the capture as self-serving ("my real
                answer will hit specifically") rather than a form tax. The
                component internally hides itself once the profile is complete
                or the user skips for this scope. */}
            {userEmail && (
              <div className="mb-8">
                <ProfileCapture email={userEmail} dismissScope="history-inline" />
              </div>
            )}

            {/* ── Flashcard grid ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {questions.map((q) => {
                const isApproved = q.status === 'approved'
                const isPending = q.status === 'pending'
                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setOpenId(q.id)
                      if (!readIdsRef.current.has(q.id)) {
                        readIdsRef.current.add(q.id)
                        posthog?.capture('answer_read', { question_id: q.id })
                      }
                    }}
                    className="text-left rounded-xl p-4 flex flex-col justify-between transition-colors"
                    style={{
                      aspectRatio: '1',
                      background: isApproved ? '#0a1a0a' : isPending ? '#0a0d1a' : '#0a0a0a',
                      border: `1px solid ${isApproved ? '#1a3a1a' : isPending ? '#1a2040' : '#1a1a1a'}`,
                    }}
                  >
                    <div>
                      {/* Status indicator */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: isApproved ? '#4ade80' : isPending ? '#6366f1' : '#555' }}
                        />
                        <span className="text-[9px] uppercase tracking-widest" style={{ color: isApproved ? '#4ade80' : isPending ? '#6366f1' : '#555' }}>
                          {isApproved ? 'Answered' : isPending ? 'Reviewing' : 'Skipped'}
                        </span>
                      </div>

                      {/* Question preview — up to 4 lines */}
                      <p
                        className="text-sm font-semibold leading-snug text-white"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: 'vertical' as const,
                          overflow: 'hidden',
                        }}
                      >
                        {q.question}
                      </p>
                    </div>

                    {/* Bottom: date */}
                    <p className="text-[10px] text-gray-600 mt-2">{formatDate(q.created_at)}</p>
                  </button>
                )
              })}
            </div>

            {/* Ask another — below the grid */}
            <div className="mt-8 text-center">
              <Link
                href="/ask"
                className="inline-block bg-white text-black px-6 py-3 text-sm font-bold rounded-full hover:opacity-80 transition-opacity"
              >
                Ask another question →
              </Link>
            </div>

            {/* ── Questions from players like you ──
                Tribe reward + next-trigger loader. Top upvoted approved
                questions from the community. Clicking a card pre-fills the
                ask input (via ?followup=) so the next question is one tap
                away. Filtered to exclude anything they already asked. */}
            {popular.length > 0 && (() => {
              const ownIds = new Set(questions.map((q) => q.id))
              const feed = popular.filter((p) => !ownIds.has(p.id)).slice(0, 6)
              if (feed.length === 0) return null
              return (
                <div className="mt-16">
                  <div className="flex items-baseline justify-between mb-4">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">Questions players like you are asking</p>
                    <Link href="/browse" className="text-[10px] text-gray-600 hover:text-white transition-colors uppercase tracking-widest">
                      Browse all →
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {feed.map((p) => (
                      <Link
                        key={p.id}
                        href={`/ask?followup=${encodeURIComponent(p.question)}`}
                        className="group flex items-start justify-between gap-3 border border-gray-900 hover:border-gray-700 rounded-xl p-4 transition-colors"
                      >
                        <p className="text-sm text-gray-300 italic leading-snug group-hover:text-white transition-colors">
                          &ldquo;{p.question}&rdquo;
                        </p>
                        <span className="shrink-0 text-[10px] text-gray-600 uppercase tracking-widest whitespace-nowrap mt-0.5">
                          Ask →
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </div>

      {/* ── Detail overlay: full answer + sources + follow-up ── */}
      {openQuestion && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-gray-900">
            <button
              onClick={() => setOpenId(null)}
              className="text-gray-400 hover:text-white text-sm transition-colors min-h-[44px] flex items-center"
            >
              ← Back
            </button>
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: openQuestion.status === 'approved' ? '#4ade80' : '#6366f1' }}
              />
              <span className="text-[10px] uppercase tracking-widest" style={{ color: openQuestion.status === 'approved' ? '#4ade80' : '#6366f1' }}>
                {openQuestion.status === 'approved' ? 'Elijah answered' : 'Reviewing'}
              </span>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-6 pb-safe-plus-16">
            {/* The question */}
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">You asked</p>
            <h2 className="text-xl font-bold leading-snug mb-8">{openQuestion.question}</h2>

            {/* The answer */}
            <div className="border-l-2 border-white pl-5 mb-8">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">
                {openQuestion.status === 'approved' ? "Elijah's answer" : 'First take (Elijah reviewing)'}
              </p>
              <p className="text-base leading-relaxed text-gray-200 whitespace-pre-wrap">
                {openQuestion.answer}
              </p>
              {/* Answer feedback — only for approved answers. Silent thumbs-up,
                  thumbs-down prompts for a comment that emails Elijah.
                  Share button next to it points to the public /browse/[id]
                  page for that answer. */}
              {openQuestion.status === 'approved' && (
                <div className="mt-5 pt-4 border-t border-gray-900 flex items-center justify-between gap-4">
                  <ThumbsFeedback questionId={openQuestion.id} email={userEmail} />
                  <ShareAnswerButton questionId={openQuestion.id} question={openQuestion.question} />
                </div>
              )}
            </div>

            {/* Post-answer profile capture — Hooked Investment phase. Only
                shown after Elijah's approved answer; hides itself once the
                user completes both stages. */}
            {openQuestion.status === 'approved' && userEmail && (
              <ProfileCapture email={userEmail} questionId={openQuestion.id} />
            )}

            {/* Sources */}
            {openQuestion.sources && openQuestion.sources.length > 0 && (
              <div className="mb-8">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Go deeper</p>
                <div className="flex flex-col gap-1.5">
                  {openQuestion.sources.map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {getSourceIcon(s)}&nbsp;&nbsp;{getSourceAction(s)}: {s.title}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Date */}
            <p className="text-xs text-gray-600 mb-8">
              Asked {new Date(openQuestion.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {openQuestion.approved_at && (
                <> · Answered {new Date(openQuestion.approved_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</>
              )}
            </p>

            {/* Follow-up CTA */}
            <Link
              href={`/ask?followup=${encodeURIComponent(openQuestion.question)}`}
              className="block w-full bg-white text-black text-center py-4 text-sm font-bold rounded-full hover:opacity-80 transition-opacity"
            >
              Ask a follow-up →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
