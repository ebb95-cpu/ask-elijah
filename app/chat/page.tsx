'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase-client'
import { getSession, removeSession, getLocal } from '@/lib/safe-storage'
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

type Message = {
  id: string
  role: 'user' | 'elijah'
  content: string
  followUp?: string
  streaming?: boolean
}

type Profile = {
  firstName?: string
  position?: string
  level?: string
  country?: string
}

function ChatInner() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<Profile>({})
  const [authReady, setAuthReady] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const conversationRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  // Auth guard + load profile
  useEffect(() => {
    getSupabaseClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace('/sign-up')
        return
      }
      const userEmail = data.user.email || ''
      setEmail(userEmail)

      // Load profile for context
      try {
        const res = await fetch(`/api/profile?email=${encodeURIComponent(userEmail)}`)
        const p = await res.json()
        setProfile({
          firstName: p.first_name || p.name || '',
          position: p.position || '',
          level: p.level || '',
          country: p.country || '',
        })
      } catch { /* profile optional */ }

      setAuthReady(true)
    })
  }, [router])

  // Auto-submit pending question from homepage
  useEffect(() => {
    if (!authReady) return
    const pending = getSession('pending_question')
    if (pending) {
      removeSession('pending_question')
      sendMessage(pending)
    } else {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [authReady])

  // Scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Add user message to conversation history
    conversationRef.current = [
      ...conversationRef.current,
      { role: 'user', content: trimmed },
    ]

    // Placeholder for Elijah's streaming response
    const elijahId = crypto.randomUUID()
    setMessages(prev => [...prev, {
      id: elijahId,
      role: 'elijah',
      content: '',
      streaming: true,
    }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          conversation: conversationRef.current.slice(0, -1), // history before this message
          email,
          profile,
        }),
      })

      if (!res.ok || !res.body) {
        setMessages(prev => prev.map(m =>
          m.id === elijahId
            ? { ...m, content: "Something went wrong. Try again.", streaming: false }
            : m
        ))
        setLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setMessages(prev => prev.map(m =>
          m.id === elijahId ? { ...m, content: full } : m
        ))
      }

      // Split answer and follow-up question on the ||| delimiter
      const delimIdx = full.indexOf('|||')
      let answerText = full
      let followUp: string | undefined

      if (delimIdx !== -1) {
        answerText = full.slice(0, delimIdx).trimEnd()
        followUp = full.slice(delimIdx + 3).trim()
      }

      // Save Elijah's answer to conversation history (without follow-up)
      conversationRef.current = [
        ...conversationRef.current,
        { role: 'assistant', content: answerText },
      ]

      setMessages(prev => prev.map(m =>
        m.id === elijahId
          ? { ...m, content: answerText, followUp, streaming: false }
          : m
      ))
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === elijahId
          ? { ...m, content: "Something went wrong. Try again.", streaming: false }
          : m
      ))
    }

    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  if (!authReady) {
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
        <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold">Ask Elijah</p>
        <Link href="/track" className="text-xs text-gray-500 hover:text-white transition-colors">
          Locker room →
        </Link>
      </nav>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold mb-4">Elijah is here</p>
              <p className="text-2xl font-bold text-white mb-2">Ask the thing on your mind.</p>
              <p className="text-sm text-gray-500">Be specific. The more real the situation, the better the answer.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.role === 'elijah' && (
                <p className="text-[10px] text-gray-600 uppercase tracking-[0.18em] font-black mb-2 ml-1">Elijah</p>
              )}

              <div className={`max-w-[88%] ${msg.role === 'user'
                ? 'bg-white/8 border border-white/10 rounded-[20px] rounded-tr-[6px] px-4 py-3 text-sm text-gray-300'
                : 'text-white text-base leading-relaxed'
              }`}>
                {msg.role === 'elijah' ? (
                  <div>
                    {msg.content ? (
                      <p className="whitespace-pre-wrap leading-[1.75]">{msg.content}</p>
                    ) : (
                      <div className="py-1"><LoadingDots label="" size={5} className="text-gray-400" /></div>
                    )}
                    {msg.streaming && msg.content && (
                      <span className="inline-block w-0.5 h-4 bg-white/40 ml-0.5 animate-pulse" />
                    )}
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>

              {/* Elijah's follow-up question — shown after streaming completes */}
              {msg.role === 'elijah' && !msg.streaming && msg.followUp && (
                <button
                  onClick={() => {
                    setInput(msg.followUp || '')
                    setTimeout(() => inputRef.current?.focus(), 50)
                  }}
                  className="mt-4 ml-1 text-left group"
                >
                  <p className="text-[10px] text-gray-600 uppercase tracking-[0.18em] font-black mb-1.5">Elijah asks</p>
                  <div className="inline-flex items-center gap-2 border border-white/10 hover:border-white/25 rounded-full px-4 py-2.5 transition-colors">
                    <p className="text-sm text-gray-300 group-hover:text-white transition-colors">{msg.followUp}</p>
                    <span className="text-gray-600 group-hover:text-gray-400 transition-colors text-xs">→</span>
                  </div>
                </button>
              )}
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 md:px-6 pb-6 pt-3 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-3 bg-white/5 border border-white/10 rounded-[20px] px-4 py-3 focus-within:border-white/20 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Elijah something..."
              rows={1}
              className="flex-1 bg-transparent text-white placeholder-gray-600 text-sm resize-none outline-none leading-relaxed max-h-40 overflow-y-auto"
              style={{ minHeight: '24px' }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 160) + 'px'
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-25 transition-opacity hover:opacity-80"
            >
              {loading ? (
                <span className="w-3 h-3 border border-black/40 border-t-black rounded-full animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-700 mt-2">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ChatInner />
    </Suspense>
  )
}
