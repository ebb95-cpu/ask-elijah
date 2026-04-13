'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function Logo() {
  return (
    <svg width="52" height="8" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill="#fff" />
      <line x1="8" y1="4" x2="20" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill="#fff" />
      <line x1="28" y1="4" x2="40" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill="#fff" />
    </svg>
  )
}

type Question = {
  id: string
  question: string
  answer: string
  truncated: boolean
  upvote_count: number
  user_upvoted: boolean
}

const CATEGORIES = ['All', 'Confidence', 'Pressure', 'Coach', 'Slumps', 'Mindset']

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Confidence: ['confidence', 'believe', 'belief', 'scared', 'fear', 'doubt', 'nervous', 'teammates'],
  Pressure: ['pressure', 'big game', 'finals', 'sleep', 'nerves', 'freeze', 'shot', 'clutch'],
  Coach: ['coach', 'bench', 'benching', 'starting', 'minutes', 'playing time'],
  Slumps: ['slump', 'streak', 'bad', 'not working', 'passion', 'love', 'lost', 'harder'],
  Mindset: ['mindset', 'mental', 'head', 'think', 'motivation', 'focus', 'position'],
}

function matchesCategory(question: string, category: string): boolean {
  if (category === 'All') return true
  const keywords = CATEGORY_KEYWORDS[category] || []
  return keywords.some(k => question.toLowerCase().includes(k))
}

export default function BrowsePage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')

  useEffect(() => {
    const stored = localStorage.getItem('ask_elijah_email') || ''
    setUserEmail(stored)
    fetch(`/api/browse${stored ? `?email=${encodeURIComponent(stored)}` : ''}`)
      .then(r => r.json())
      .then(d => setQuestions(d.questions || []))
      .finally(() => setLoading(false))
  }, [])

  const handleUpvote = async (questionId: string) => {
    if (!userEmail) { router.push('/sign-in'); return }
    const res = await fetch('/api/upvote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, email: userEmail }),
    })
    const data = await res.json()
    setQuestions(prev => prev.map(q => {
      if (q.id !== questionId) return q
      return {
        ...q,
        user_upvoted: data.action === 'added',
        upvote_count: data.action === 'added' ? q.upvote_count + 1 : q.upvote_count - 1,
      }
    }))
  }

  const filtered = questions.filter(q => matchesCategory(q.question, activeCategory))

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-5 py-5 border-b border-gray-900">
        <Link href="/"><Logo /></Link>
        <button
          onClick={() => router.push('/')}
          className="text-xs text-white font-semibold hover:opacity-70 transition-opacity"
        >
          Ask your question →
        </button>
      </nav>

      {/* Header */}
      <div className="px-5 pt-12 pb-8 max-w-2xl mx-auto w-full">
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">Ask Elijah</p>
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-3">
          Questions players are afraid to ask out loud.
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Real answers from Elijah Bryant — NBA + EuroLeague Champion.
        </p>
      </div>

      {/* Category filters */}
      <div className="px-5 pb-6 max-w-2xl mx-auto w-full">
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs px-3 py-1.5 border transition-colors ${
                activeCategory === cat
                  ? 'border-white text-white bg-white text-black'
                  : 'border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Questions */}
      <main className="flex-1 px-5 pb-24 max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="space-y-0">
            {[1,2,3].map(i => (
              <div key={i} className="py-8 border-b border-gray-900 animate-pulse">
                <div className="h-5 bg-gray-900 rounded w-3/4 mb-4" />
                <div className="h-4 bg-gray-900 rounded w-full mb-2" />
                <div className="h-4 bg-gray-900 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-600 text-sm mb-6">
              {activeCategory === 'All'
                ? 'No questions yet. Be the first.'
                : `No ${activeCategory.toLowerCase()} questions yet.`}
            </p>
            <button
              onClick={() => router.push('/')}
              className="text-white text-sm border border-gray-700 px-4 py-2 hover:border-white transition-colors"
            >
              Ask Elijah →
            </button>
          </div>
        ) : (
          <div className="space-y-0">
            {filtered.map((q, i) => (
              <div
                key={q.id}
                className={`py-8 ${i < filtered.length - 1 ? 'border-b border-gray-900' : ''}`}
              >
                {/* Question */}
                <p className="text-white font-bold text-lg leading-snug mb-4">
                  &ldquo;{q.question}&rdquo;
                </p>

                {/* Answer preview */}
                <div className="relative mb-5">
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {q.answer}{q.truncated ? '...' : ''}
                  </p>
                  {q.truncated && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
                      style={{ background: 'linear-gradient(to bottom, transparent, #000)' }}
                    />
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleUpvote(q.id)}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${
                      q.user_upvoted ? 'text-white' : 'text-gray-600 hover:text-gray-300'
                    }`}
                  >
                    <span className="text-base">{q.user_upvoted ? '▲' : '△'}</span>
                    <span>{q.upvote_count > 0 ? `${q.upvote_count} had this too` : 'I had this too'}</span>
                  </button>

                  {q.truncated && (
                    <button
                      onClick={() => setModalOpen(true)}
                      className="text-xs text-gray-600 hover:text-white transition-colors underline underline-offset-2"
                    >
                      Read the full answer →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-900 px-5 py-4 flex items-center justify-between">
        <p className="text-xs text-gray-600">Something on your mind?</p>
        <button
          onClick={() => router.push('/')}
          className="text-sm font-bold text-white hover:opacity-70 transition-opacity"
        >
          Ask Elijah →
        </button>
      </div>

      {/* Paywall modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center px-5 z-50"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-black border border-gray-800 max-w-sm w-full p-8 relative"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-gray-600 hover:text-white text-xs">✕</button>
            <p className="text-white font-bold text-xl mb-3">Ask your own question.</p>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              Elijah reads it personally and writes back. Not a template. Your situation, specifically.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push('/')}
                className="block bg-white text-black text-sm font-bold text-center py-3 px-6 hover:opacity-80 transition-opacity"
              >
                Ask my question →
              </button>
              <Link
                href="/pricing"
                className="text-xs text-gray-600 hover:text-white transition-colors text-center py-2"
              >
                View plans →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
