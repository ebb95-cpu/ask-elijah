'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setSession } from '@/lib/safe-storage'
import LoadingDots from './LoadingDots'

interface AskBoxProps {
  autoFocus?: boolean
  placeholder?: string
  onSubmit?: (question: string) => void
  prefill?: string
  className?: string
}

const SUGGESTIONS = [
  "Night before a big game",
  "When I lose confidence mid-game",
  "Recovery after back-to-backs",
]

export default function AskBox({
  autoFocus = false,
  placeholder = "What do you want to know about your game?",
  onSubmit,
  prefill = '',
  className = '',
}: AskBoxProps) {
  const [question, setQuestion] = useState(prefill)
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  useEffect(() => {
    if (prefill) {
      setQuestion(prefill)
      setShowSuggestions(false)
    }
  }, [prefill])

  const handleSubmit = async () => {
    if (!question.trim() || loading) return
    setLoading(true)

    if (onSubmit) {
      onSubmit(question.trim())
      return
    }

    // Store question in sessionStorage for the ask page to pick up
    setSession('pending_question', question.trim())
    router.push('/ask')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSuggestion = (s: string) => {
    setQuestion(s)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  // Auto-resize textarea
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="border border-black focus-within:border-2 transition-all bg-white">
        <textarea
          ref={inputRef}
          value={question}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          className="w-full px-4 pt-4 pb-2 text-black placeholder-gray-400 text-lg leading-relaxed resize-none outline-none bg-transparent font-sans"
          style={{ minHeight: '80px', maxHeight: '240px' }}
        />
        <div className="flex items-center justify-between px-4 pb-3">
          {question.length >= 140 && (
            <span className="text-xs text-gray-400">{question.length}</span>
          )}
          <div className="ml-auto">
            <button
              onClick={handleSubmit}
              disabled={!question.trim() || loading}
              className="bg-black text-white px-6 py-2 text-sm font-semibold tracking-tight disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
            >
              {loading ? <LoadingDots label="Getting your answer" /> : 'Ask The Pro →'}
            </button>
          </div>
        </div>
      </div>

      {showSuggestions && question.length === 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              className="text-sm border border-gray-300 px-3 py-1.5 text-gray-600 hover:border-black hover:text-black transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
