'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { getSession, removeSession } from '@/lib/safe-storage'
import LoadingDots from '@/components/ui/LoadingDots'

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = {
  role: 'user' | 'elijah'
  content: string
  followUp?: string
  created_at?: string
}

type Thread = {
  id: string
  question: string
  answer: string | null
  action_steps: string | null
  solved: boolean
  solved_at: string | null
  created_at: string
  conversation: ChatMessage[] | null
  status: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function daysAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff}d ago`
}

function extractActionSteps(text: string | null): string[] {
  if (!text) return []
  const clean = text.split('|||')[0].trim()
  const lines = clean.split(/\n+/).map(l => l.replace(/^[-*•\d.)\s]+/, '').trim()).filter(l => l.length > 20)
  const actions = lines.filter(l =>
    /^(today|before|next|write|try|do|practice|text|ask|watch|pick|focus|set|tell|start|stop|spend|take|use|find|go|run|repeat|work)\b/i.test(l)
  )
  return (actions.length > 0 ? actions : lines.slice(-2)).slice(0, 3)
}

// ─── Thread card (sidebar) ────────────────────────────────────────────────────

function ThreadCard({
  thread,
  active,
  onClick,
}: {
  thread: Thread
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-[14px] border px-3.5 py-3 transition-all ${
        active
          ? 'border-white/30 bg-white/8'
          : thread.solved
          ? 'border-white/4 bg-white/[0.01] opacity-40 hover:opacity-60'
          : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/15'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`text-[9px] font-black uppercase tracking-[0.16em] ${
          thread.solved ? 'text-emerald-500' : 'text-gray-500'
        }`}>
          {thread.solved ? '✓ Solved' : 'Open'}
        </span>
        <span className="text-[9px] text-gray-700">{daysAgo(thread.created_at)}</span>
      </div>
      <p className="text-xs text-white/80 leading-snug line-clamp-2">{thread.question}</p>
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LockerRoomPage() {
  const router = useRouter()

  // Auth + data
  const [authToken, setAuthToken] = useState('')
  const [threads, setThreads] = useState<Thread[]>([])
  const [profile, setProfile] = useState<{ firstName?: string; position?: string; level?: string; country?: string }>({})
  const [pageLoading, setPageLoading] = useState(true)

  // Active thread
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeThread, setActiveThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const conversationRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  // Interaction
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [solvedPromptShown, setSolvedPromptShown] = useState(false)
  const [togglingSolved, setTogglingSolved] = useState(false)
  const [newInput, setNewInput] = useState('')
  const [creatingNew, setCreatingNew] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const autoSubmittedRef = useRef<Set<string>>(new Set())

  // ── Scroll to bottom ───────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Auth + initial load ────────────────────────────────────────────────────
  useEffect(() => {
    getSupabaseClient().auth.getSession().then(async ({ data: sessionData }) => {
      const token = sessionData.session?.access_token || ''
      if (!token) { router.replace('/sign-up'); return }
      setAuthToken(token)

      const email = sessionData.session?.user?.email || ''
      try {
        const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}`)
        const p = await res.json()
        setProfile({ firstName: p.first_name || p.name || '', position: p.position, level: p.level, country: p.country })
      } catch { /* optional */ }

      const res = await fetch('/api/threads', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      const loaded: Thread[] = data.threads || []
      setThreads(loaded)
      setPageLoading(false)

      // Handle pending question from sign-up flow
      const pending = getSession('pending_question')
      if (pending) {
        removeSession('pending_question')
        await createAndOpenThread(pending, token, loaded, profile)
        return
      }

      // Load most recent unsolved thread, or most recent overall
      const first = loaded.find(t => !t.solved) || loaded[0] || null
      if (first) loadThread(first, token)
    })
  }, [])

  // ── Load a thread into the main panel ─────────────────────────────────────
  const loadThread = useCallback((thread: Thread, token: string) => {
    setActiveId(thread.id)
    setActiveThread(thread)
    setSolvedPromptShown(false)

    const saved: ChatMessage[] = thread.conversation || []
    setMessages(saved)
    conversationRef.current = saved.map(m => ({
      role: m.role === 'elijah' ? 'assistant' : 'user',
      content: m.content,
    }))

    // Auto-submit question if no conversation yet
    if (saved.length === 0 && !autoSubmittedRef.current.has(thread.id)) {
      autoSubmittedRef.current.add(thread.id)
      setTimeout(() => sendMessage(thread.question, token, thread, []), 80)
    } else {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [])

  // ── Create new thread ──────────────────────────────────────────────────────
  const createAndOpenThread = async (
    question: string,
    token = authToken,
    existingThreads = threads,
    currentProfile = profile,
  ) => {
    setCreatingNew(true)
    try {
      const res = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (data.thread) {
        const newThread = data.thread as Thread
        const updated = [newThread, ...existingThreads]
        setThreads(updated)
        loadThread(newThread, token)
      }
    } catch { /* fail */ }
    setCreatingNew(false)
    setNewInput('')
    setSidebarOpen(false)
  }

  const handleNewQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newInput.trim() || creatingNew) return
    await createAndOpenThread(newInput.trim())
  }

  // ── Stream a chat message ─────────────────────────────────────────────────
  const sendMessage = async (
    text: string,
    token = authToken,
    currentThread = activeThread,
    currentHistory = conversationRef.current,
  ) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setInput('')
    setSolvedPromptShown(false)

    const userMsg: ChatMessage = { role: 'user', content: trimmed, created_at: new Date().toISOString() }
    const withUser = [...messages, userMsg]
    setMessages(withUser)

    const newHistory = [...currentHistory, { role: 'user' as const, content: trimmed }]
    conversationRef.current = newHistory

    // Streaming placeholder
    const placeholder: ChatMessage = { role: 'elijah', content: '', created_at: new Date().toISOString() }
    setMessages(prev => [...prev, placeholder])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          conversation: currentHistory,
          profile,
        }),
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        const display = full.includes('|||') ? full.split('|||')[0].trimEnd() : full
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: display }
          return copy
        })
      }

      // Split answer from follow-up
      const delimIdx = full.indexOf('|||')
      const answerText = delimIdx !== -1 ? full.slice(0, delimIdx).trimEnd() : full
      const followUp = delimIdx !== -1 ? full.slice(delimIdx + 3).trim() : undefined

      const elijahMsg: ChatMessage = {
        role: 'elijah', content: answerText, followUp, created_at: new Date().toISOString(),
      }
      const finalMessages = [...withUser, elijahMsg]
      setMessages(finalMessages)
      conversationRef.current = [...newHistory, { role: 'assistant', content: answerText }]

      const steps = extractActionSteps(answerText)

      // Save to DB
      if (currentThread?.id) {
        try {
          await fetch(`/api/threads/${currentThread.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              conversation: finalMessages,
              answer: answerText,
              action_steps: steps.join('\n'),
            }),
          })
        } catch { /* fail silently */ }
      }

      // Update local thread
      const updated = { ...currentThread!, answer: answerText, action_steps: steps.join('\n'), conversation: finalMessages }
      setActiveThread(updated)
      setThreads(prev => prev.map(t => t.id === updated.id ? updated : t))

      // Show "did you solve this?" after first answer
      setTimeout(() => setSolvedPromptShown(true), 600)

    } catch {
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { ...copy[copy.length - 1], content: 'Something went wrong. Try again.' }
        return copy
      })
    }

    setSending(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // ── Toggle solved ─────────────────────────────────────────────────────────
  const toggleSolved = async (val: boolean) => {
    if (!activeThread) return
    setTogglingSolved(true)
    const updated = { ...activeThread, solved: val, solved_at: val ? new Date().toISOString() : null }
    setActiveThread(updated)
    setThreads(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSolvedPromptShown(false)
    try {
      await fetch(`/api/threads/${activeThread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ solved: val }),
      })
    } catch { /* fail silently */ }
    setTogglingSolved(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const actionSteps = extractActionSteps(activeThread?.action_steps || activeThread?.answer || null)
  const hasAnswer = messages.some(m => m.role === 'elijah' && m.content.length > 20)
  const unsolved = threads.filter(t => !t.solved)
  const solved = threads.filter(t => t.solved)

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingDots label="" className="text-white" />
      </div>
    )
  }

  // ── Sidebar content ────────────────────────────────────────────────────────
  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <form onSubmit={handleNewQuestion}>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-[12px] px-3 py-2 focus-within:border-white/20 transition-colors">
            <input
              type="text"
              value={newInput}
              onChange={e => setNewInput(e.target.value)}
              placeholder="New question..."
              className="flex-1 bg-transparent text-white placeholder-gray-600 text-xs outline-none min-w-0"
              disabled={creatingNew}
            />
            <button
              type="submit"
              disabled={!newInput.trim() || creatingNew}
              className="shrink-0 w-6 h-6 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-20 hover:opacity-80 transition-opacity"
            >
              {creatingNew
                ? <span className="w-2 h-2 border border-black/40 border-t-black rounded-full animate-spin" />
                : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              }
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {threads.length === 0 && (
          <p className="text-xs text-gray-700 text-center mt-8">No questions yet.</p>
        )}

        {unsolved.length > 0 && (
          <div className="mb-4">
            <p className="text-[9px] text-gray-700 uppercase tracking-[0.18em] font-black mb-2 px-0.5">Open · {unsolved.length}</p>
            <div className="flex flex-col gap-1.5">
              {unsolved.map(t => (
                <ThreadCard key={t.id} thread={t} active={t.id === activeId} onClick={() => { loadThread(t, authToken); setSidebarOpen(false) }} />
              ))}
            </div>
          </div>
        )}

        {solved.length > 0 && (
          <div>
            <p className="text-[9px] text-gray-700 uppercase tracking-[0.18em] font-black mb-2 px-0.5">Solved · {solved.length}</p>
            <div className="flex flex-col gap-1.5">
              {solved.map(t => (
                <ThreadCard key={t.id} thread={t} active={t.id === activeId} onClick={() => { loadThread(t, authToken); setSidebarOpen(false) }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ── Main panel ─────────────────────────────────────────────────────────────
  const MainPanel = () => {
    if (!activeThread) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold mb-3">Your locker room</p>
          <p className="text-2xl font-bold text-white mb-2">
            {profile.firstName ? `Hey ${profile.firstName}.` : 'Ask Elijah something.'}
          </p>
          <p className="text-sm text-gray-500 mb-8">Type your question in the box below.</p>
          <form onSubmit={handleNewQuestion} className="w-full max-w-md">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-[16px] px-4 py-3 focus-within:border-white/20 transition-colors">
              <input
                type="text"
                value={newInput}
                onChange={e => setNewInput(e.target.value)}
                placeholder="What's on your mind?"
                className="flex-1 bg-transparent text-white placeholder-gray-600 text-sm outline-none"
                disabled={creatingNew}
                autoFocus
              />
              <button type="submit" disabled={!newInput.trim() || creatingNew}
                className="shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-20 hover:opacity-80 transition-opacity">
                {creatingNew
                  ? <span className="w-3 h-3 border border-black/40 border-t-black rounded-full animate-spin" />
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                }
              </button>
            </div>
          </form>
        </div>
      )
    }

    return (
      <div className="flex-1 flex flex-col min-h-0">
        {/* Thread header */}
        <div className="px-5 pt-4 pb-3 border-b border-white/5 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] text-gray-600 uppercase tracking-[0.18em] font-black mb-1">
                {activeThread.solved ? '✓ Solved' : 'Active question'}
              </p>
              <p className="text-sm font-semibold text-white leading-snug">&ldquo;{activeThread.question}&rdquo;</p>
            </div>
            {activeThread.solved && (
              <button
                onClick={() => toggleSolved(false)}
                className="shrink-0 text-[10px] text-gray-600 hover:text-white border border-white/8 rounded-full px-2.5 py-1 transition-colors"
              >
                Reopen
              </button>
            )}
          </div>
        </div>

        {/* Messages + action steps — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col lg:flex-row h-full">

            {/* Chat messages */}
            <div className="flex-1 px-5 py-4 flex flex-col gap-5 lg:overflow-y-auto">
              {messages.map((msg, i) => {
                const m = msg as ChatMessage & { followUp?: string }
                return (
                  <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.role === 'elijah' && (
                      <p className="text-[9px] text-gray-600 uppercase tracking-[0.16em] font-black mb-1.5">Elijah</p>
                    )}
                    <div className={msg.role === 'user'
                      ? 'max-w-[85%] bg-white/7 border border-white/8 rounded-[14px] rounded-tr-[4px] px-3.5 py-2.5 text-sm text-gray-300'
                      : 'text-white text-sm leading-[1.85] max-w-[95%]'
                    }>
                      {msg.role === 'elijah'
                        ? msg.content
                          ? <p className="whitespace-pre-wrap">{msg.content}</p>
                          : <div className="py-1"><LoadingDots label="" size={4} className="text-gray-500" /></div>
                        : <p>{msg.content}</p>
                      }
                    </div>

                    {/* Follow-up tap prompt */}
                    {msg.role === 'elijah' && m.followUp && i === messages.length - 1 && !solvedPromptShown && (
                      <button
                        onClick={() => { setInput(m.followUp || ''); setTimeout(() => inputRef.current?.focus(), 50) }}
                        className="mt-3 group flex items-center gap-2 border border-white/10 hover:border-white/20 rounded-full px-3.5 py-2 transition-colors"
                      >
                        <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">{m.followUp}</span>
                        <span className="text-gray-700 group-hover:text-gray-500 text-xs">→</span>
                      </button>
                    )}
                  </div>
                )
              })}

              {/* "Did you solve this?" prompt */}
              {solvedPromptShown && hasAnswer && !activeThread.solved && !sending && (
                <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-[0.18em] font-black mb-2">Elijah asks</p>
                  <p className="text-sm text-white font-semibold mb-4">Did this solve your problem?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleSolved(true)}
                      disabled={togglingSolved}
                      className="flex-1 rounded-full bg-emerald-500 text-black text-xs font-black py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {togglingSolved ? '...' : 'Yes, solved it ✓'}
                    </button>
                    <button
                      onClick={() => { setSolvedPromptShown(false); setTimeout(() => inputRef.current?.focus(), 100) }}
                      className="flex-1 rounded-full border border-white/10 text-gray-400 text-xs font-black py-2.5 hover:border-white/20 hover:text-white transition-colors"
                    >
                      Not yet
                    </button>
                  </div>
                </div>
              )}

              {/* Solved celebration */}
              {activeThread.solved && (
                <div className="rounded-[16px] border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                  <p className="text-[10px] text-emerald-400 uppercase tracking-[0.18em] font-black mb-1.5">✓ Closed</p>
                  <p className="text-sm text-white font-semibold mb-3">You solved this one.</p>
                  <button
                    onClick={() => { setNewInput(''); setSidebarOpen(false); setActiveThread(null); setActiveId(null) }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Ask something new →
                  </button>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Action steps — right panel on desktop */}
            {hasAnswer && actionSteps.length > 0 && (
              <div className="lg:w-64 xl:w-72 shrink-0 px-4 lg:px-5 pb-4 lg:py-4 border-t border-white/5 lg:border-t-0 lg:border-l lg:border-white/5">
                <div className="rounded-[14px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[9px] text-gray-500 uppercase tracking-[0.18em] font-black mb-3">Your rep</p>
                  <div className="flex flex-col gap-2.5">
                    {actionSteps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-emerald-400 mt-2 shrink-0" />
                        <p className="text-xs text-gray-200 leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-700 mt-3 leading-relaxed">
                    Try this before your next session.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input — only when not solved */}
        {!activeThread.solved && (
          <div className="shrink-0 px-4 pb-4 pt-2 border-t border-white/5">
            <div className="flex items-end gap-2.5 bg-white/5 border border-white/8 rounded-[14px] px-3.5 py-2.5 focus-within:border-white/15 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up..."
                rows={1}
                className="flex-1 bg-transparent text-white placeholder-gray-600 text-sm resize-none outline-none leading-relaxed max-h-24 overflow-y-auto"
                style={{ minHeight: '20px' }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 96) + 'px'
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || sending}
                className="shrink-0 w-7 h-7 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-20 hover:opacity-80 transition-opacity"
              >
                {sending
                  ? <span className="w-2.5 h-2.5 border border-black/40 border-t-black rounded-full animate-spin" />
                  : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Page layout ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-5 py-3.5 shrink-0 border-b border-white/5">
        <Logo />
        <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold hidden sm:block">
          {profile.firstName ? `${profile.firstName}'s Locker Room` : 'Locker Room'}
        </p>
        {/* Mobile: sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="lg:hidden flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
        >
          {sidebarOpen ? '✕ Close' : `Questions (${threads.length})`}
        </button>
        {/* Desktop: profile link */}
        <a href="/profile" className="hidden lg:block text-xs text-gray-600 hover:text-white transition-colors">Profile →</a>
      </nav>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sidebar — always visible desktop, slide-in mobile */}
        <div className={`
          lg:w-64 xl:w-72 shrink-0 border-r border-white/5 flex flex-col
          ${sidebarOpen
            ? 'fixed inset-0 z-50 bg-black w-full sm:w-80 sm:right-auto'
            : 'hidden lg:flex'
          }
        `}>
          {/* Mobile close */}
          {sidebarOpen && (
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 lg:hidden">
              <Logo />
              <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-white text-sm transition-colors">✕</button>
            </div>
          )}
          <Sidebar />
        </div>

        {/* Main panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <MainPanel />
        </div>

      </div>
    </div>
  )
}
