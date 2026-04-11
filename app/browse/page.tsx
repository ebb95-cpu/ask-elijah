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

export default function BrowsePage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('ask_elijah_email') || ''
    setUserEmail(stored)
    fetch(`/api/browse${stored ? `?email=${encodeURIComponent(stored)}` : ''}`)
      .then(r => r.json())
      .then(d => {
        setQuestions(d.questions || [])
        setSubscribed(d.subscribed || false)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleUpvote = async (questionId: string) => {
    if (!userEmail) {
      router.push('/')
      return
    }
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <nav className="flex items-center justify-between px-5 py-5 border-b border-gray-900">
        <Link href="/"><Logo /></Link>
        <p className="text-xs text-gray-600 tracking-widest uppercase">Questions</p>
        <button
          onClick={() => router.push('/')}
          className="text-xs text-white font-semibold hover:opacity-70 transition-opacity"
        >
          Ask →
        </button>
      </nav>

      <main className="flex-1 px-5 py-10 max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="text-gray-700 text-sm">Loading...</div>
        ) : questions.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-600 text-sm mb-4">No questions yet. Be the first.</p>
            <button onClick={() => router.push('/')} className="text-white text-sm underline">Ask Elijah →</button>
          </div>
        ) : (
          <div className="space-y-0">
            {questions.map((q, i) => (
              <div key={q.id} className={`py-8 ${i < questions.length - 1 ? 'border-b border-gray-900' : ''}`}>
                <p className="text-white font-semibold text-base leading-snug mb-4">{q.question}</p>

                <div className="relative">
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {q.answer}{q.truncated ? '...' : ''}
                  </p>

                  {q.truncated && (
                    <div className="mt-3">
                      <button
                        onClick={() => setModalOpen(true)}
                        className="text-xs text-gray-600 hover:text-white transition-colors border border-gray-800 hover:border-gray-600 px-3 py-1.5"
                      >
                        Get the full answer →
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-5">
                  <button
                    onClick={() => handleUpvote(q.id)}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${q.user_upvoted ? 'text-white' : 'text-gray-600 hover:text-gray-300'}`}
                  >
                    <span>{q.user_upvoted ? '▲' : '△'}</span>
                    <span>{q.upvote_count} had this too</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

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
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-gray-600 hover:text-white text-xs"
            >
              ✕
            </button>

            <p className="text-white font-bold text-xl mb-3">Full answers are for subscribers.</p>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              Subscribers get every answer in full, plus priority access to ask Elijah directly.
            </p>

            <div className="flex flex-col gap-3">
              <Link
                href="/pricing"
                className="block bg-white text-black text-sm font-bold text-center py-3 px-6 hover:opacity-80 transition-opacity"
              >
                Subscribe →
              </Link>
              <button
                onClick={() => router.push('/')}
                className="text-xs text-gray-600 hover:text-white transition-colors text-center py-2"
              >
                Ask Elijah your own question →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
