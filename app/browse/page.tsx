'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LoadingDots from '@/components/ui/LoadingDots'
import { getLocal } from '@/lib/safe-storage'
import { simFetch } from '@/lib/simulator'
import { getSourceAction, getSourceIcon } from '@/lib/source-labels'

type AnswerSource = {
  title: string
  url: string
  type?: string | null
}

type Question = {
  id: string
  question: string
  answer: string
  topic: string | null
  created_at: string
  asker_label?: string | null
  player_age?: number | null
  themes?: string[]
  age_band?: string | null
  upvote_count: number
  user_upvoted: boolean
  reviewed_by_elijah: boolean
  sources?: AnswerSource[]
}

const CATEGORIES = ['All', 'Confidence', 'Pressure', 'Coach', 'Slumps', 'Mindset', 'Recruiting', 'Parents']
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Confidence: ['confidence', 'believe', 'belief', 'scared', 'fear', 'doubt', 'nervous', 'teammates'],
  Pressure: ['pressure', 'big game', 'finals', 'sleep', 'nerves', 'freeze', 'shot', 'clutch'],
  Coach: ['coach', 'bench', 'benching', 'starting', 'minutes', 'playing time'],
  Slumps: ['slump', 'streak', 'bad', 'not working', 'passion', 'love', 'lost', 'harder'],
  Mindset: ['mindset', 'mental', 'head', 'think', 'motivation', 'focus', 'position'],
  Recruiting: ['recruiting', 'college', 'nil', 'd1', 'offer', 'coach coming'],
  Parents: ['parent', 'dad', 'mom', 'family'],
}

const CATEGORY_THEMES: Record<string, string[]> = {
  Confidence: ['confidence', 'identity'],
  Pressure: ['pressure'],
  Coach: ['coach', 'role'],
  Slumps: ['slumps', 'burnout'],
  Mindset: ['mindset', 'faith'],
  Recruiting: ['recruiting'],
  Parents: ['parent'],
}

function matchesCategory(q: Question, category: string): boolean {
  if (category === 'All') return true
  const themes = q.themes || []
  if ((CATEGORY_THEMES[category] || []).some((theme) => themes.includes(theme))) return true
  return (CATEGORY_KEYWORDS[category] || []).some((k) => q.question.toLowerCase().includes(k))
}

export default function BrowsePage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    const stored = getLocal('ask_elijah_email') || ''
    setUserEmail(stored)
    fetch(`/api/browse${stored ? `?email=${encodeURIComponent(stored)}` : ''}`)
      .then((r) => r.json())
      .then((d) => setQuestions(d.questions || []))
      .finally(() => setLoading(false))
  }, [])

  const handleUpvote = async (questionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!userEmail) { router.push('/sign-in'); return }
    // Predict the upvote response in simulator mode so the UI still toggles
    // visibly without hitting the real endpoint.
    const currently = questions.find((q) => q.id === questionId)?.user_upvoted
    const res = await simFetch(
      '/api/upvote',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: questionId, email: userEmail }),
      },
      { action: currently ? 'removed' : 'added' }
    )
    const data = await res.json()
    setQuestions((prev) =>
      prev.map((q) =>
        q.id !== questionId ? q : {
          ...q,
          user_upvoted: data.action === 'added',
          upvote_count: data.action === 'added' ? q.upvote_count + 1 : q.upvote_count - 1,
        }
      )
    )
  }

  const filtered = questions.filter((q) => matchesCategory(q, activeCategory))
  const openQuestion = openId ? questions.find((q) => q.id === openId) : null

  return (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-5 py-4 shrink-0">
        <Link href={userEmail ? '/track' : '/'} className="text-gray-500 hover:text-white text-sm transition-colors">
          {userEmail ? '← Locker room' : '← Home'}
        </Link>
        <Link href="/ask" className="text-xs text-white font-semibold hover:opacity-70 transition-opacity">Ask Elijah →</Link>
      </nav>

      {/* Header — compact on mobile */}
      <div className="px-5 pb-4 shrink-0">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Community</p>
        <h1 className="text-2xl font-bold tracking-tight mb-1">What players are asking.</h1>
        <p className="text-xs text-gray-500">{filtered.length} questions · Real answers from Elijah</p>
      </div>

      {/* Category filters — horizontal scroll on mobile */}
      <div className="chip-row flex gap-2 px-5 pb-4 shrink-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 text-sm px-4 py-2 rounded-full border whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'border-white text-black bg-white'
                : 'border-gray-800 text-gray-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pb-28 md:pb-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingDots label="Loading questions" className="text-sm text-gray-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-600 text-sm mb-6">
              {activeCategory === 'All' ? 'No answers loaded yet.' : `No ${activeCategory.toLowerCase()} answers yet.`}
            </p>
            <Link href="/ask" className="inline-block bg-white text-black px-6 py-3 text-sm font-bold rounded-full">
              Ask Elijah →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((q) => (
              <button
                key={q.id}
                onClick={() => setOpenId(q.id)}
                className="text-left rounded-xl p-4 flex flex-col justify-between transition-colors border border-gray-900 hover:border-gray-700"
                style={{
                  aspectRatio: '1',
                  background: '#0a0a0a',
                }}
              >
                <div>
                  {/* Upvote count */}
                  {q.upvote_count > 0 && (
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-[11px] text-gray-500">△ {q.upvote_count}</span>
                    </div>
                  )}
                  {/* Question preview */}
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
                <div className="flex items-center justify-between mt-2 gap-2">
                  <p className="text-[10px] text-gray-700">
                    {q.asker_label || q.topic || 'Player question'}
                  </p>
                  {q.reviewed_by_elijah && (
                    <span
                      className="text-[9px] text-white/80 flex items-center gap-1 shrink-0"
                      title="Reviewed by Elijah"
                    >
                      <span aria-hidden="true">✓</span>
                      <span className="uppercase tracking-wider">Elijah</span>
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop sticky CTA */}
      <div className="hidden md:flex fixed bottom-0 left-0 right-0 bg-black border-t border-gray-900 px-5 py-4 items-center justify-between">
        <p className="text-xs text-gray-600">Something on your mind?</p>
        <Link href="/ask" className="text-sm font-bold text-white hover:opacity-70 transition-opacity">Ask Elijah →</Link>
      </div>

      {/* ── Detail overlay ── */}
      {openQuestion && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-gray-900">
            <button onClick={() => setOpenId(null)} className="text-gray-400 hover:text-white text-sm min-h-[44px] flex items-center">
              ← Back
            </button>
            <button
              onClick={(e) => handleUpvote(openQuestion.id, e)}
              className={`flex items-center gap-1.5 text-sm min-h-[44px] px-3 rounded-full border transition-colors ${
                openQuestion.user_upvoted ? 'border-white text-white' : 'border-gray-800 text-gray-500'
              }`}
            >
              <span>{openQuestion.user_upvoted ? '▲' : '△'}</span>
              <span>{openQuestion.upvote_count > 0 ? `${openQuestion.upvote_count}` : 'Me too'}</span>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-6 pb-safe-plus-16">
            {/* Question */}
            <h2 className="text-xl font-bold leading-snug mb-8">&ldquo;{openQuestion.question}&rdquo;</h2>

            {/* Answer */}
            <div className="border-l-2 border-white pl-5 mb-8">
              <div className="flex items-center gap-3 mb-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Elijah&apos;s answer</p>
                {openQuestion.reviewed_by_elijah && (
                  <span
                    className="text-[10px] text-white uppercase tracking-widest flex items-center gap-1"
                    title="Elijah personally reviewed and approved this answer"
                  >
                    <span aria-hidden="true">✓</span>
                    <span>Reviewed by Elijah</span>
                  </span>
                )}
              </div>
              <p className="text-base leading-relaxed text-gray-200 whitespace-pre-wrap">{openQuestion.answer}</p>
            </div>

            {/* Topic */}
            {(openQuestion.asker_label || openQuestion.topic || openQuestion.themes?.length) && (
              <p className="text-xs text-gray-600 mb-8">
                {[openQuestion.asker_label, openQuestion.topic, ...(openQuestion.themes || []).slice(0, 2)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}

            {/* Sources */}
            {Array.isArray(openQuestion.sources) && openQuestion.sources.length > 0 && (
              <div className="border-t border-gray-900 pt-6 mb-8">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">Go deeper</p>
                <div className="flex flex-col gap-2">
                  {openQuestion.sources.slice(0, 4).map((s, i) => (
                    <a
                      key={`${s.url}-${i}`}
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

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Link
                href={`/ask?q=${encodeURIComponent(openQuestion.question)}`}
                className="block w-full bg-white text-black text-center py-4 text-sm font-bold rounded-full hover:opacity-80 transition-opacity"
              >
                Ask your version of this →
              </Link>
              <Link
                href={`/browse/${openQuestion.id}`}
                className="block w-full text-center py-3 text-sm text-gray-500 border border-gray-800 rounded-full hover:border-gray-600 transition-colors"
              >
                Share this answer
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
