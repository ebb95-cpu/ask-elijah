'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase-client'
import { getSession, removeSession } from '@/lib/safe-storage'
import LoadingDots from '@/components/ui/LoadingDots'

function Logo() {
  return (
    <svg width="36" height="6" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill="#fff" />
      <line x1="8" y1="4" x2="20" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill="#fff" />
      <line x1="28" y1="4" x2="40" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill="#fff" />
    </svg>
  )
}

type Thread = {
  id: string
  question: string
  answer: string | null
  action_steps: string | null
  solved: boolean
  solved_at: string | null
  created_at: string
  conversation: { role: string; content: string }[] | null
  status: string | null
}

function daysAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff}d ago`
}

function extractActionStep(thread: Thread): string | null {
  const raw = thread.action_steps || thread.answer || ''
  if (!raw) return null
  const lines = raw.split(/\n+/).map(l => l.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean)
  const action = lines.find(l =>
    /^(today|before|next|write|try|do|practice|text|ask|watch|pick|focus|set|tell|start|stop|spend|take|use|find)\b/i.test(l)
  )
  const result = action || lines[lines.length - 1] || null
  if (!result) return null
  return result.length > 160 ? result.slice(0, 160).trim() + '…' : result
}

function ThreadCard({ thread, onOpen }: { thread: Thread; onOpen: (t: Thread) => void }) {
  const step = extractActionStep(thread)
  const msgs = thread.conversation?.length || 0
  const hasAnswer = !!(thread.answer || msgs > 1)

  return (
    <button
      onClick={() => onOpen(thread)}
      className={`w-full text-left rounded-[20px] border p-5 transition-all hover:border-white/20 active:scale-[0.99] ${
        thread.solved
          ? 'border-white/5 bg-white/[0.02] opacity-50'
          : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {thread.solved ? (
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500">✓ Solved</span>
          ) : hasAnswer ? (
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">Open</span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">Waiting</span>
          )}
          {msgs > 2 && (
            <span className="text-[10px] text-gray-600">{Math.floor(msgs / 2)} exchanges</span>
          )}
        </div>
        <span className="text-[10px] text-gray-600 shrink-0">{daysAgo(thread.created_at)}</span>
      </div>

      <p className="text-sm font-semibold text-white leading-snug mb-3 line-clamp-2">
        &ldquo;{thread.question}&rdquo;
      </p>

      {step && !thread.solved && (
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.07] px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-400 mb-1">Your rep</p>
          <p className="text-xs text-emerald-200/70 leading-relaxed line-clamp-2">{step}</p>
        </div>
      )}

      {!hasAnswer && !thread.solved && (
        <p className="text-xs text-gray-600">Tap to start the conversation →</p>
      )}
    </button>
  )
}

export default function LockerRoomPage() {
  const router = useRouter()
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [authToken, setAuthToken] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const [creating, setCreating] = useState(false)
  const [firstName, setFirstName] = useState('')

  const fetchThreads = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/threads', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setThreads(data.threads || [])
    } catch { /* fail silently */ }
  }, [])

  useEffect(() => {
    getSupabaseClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace('/sign-up')
        return
      }

      // Get session token for API calls
      const { data: sessionData } = await getSupabaseClient().auth.getSession()
      const token = sessionData.session?.access_token || ''
      setAuthToken(token)

      // Load first name
      try {
        const res = await fetch(`/api/profile?email=${encodeURIComponent(data.user.email || '')}`)
        const p = await res.json()
        setFirstName(p.first_name || p.name || '')
      } catch { /* optional */ }

      await fetchThreads(token)
      setLoading(false)

      // Handle pending question from homepage
      const pending = getSession('pending_question')
      if (pending) {
        removeSession('pending_question')
        createThread(pending, token)
      }
    })
  }, [])

  const createThread = async (question: string, token: string) => {
    setCreating(true)
    try {
      const res = await fetch('/api/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (data.thread?.id) {
        router.push(`/track/${data.thread.id}`)
      }
    } catch { /* fail */ }
    setCreating(false)
  }

  const handleNewQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.trim() || creating) return
    const q = newQuestion.trim()
    setNewQuestion('')
    await createThread(q, authToken)
  }

  const openThread = (thread: Thread) => {
    router.push(`/track/${thread.id}`)
  }

  const unsolved = threads.filter(t => !t.solved)
  const solved = threads.filter(t => t.solved)

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingDots label="" className="text-white" />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-white/5">
        <Logo />
        <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold">Locker Room</p>
        <Link href="/profile" className="text-xs text-gray-500 hover:text-white transition-colors">
          Profile →
        </Link>
      </nav>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold mb-2">Your locker room</p>
            <h1 className="text-3xl font-bold tracking-tight">
              {firstName ? `${firstName}.` : 'Your questions.'}
            </h1>
            {threads.length > 0 && (
              <div className="flex items-center gap-6 mt-4">
                <div>
                  <p className="text-xl font-bold">{threads.length}</p>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-1">Asked</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{solved.length}</p>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-1">Solved</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{unsolved.length}</p>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-1">Open</p>
                </div>
              </div>
            )}
          </div>

          {/* New question input */}
          <form onSubmit={handleNewQuestion} className="mb-8">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-[16px] px-4 py-3 focus-within:border-white/20 transition-colors">
              <input
                type="text"
                value={newQuestion}
                onChange={e => setNewQuestion(e.target.value)}
                placeholder="Ask Elijah something new..."
                className="flex-1 bg-transparent text-white placeholder-gray-600 text-sm outline-none"
                disabled={creating}
              />
              <button
                type="submit"
                disabled={!newQuestion.trim() || creating}
                className="shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-25 transition-opacity hover:opacity-80"
              >
                {creating ? (
                  <span className="w-3 h-3 border border-black/40 border-t-black rounded-full animate-spin" />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                )}
              </button>
            </div>
          </form>

          {/* Empty state */}
          {threads.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-600 text-sm mb-2">No questions yet.</p>
              <p className="text-gray-700 text-xs">Ask the thing on your mind above.</p>
            </div>
          )}

          {/* Unsolved threads */}
          {unsolved.length > 0 && (
            <div className="mb-8">
              <p className="text-[10px] text-gray-600 uppercase tracking-[0.18em] font-black mb-3">
                Open · {unsolved.length}
              </p>
              <div className="flex flex-col gap-3">
                {unsolved.map(t => (
                  <ThreadCard key={t.id} thread={t} onOpen={openThread} />
                ))}
              </div>
            </div>
          )}

          {/* Solved threads */}
          {solved.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-[0.18em] font-black mb-3">
                Solved · {solved.length}
              </p>
              <div className="flex flex-col gap-3">
                {solved.map(t => (
                  <ThreadCard key={t.id} thread={t} onOpen={openThread} />
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
