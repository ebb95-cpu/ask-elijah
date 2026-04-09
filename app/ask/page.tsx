'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function Logo({ dark = false }: { dark?: boolean }) {
  const c = dark ? '#fff' : '#000'
  return (
    <svg width="52" height="8" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill={c} />
      <line x1="8" y1="4" x2="20" y2="4" stroke={c} strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill={c} />
      <line x1="28" y1="4" x2="40" y2="4" stroke={c} strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill={c} />
    </svg>
  )
}

function AnimatedLogo() {
  return (
    <svg width="52" height="8" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill="#fff" className="dot-1" />
      <line x1="8" y1="4" x2="20" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill="#fff" className="dot-2" />
      <line x1="28" y1="4" x2="40" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill="#fff" className="dot-3" />
    </svg>
  )
}

const SUGGESTIONS = [
  "Night before a big game",
  "When I lose confidence mid-game",
  "Recovery after back-to-backs",
]

type Mode = 'input' | 'loading' | 'answer'

export default function AskPage() {
  const [mode, setMode] = useState<Mode>('input')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [showSaveBar, setShowSaveBar] = useState(false)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  // Pick up question from homepage
  useEffect(() => {
    const pending = sessionStorage.getItem('pending_question')
    if (pending) {
      sessionStorage.removeItem('pending_question')
      setQuestion(pending)
      setShowSuggestions(false)
      // Auto-submit
      setTimeout(() => submitQuestion(pending), 100)
    } else {
      textareaRef.current?.focus()
    }
  }, [])

  const submitQuestion = async (q: string) => {
    if (!q.trim()) return
    setMode('loading')
    setAnswer('')

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })

      if (!res.ok) throw new Error('Failed')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No stream')

      setMode('answer')
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setAnswer(full)
      }

      // Show save bar after 4s
      setTimeout(() => setShowSaveBar(true), 4000)
    } catch {
      setMode('input')
    }
  }

  const handleSubmit = () => {
    if (!question.trim()) return
    setShowSuggestions(false)
    submitQuestion(question)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const handleFollowUp = () => {
    setMode('input')
    setAnswer('')
    setShowSaveBar(false)
    setSaved(false)
    setQuestion('')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  // Input mode
  if (mode === 'input') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <nav className="flex items-center justify-between px-6 py-5">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors text-sm">
            ← Back
          </button>
          <Logo dark />
          <div className="w-12" />
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <div className="w-full max-w-xl">
            <div className="border border-gray-700 focus-within:border-white transition-colors">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                onKeyDown={handleKey}
                placeholder="Ask anything."
                rows={3}
                className="w-full px-4 pt-4 pb-2 text-white placeholder-gray-600 text-xl leading-relaxed resize-none outline-none bg-transparent"
                style={{ minHeight: '80px' }}
              />
              <div className="flex items-center justify-between px-4 pb-3">
                {question.length >= 140 && (
                  <span className="text-xs text-gray-600">{question.length}</span>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!question.trim()}
                  className="ml-auto bg-white text-black px-6 py-2 text-sm font-semibold tracking-tight disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
                >
                  Ask Elijah →
                </button>
              </div>
            </div>

            {showSuggestions && question.length === 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQuestion(s); setShowSuggestions(false) }}
                    className="text-sm border border-gray-700 px-3 py-1.5 text-gray-400 hover:border-gray-400 hover:text-white transition-colors"
                  >
                    {s}
                  </button>
                ))}
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="text-xs text-gray-700 hover:text-gray-500 transition-colors"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Loading mode
  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6">
        <AnimatedLogo />
        <p className="text-gray-400 text-sm">Getting your answer...</p>
      </div>
    )
  }

  // Answer mode
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="flex items-center justify-between px-6 py-5 bg-white border-b border-gray-100">
        <button onClick={handleFollowUp} className="text-gray-400 hover:text-black transition-colors text-sm">
          ← New question
        </button>
        <Logo />
        <Link href="/pricing" className="text-xs text-gray-400 hover:text-black transition-colors">
          Upgrade
        </Link>
      </nav>

      <main className="flex-1 px-6 py-12 max-w-2xl mx-auto w-full pb-32">
        <p className="text-xs text-gray-400 tracking-widest uppercase mb-4">From Elijah&apos;s vault</p>
        <p className="text-gray-400 text-sm mb-8">{question}</p>

        <div className="text-black text-lg leading-relaxed">
          {answer}
          {answer && <span className="inline-block w-0.5 h-5 bg-black animate-pulse ml-0.5 align-middle" />}
        </div>

        {answer && (
          <div className="flex gap-3 mt-12">
            <button
              onClick={handleFollowUp}
              className="bg-black text-white px-6 py-3 text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity"
            >
              Ask a follow-up
            </button>
            <Link
              href="/ask-directly"
              className="border border-black text-black px-6 py-3 text-sm font-semibold tracking-tight hover:bg-black hover:text-white transition-colors"
            >
              Ask Directly
            </Link>
          </div>
        )}

        {saved && (
          <p className="text-xs text-gray-400 mt-4">Saved to your playbook.</p>
        )}
      </main>

      {/* Sticky save bar */}
      {showSaveBar && !saved && (
        <div className="fixed bottom-0 left-0 right-0 bg-black text-white p-4 flex items-center justify-between slide-up z-50">
          <span className="text-sm font-semibold">Save this answer.</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setSaved(true); setShowSaveBar(false) }}
              className="text-sm border border-white px-4 py-2 hover:bg-white hover:text-black transition-colors"
            >
              Save →
            </button>
            <button onClick={() => setShowSaveBar(false)} className="text-gray-400 hover:text-white text-sm">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
