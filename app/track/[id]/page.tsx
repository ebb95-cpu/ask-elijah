'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase-client'
import LoadingDots from '@/components/ui/LoadingDots'

type ChatMessage = {
  role: 'user' | 'elijah'
  content: string
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

function extractActionSteps(text: string | null): string[] {
  if (!text) return []
  // Remove the follow-up delimiter if present
  const clean = text.split('|||')[0].trim()
  const lines = clean.split(/\n+/).map(l => l.replace(/^[-*•\d.)\s]+/, '').trim()).filter(l => l.length > 20)
  // Find action-oriented lines
  const actions = lines.filter(l =>
    /^(today|before|next|write|try|do|practice|text|ask|watch|pick|focus|set|tell|start|stop|spend|take|use|find)\b/i.test(l)
  )
  if (actions.length > 0) return actions.slice(0, 3)
  // Fallback: last 1-2 lines
  return lines.slice(-2)
}

function Logo() {
  return (
    <svg width="28" height="4" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill="#fff" />
      <line x1="8" y1="4" x2="20" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill="#fff" />
      <line x1="28" y1="4" x2="40" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill="#fff" />
    </svg>
  )
}

export default function ThreadPage() {
  const params = useParams()
  const router = useRouter()
  const threadId = params?.id as string

  const [thread, setThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [authToken, setAuthToken] = useState('')
  const [profile, setProfile] = useState<{ firstName?: string; position?: string; level?: string }>({})
  const [togglingsolved, setTogglingsolved] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const conversationRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  // Auth + load thread
  useEffect(() => {
    getSupabaseClient().auth.getSession().then(async ({ data: sessionData }) => {
      const token = sessionData.session?.access_token || ''
      if (!token) { router.replace('/sign-up'); return }
      setAuthToken(token)

      const email = sessionData.session?.user?.email || ''

      // Load profile
      try {
        const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}`)
        const p = await res.json()
        setProfile({ firstName: p.first_name || p.name || '', position: p.position, level: p.level })
      } catch { /* optional */ }

      // Load thread
      const res = await fetch(`/api/threads/${threadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { router.replace('/track'); return }
      const { thread: t } = await res.json()
      setThread(t)

      // Restore conversation history
      const savedConvo: ChatMessage[] = t.conversation || []
      setMessages(savedConvo)

      // Build Claude conversation history for context
      conversationRef.current = savedConvo.map(m => ({
        role: m.role === 'elijah' ? 'assistant' : 'user',
        content: m.content,
      }))

      setLoading(false)

      // If no conversation yet, auto-submit the question
      if (savedConvo.length === 0) {
        setTimeout(() => sendMessage(t.question, token, t, []), 100)
      } else {
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    })
  }, [threadId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const saveToThread = async (
    token: string,
    updatedMessages: ChatMessage[],
    answerText: string,
    actionSteps: string[],
  ) => {
    try {
      await fetch(`/api/threads/${threadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation: updatedMessages,
          answer: answerText,
          action_steps: actionSteps.join('\n'),
        }),
      })
    } catch { /* fail silently */ }
  }

  const sendMessage = async (
    text: string,
    token = authToken,
    currentThread = thread,
    currentHistory = conversationRef.current,
  ) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)

    const userMsg: ChatMessage = { role: 'user', content: trimmed, created_at: new Date().toISOString() }
    const updatedWithUser = [...messages, userMsg]
    setMessages(updatedWithUser)
    setInput('')

    // Update conversation history
    const newHistory = [...currentHistory, { role: 'user' as const, content: trimmed }]
    conversationRef.current = newHistory

    // Add streaming placeholder
    const elijahMsg: ChatMessage = { role: 'elijah', content: '', created_at: new Date().toISOString() }
    setMessages(prev => [...prev, elijahMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          conversation: currentHistory.slice(0, -1), // history before this message
          email: getSupabaseClient().auth.getUser().then(d => d.data.user?.email),
          profile,
        }),
      })

      if (!res.ok || !res.body) {
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'elijah', content: 'Something went wrong. Try again.' }
          return copy
        })
        setSending(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        const displayText = full.includes('|||') ? full.split('|||')[0].trimEnd() : full
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: displayText }
          return copy
        })
      }

      // Split answer and follow-up
      let answerText = full
      let followUp: string | undefined
      const delimIdx = full.indexOf('|||')
      if (delimIdx !== -1) {
        answerText = full.slice(0, delimIdx).trimEnd()
        followUp = full.slice(delimIdx + 3).trim()
      }

      const finalElijahMsg: ChatMessage & { followUp?: string } = {
        role: 'elijah',
        content: answerText,
        followUp,
        created_at: new Date().toISOString(),
      }

      const finalMessages = [...updatedWithUser, finalElijahMsg]
      setMessages(finalMessages)

      // Update Claude history
      conversationRef.current = [...newHistory, { role: 'assistant', content: answerText }]

      // Extract action steps from first answer
      const actionSteps = extractActionSteps(answerText)

      // Save to DB
      await saveToThread(token, finalMessages, answerText, actionSteps)

      // Update local thread state
      setThread(prev => prev ? {
        ...prev,
        answer: answerText,
        action_steps: actionSteps.join('\n'),
        conversation: finalMessages,
      } : prev)

    } catch {
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'elijah', content: 'Something went wrong. Try again.' }
        return copy
      })
    }

    setSending(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const toggleSolved = async () => {
    if (!thread) return
    setTogglingsolved(true)
    const newSolved = !thread.solved
    setThread(prev => prev ? { ...prev, solved: newSolved } : prev)
    try {
      await fetch(`/api/threads/${threadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ solved: newSolved }),
      })
    } catch { /* fail silently */ }
    setTogglingsolved(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingDots label="" className="text-white" />
      </div>
    )
  }

  const actionSteps = extractActionSteps(thread?.action_steps || thread?.answer || null)
  const hasAnswer = messages.some(m => m.role === 'elijah' && m.content.length > 10)

  return (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-5 py-3.5 shrink-0 border-b border-white/5">
        <Link href="/track" className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1.5">
          ← Locker room
        </Link>
        <Logo />
        <button
          onClick={toggleSolved}
          disabled={togglingsolved}
          className={`flex items-center gap-1.5 text-xs font-bold transition-colors rounded-full px-3 py-1.5 border ${
            thread?.solved
              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
              : 'border-white/10 text-gray-500 hover:text-white hover:border-white/20'
          }`}
        >
          {thread?.solved ? '✓ Solved' : 'Mark solved'}
        </button>
      </nav>

      {/* Split view */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* LEFT — Chat */}
        <div className="flex-1 flex flex-col min-h-0 lg:border-r lg:border-white/5">
          {/* Question header */}
          <div className="px-4 md:px-5 pt-4 pb-3 border-b border-white/5 shrink-0">
            <p className="text-[10px] text-gray-600 uppercase tracking-[0.18em] font-black mb-1">Your question</p>
            <p className="text-sm font-semibold text-white leading-snug line-clamp-2">&ldquo;{thread?.question}&rdquo;</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4">
            <div className="flex flex-col gap-5 max-w-xl">
              {messages.map((msg, i) => {
                const m = msg as ChatMessage & { followUp?: string }
                return (
                  <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.role === 'elijah' && (
                      <p className="text-[10px] text-gray-600 uppercase tracking-[0.16em] font-black mb-1.5 ml-0.5">Elijah</p>
                    )}
                    <div className={msg.role === 'user'
                      ? 'max-w-[85%] bg-white/7 border border-white/8 rounded-[16px] rounded-tr-[5px] px-3.5 py-2.5 text-sm text-gray-300'
                      : 'text-white text-sm leading-[1.8] max-w-[95%]'
                    }>
                      {msg.role === 'elijah' ? (
                        msg.content
                          ? <p className="whitespace-pre-wrap">{msg.content}</p>
                          : <div className="py-1"><LoadingDots label="" size={4} className="text-gray-500" /></div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>

                    {/* Follow-up prompt */}
                    {msg.role === 'elijah' && m.followUp && i === messages.length - 1 && (
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
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          <div className="shrink-0 px-4 md:px-5 pb-4 pt-2 border-t border-white/5">
            <div className="flex items-end gap-2.5 bg-white/5 border border-white/8 rounded-[16px] px-3.5 py-2.5 focus-within:border-white/15 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up..."
                rows={1}
                className="flex-1 bg-transparent text-white placeholder-gray-600 text-sm resize-none outline-none leading-relaxed max-h-28 overflow-y-auto"
                style={{ minHeight: '20px' }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 112) + 'px'
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || sending}
                className="shrink-0 w-7 h-7 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-20 hover:opacity-80 transition-opacity"
              >
                {sending
                  ? <span className="w-2.5 h-2.5 border border-black/40 border-t-black rounded-full animate-spin" />
                  : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
                }
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — Action steps */}
        <div className="lg:w-72 xl:w-80 shrink-0 px-4 md:px-5 py-4 border-t border-white/5 lg:border-t-0 lg:overflow-y-auto">
          <div className="max-w-sm lg:max-w-none mx-auto">

            {/* Solved state */}
            {thread?.solved && (
              <div className="rounded-[16px] border border-emerald-500/20 bg-emerald-500/[0.07] p-4 mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400 mb-1.5">✓ This one is done</p>
                <p className="text-xs text-emerald-200/60 leading-relaxed">
                  You closed this loop.{thread.solved_at ? ` ${new Date(thread.solved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                </p>
              </div>
            )}

            {/* Action steps */}
            {hasAnswer && actionSteps.length > 0 && (
              <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4 mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 mb-3">Your rep</p>
                <div className="flex flex-col gap-2.5">
                  {actionSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-1 h-1 rounded-full bg-emerald-400 mt-2 shrink-0" />
                      <p className="text-sm text-gray-200 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-600 mt-4 leading-relaxed">
                  Try this before your next session. Come back and tell Elijah what happened.
                </p>
              </div>
            )}

            {!hasAnswer && (
              <div className="rounded-[16px] border border-white/5 p-4">
                <p className="text-xs text-gray-600 leading-relaxed">Action steps will appear here after Elijah answers.</p>
              </div>
            )}

            {/* Solve button — desktop */}
            {!thread?.solved && hasAnswer && (
              <button
                onClick={toggleSolved}
                disabled={togglingsolved}
                className="hidden lg:flex w-full items-center justify-center gap-2 border border-white/10 hover:border-emerald-500/30 hover:text-emerald-400 text-gray-500 text-xs font-bold rounded-[14px] py-3 transition-colors mt-2"
              >
                {togglingsolved ? <LoadingDots label="" size={4} className="text-gray-500" /> : '✓ Mark as solved'}
              </button>
            )}

            {/* Date */}
            <p className="text-[10px] text-gray-700 mt-4 text-center lg:text-left">
              Asked {new Date(thread?.created_at || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
