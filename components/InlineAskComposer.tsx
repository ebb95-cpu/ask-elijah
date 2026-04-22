'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getLocal } from '@/lib/safe-storage'

/**
 * Inline ask composer on "Your court". Skips the homepage round-trip for
 * returning users — they already have the signed `ae_track` cookie + the
 * email in localStorage, so a new question just needs the text. Pipeline:
 *
 *   1. /api/gatekeep — semantic classifier blocks abuse/gibberish/off-topic
 *      before we burn an /api/ask call on trash input.
 *   2. /api/ask — saves the question, runs the full RAG + web_search draft
 *      pipeline, and notifies Elijah. Returns the first-take draft.
 *   3. router.refresh() — re-renders the /track server component so the
 *      new pending card shows up at the top of "What I'm working on".
 *
 * UX keeps the auto-grow textarea pattern from the homepage so long
 * questions stay fully visible as they type.
 */
export default function InlineAskComposer() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const router = useRouter()

  const resetTextareaHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
  }

  const handleSubmit = async () => {
    const q = question.trim()
    if (!q || loading) return

    const email = getLocal('ask_elijah_email')
    if (!email) {
      // No email stored — the user got here via an edge case (email link
      // from another browser, cleared localStorage, etc.). Kick them back
      // to the homepage to go through the full verify flow.
      setError("Something went wrong. Ask from the home page and I'll set it up.")
      return
    }

    setLoading(true)
    setError('')

    // 1. Gatekeeper
    try {
      const gk = await fetch('/api/gatekeep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      if (gk.ok) {
        const gkData = await gk.json()
        if (gkData?.classification && gkData.classification !== 'legit') {
          setError(gkData.reason || "That's not the kind of question I answer. Try asking me something real about your game.")
          setLoading(false)
          return
        }
      }
      // If gatekeep errors out, fall through — we'd rather let a real
      // question through than block on a classifier outage.
    } catch {
      /* fall through */
    }

    // 2. Save + generate draft
    try {
      let utm: Record<string, unknown> = {}
      try {
        utm = JSON.parse(getLocal('ask_elijah_utm') || '{}')
      } catch {
        /* no utm */
      }
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          email,
          newsletterOptIn: true,
          ...utm,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || "Couldn't send that one. Try again in a sec.")
        setLoading(false)
        return
      }
      // 3. Clear + re-render the page so the new pending card shows up.
      setQuestion('')
      resetTextareaHeight()
      router.refresh()
      // router.refresh is async in effect but returns synchronously. Leave
      // the loading spinner up briefly so the user sees the handoff.
      setTimeout(() => setLoading(false), 400)
    } catch {
      setError("Couldn't send that one. Try again in a sec.")
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-[#0a0a0a] p-4 mb-8">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">Ask me something else</p>
      <div className="flex items-end gap-3">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value)
              if (error) setError('')
              // Auto-grow
              const el = e.target
              el.style.height = 'auto'
              el.style.height = `${el.scrollHeight}px`
            }}
            onKeyDown={handleKey}
            placeholder={loading ? "Elijah's thinking..." : "Type your question..."}
            rows={1}
            maxLength={500}
            disabled={loading}
            className="w-full text-white placeholder-gray-600 text-base leading-relaxed resize-none outline-none bg-transparent disabled:opacity-50"
            style={{ minHeight: '28px' }}
          />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!question.trim() || loading}
          className="shrink-0 text-sm font-bold text-white disabled:text-gray-700 disabled:cursor-not-allowed hover:opacity-70 transition-all"
        >
          {loading ? '...' : 'Ask →'}
        </button>
      </div>
      {error && (
        <p className="text-red-400 text-xs mt-3">{error}</p>
      )}
    </div>
  )
}
