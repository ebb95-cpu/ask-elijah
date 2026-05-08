'use client'

import { useState } from 'react'

export default function RepReportForm({
  questionId,
  question,
}: {
  questionId: string
  question: string
}) {
  const [reflection, setReflection] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async () => {
    if (reflection.trim().length < 10) {
      setErrorMsg('Tell me what actually happened. At least a sentence.')
      return
    }
    setStatus('saving')
    setErrorMsg('')

    try {
      const res = await fetch('/api/rep-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, reflection: reflection.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong.')
        setStatus('error')
        return
      }
      setStatus('done')
    } catch {
      setErrorMsg('Something went wrong. Try again.')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
        <p className="text-[10px] text-emerald-300 uppercase tracking-[0.22em] font-bold mb-2">
          ✓ Logged
        </p>
        <p className="text-sm text-gray-400 leading-relaxed">
          {reflection}
        </p>
        <p className="text-xs text-gray-600 mt-3">
          That rep is now part of your playbook. Ask your next question.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-[24px] border border-amber-400/20 bg-amber-400/5 p-5">
      <p className="text-[10px] text-amber-300 uppercase tracking-[0.22em] font-bold mb-3">
        Before your next question
      </p>
      <p className="text-sm text-white leading-relaxed mb-1 italic">
        &ldquo;{question.length > 80 ? question.slice(0, 80) + '...' : question}&rdquo;
      </p>
      <p className="text-sm text-gray-400 leading-relaxed mb-4">
        What was the situation, what did you do, and what changed?
      </p>
      <textarea
        value={reflection}
        onChange={(e) => { setReflection(e.target.value); setErrorMsg('') }}
        placeholder="Describe a real moment where you used what Elijah told you..."
        rows={3}
        className="w-full bg-transparent border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-white/30 transition-colors resize-none mb-3"
      />
      {errorMsg && (
        <p className="text-xs text-red-400 mb-3">{errorMsg}</p>
      )}
      <button
        onClick={handleSubmit}
        disabled={status === 'saving' || reflection.trim().length < 10}
        className="w-full bg-white text-black py-3 text-sm font-bold rounded-full disabled:opacity-30 hover:opacity-80 transition-opacity"
      >
        {status === 'saving' ? 'Saving...' : 'Log the rep →'}
      </button>
    </div>
  )
}
