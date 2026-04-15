'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'

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

// Topics come from the app/api/ask/route.ts TOPICS list.
const FILTERS = ['All', 'confidence', 'pressure', 'consistency', 'focus', 'slump', 'coaching', 'team', 'mindset', 'motivation', 'identity']

type Source = { title: string; url: string; type: string }

type Answer = {
  id: string
  question: string
  answer: string
  topic: string | null
  status: string
  created_at: string
  sources?: Source[]
}

export default function LibraryPage() {
  const [answers, setAnswers] = useState<Answer[]>([])
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/sign-in')
        return
      }
      setAuthed(true)

      try {
        const res = await fetch('/api/history')
        if (res.ok) {
          const data = await res.json()
          setAnswers(data.questions || [])
        }
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  // Only show approved answers in the library — pending drafts live in /history
  const approved = answers.filter(a => a.status === 'approved')

  const filtered = approved.filter(a => {
    const matchFilter = filter === 'All' || a.topic === filter
    const matchSearch = !search ||
      a.question.toLowerCase().includes(search.toLowerCase()) ||
      a.answer.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const formatDate = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (!authed) {
    return <div className="min-h-screen bg-white" />
  }

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <Link href="/home"><Logo /></Link>
        <Link href="/ask" className="text-sm font-semibold bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity">
          Ask now
        </Link>
      </nav>

      <main className="flex-1 px-6 py-12 max-w-3xl mx-auto w-full pb-24">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">Your playbook.</h1>
        <p className="text-sm text-gray-500 mb-8">Every answer Elijah has approved for you.</p>

        {/* Search */}
        <input
          type="text"
          placeholder="Search your answers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black transition-colors mb-6"
        />

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-sm px-3 py-1.5 transition-colors capitalize ${
                filter === f
                  ? 'bg-black text-white'
                  : 'border border-gray-200 text-gray-500 hover:border-black hover:text-black'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="border border-gray-100 p-6 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl font-bold tracking-tight mb-2">
              {approved.length === 0 ? 'Your playbook starts here.' : 'No matches.'}
            </p>
            <p className="text-gray-400 text-sm mb-8">
              {approved.length === 0
                ? 'Ask your first question to get started.'
                : 'Try a different filter or search.'}
            </p>
            {approved.length === 0 && (
              <button
                onClick={() => router.push('/ask')}
                className="bg-black text-white px-6 py-3 text-sm font-semibold hover:opacity-80 transition-opacity"
              >
                Ask now →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(a => (
              <div
                key={a.id}
                className="border border-gray-100 p-6 cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="font-bold text-sm tracking-tight flex-1">{a.question}</p>
                  <span className="text-xs text-gray-400 whitespace-nowrap mt-0.5">{formatDate(a.created_at)}</span>
                </div>
                {a.topic && (
                  <span className="inline-block text-[10px] uppercase tracking-wider text-gray-400 mt-2">
                    {a.topic}
                  </span>
                )}
                {expanded !== a.id && (
                  <p className="text-gray-400 text-sm mt-2 line-clamp-2">{a.answer}</p>
                )}
                {expanded === a.id && (
                  <>
                    <p className="text-black text-sm mt-4 leading-relaxed whitespace-pre-wrap">{a.answer}</p>
                    {a.sources && a.sources.length > 0 && (
                      <div className="mt-5 pt-4 border-t border-gray-100">
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">This answer drew from</p>
                        <div className="flex flex-col gap-1">
                          {a.sources.slice(0, 3).map((s, i) => (
                            <a
                              key={i}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-gray-500 hover:text-black transition-colors underline underline-offset-2"
                            >
                              {s.type === 'newsletter' ? '✉' : '▶'}&nbsp;&nbsp;{s.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

    </div>
  )
}
