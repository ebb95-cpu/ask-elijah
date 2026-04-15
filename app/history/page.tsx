'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { usePostHog } from 'posthog-js/react'

function Logo() {
  return (
    <svg width="52" height="8" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill="#000" />
      <line x1="8" y1="4" x2="20" y2="4" stroke="#000" strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill="#000" />
      <line x1="28" y1="4" x2="40" y2="4" stroke="#000" strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill="#000" />
    </svg>
  )
}

type Question = {
  id: string
  question: string
  answer: string
  sources: { title: string; url: string; type: string }[]
  created_at: string
  status?: 'pending' | 'approved' | 'skipped'
  approved_at?: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function HistoryPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
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

      if (!user) {
        router.push('/sign-in')
        return
      }

      setUserEmail(user.email || '')

      // Identify user in PostHog
      if (user.email) {
        posthog?.identify(user.email, { email: user.email })
      }

      const qs = await fetchQuestions()
      setQuestions(qs)
      knownIdsRef.current = new Set(qs.map((q: Question) => q.id))
      setLoading(false)
    }
    init()
  }, [router])

  // Poll every 30 seconds. Trigger the "Elijah wrote back" banner when either:
  // 1. a new question id appears, OR
  // 2. an existing pending question transitions to approved.
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

  const handleSignOut = async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* New answer notification */}
      {newAnswer && (
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black text-white px-6 py-4 flex items-center justify-between cursor-pointer"
          onClick={() => { setNewAnswer(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
        >
          <p className="text-sm font-semibold">Elijah wrote back. New answer at the top.</p>
          <button onClick={() => setNewAnswer(false)} className="text-gray-400 hover:text-white text-xs ml-4">Dismiss</button>
        </div>
      )}

      <nav className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <Link href="/ask" className="text-gray-400 hover:text-black transition-colors text-sm">← Ask</Link>
        <Logo />
        <button
          onClick={handleSignOut}
          className="text-xs text-gray-400 hover:text-black transition-colors"
        >
          Sign out
        </button>
      </nav>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 pb-28 md:pb-12">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs text-gray-400 tracking-widest uppercase mb-2">Your vault</p>
            <h1 className="text-3xl font-bold tracking-tight">Every answer Elijah gave you.</h1>
          </div>
          {userEmail && (
            <p className="text-xs text-gray-400 hidden md:block">{userEmail}</p>
          )}
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-50 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && questions.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm mb-6">No questions yet. Ask Elijah something.</p>
            <Link
              href="/ask"
              className="bg-black text-white px-6 py-3 text-sm font-semibold hover:opacity-80 transition-opacity"
            >
              Ask your first question →
            </Link>
          </div>
        )}

        {!loading && questions.length > 0 && (
          <div className="space-y-px">
            {questions.map((q) => (
              <div key={q.id} className="border-b border-gray-100">
                <button
                  onClick={() => {
                    const next = expanded === q.id ? null : q.id
                    setExpanded(next)
                    // Track first-time read only
                    if (next && !readIdsRef.current.has(q.id)) {
                      readIdsRef.current.add(q.id)
                      posthog?.capture('answer_read', { question_id: q.id })
                    }
                  }}
                  className="w-full text-left py-5 flex items-start justify-between gap-4 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-black font-medium text-sm leading-snug group-hover:opacity-70 transition-opacity">
                      {q.question}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-400">{formatDate(q.created_at)}</p>
                      {q.status === 'approved' ? (
                        <span className="text-[10px] uppercase tracking-wider text-green-600 font-semibold">
                          Elijah approved
                        </span>
                      ) : q.status === 'pending' ? (
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                          First take · awaiting review
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-gray-300 text-lg mt-0.5 flex-shrink-0">
                    {expanded === q.id ? '−' : '+'}
                  </span>
                </button>

                {expanded === q.id && (
                  <div className="pb-6">
                    <p className="text-gray-800 text-base leading-relaxed mb-4">{q.answer}</p>

                    {q.sources && q.sources.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-2">From Elijah&apos;s content:</p>
                        <div className="flex flex-col gap-1">
                          {q.sources.map((s, i) => (
                            <a
                              key={i}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-500 hover:text-black transition-colors underline underline-offset-2"
                            >
                              {s.type === 'newsletter' ? '📧' : '▶️'} {s.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <Link
                      href={`/ask?followup=${encodeURIComponent(q.question)}`}
                      className="inline-block mt-4 text-xs text-gray-400 border border-gray-200 px-3 py-1.5 hover:border-black hover:text-black transition-colors"
                    >
                      Ask a follow-up →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && questions.length > 0 && (
          <div className="mt-12 text-center">
            <Link
              href="/ask"
              className="bg-black text-white px-8 py-3 text-sm font-semibold hover:opacity-80 transition-opacity"
            >
              Ask another question →
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
