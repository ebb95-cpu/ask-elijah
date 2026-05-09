'use client'

import { useState } from 'react'

const MAX_FOLLOWUPS = 3

export default function FollowUpComposer({
  threadId,
  followUpCount,
}: {
  threadId: string
  followUpCount: number
}) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const remaining = MAX_FOLLOWUPS - followUpCount
  if (remaining <= 0) return null

  const handleSubmit = async () => {
    if (question.trim().length < 5) {
      setErrorMsg('Add a bit more detail.')
      return
    }
    setStatus('sending')
    setErrorMsg('')
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), thread_id: threadId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong.')
        setStatus('error')
        return
      }
      setStatus('sent')
    } catch {
      setErrorMsg('Something went wrong. Try again.')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
        <p className="text-[10px] text-emerald-300 uppercase tracking-[0.22em] font-bold mb-2">
          Follow-up sent
        </p>
        <p className="text-sm text-gray-400 leading-relaxed">
          Elijah will get back to you. Check your inbox.
        </p>
      </div>
    )
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-gray-500 hover:text-white transition-colors underline underline-offset-4"
        >
          Still need clarity? Ask a follow-up ({remaining} left)
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
      <p className="text-[10px] text-gray-400 uppercase tracking-[0.22em] font-bold mb-3">
        Follow-up · {remaining} of {MAX_FOLLOWUPS} remaining
      </p>
      <textarea
        value={question}
        onChange={(e) => { setQuestion(e.target.value); setErrorMsg('') }}
        placeholder="What specifically are you still unclear on?"
        rows={3}
        className="w-full bg-transparent border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-white/30 transition-colors resize-none mb-3"
        autoFocus
      />
      {errorMsg && <p className="text-xs text-red-400 mb-3">{errorMsg}</p>}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={status === 'sending' || question.trim().length < 5}
          className="flex-1 bg-white text-black py-3 text-sm font-bold rounded-full disabled:opacity-30 hover:opacity-80 transition-opacity"
        >
          {status === 'sending' ? 'Sending...' : 'Send follow-up →'}
        </button>
        <button
          onClick={() => { setOpen(false); setQuestion(''); setErrorMsg('') }}
          className="px-5 py-3 text-sm text-gray-500 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
