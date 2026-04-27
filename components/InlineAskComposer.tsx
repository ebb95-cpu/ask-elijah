'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import LoadingDots from '@/components/ui/LoadingDots'
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
  const desktopTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const mobileTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const router = useRouter()

  const resetTextareaHeight = () => {
    for (const el of [desktopTextareaRef.current, mobileTextareaRef.current]) {
      if (!el) continue
      el.style.height = 'auto'
    }
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
      // the loading indicator up briefly so the user sees the handoff.
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
    <>
      <div className="hidden md:block rounded-2xl border border-gray-800 bg-[#0a0a0a] p-4 mb-8">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">Ask me something else</p>
        <div className="flex items-end gap-3">
          <div className="relative flex-1">
            <textarea
              ref={desktopTextareaRef}
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
            {loading ? <LoadingDots label="" size={2} /> : 'Ask →'}
          </button>
        </div>
        {error && (
          <p className="text-red-400 text-xs mt-3">{error}</p>
        )}
      </div>

      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 px-4 pb-safe-plus-16 pt-3 bg-gradient-to-t from-black via-black to-black/0">
        {error && (
          <p className="mx-auto mb-2 max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-200">
            {error}
          </p>
        )}
        <div className="mx-auto flex max-w-md items-end gap-2 rounded-[28px] border border-white/10 bg-[#1f1f1d]/95 px-3 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur">
          <button
            type="button"
            onClick={() => mobileTextareaRef.current?.focus()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-white/45 transition-colors hover:text-white"
            aria-label="Focus question box"
          >
            +
          </button>
          <textarea
            ref={mobileTextareaRef}
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value)
              if (error) setError('')
              const el = e.target
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 112)}px`
            }}
            onKeyDown={handleKey}
            placeholder={loading ? "Elijah's thinking..." : 'Ask Elijah...'}
            rows={1}
            maxLength={500}
            disabled={loading}
            className="max-h-28 min-h-10 flex-1 resize-none bg-transparent py-2 text-base leading-snug text-white outline-none placeholder:text-white/35 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!question.trim() || loading}
            className="flex h-11 shrink-0 items-center justify-center rounded-full bg-white px-4 text-sm font-bold text-black transition-opacity disabled:opacity-25 disabled:cursor-not-allowed"
          >
            {loading ? <LoadingDots label="" size={2} color="#000" /> : 'Ask →'}
          </button>
        </div>
      </div>
    </>
  )
}
