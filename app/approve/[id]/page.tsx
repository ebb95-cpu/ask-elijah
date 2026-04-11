'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

type QuestionRecord = {
  id: string
  question: string
  answer: string
  email: string
  created_at: string
}

type Stage = 'review' | 'regenerating' | 'approve' | 'sending' | 'sent'

function ApprovePageInner() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [record, setRecord] = useState<QuestionRecord | null>(null)
  const [draft, setDraft] = useState('')
  const [context, setContext] = useState('')
  const [finalAnswer, setFinalAnswer] = useState('')
  const [stage, setStage] = useState<Stage>('review')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const res = await fetch(`/api/question/${id}?token=${token}`)
        if (!res.ok) throw new Error('Not found or unauthorized')
        const data = await res.json()
        setRecord(data)
        setDraft(data.answer)
        setFinalAnswer(data.answer)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    if (id && token) fetchRecord()
    else { setError('Missing token'); setLoading(false) }
  }, [id, token])

  const handleRegenerate = async () => {
    if (!context.trim()) return
    setStage('regenerating')
    try {
      const res = await fetch('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-token': token },
        body: JSON.stringify({ question: record?.question, draft, context }),
      })
      if (!res.ok) throw new Error('Regeneration failed')
      const data = await res.json()
      setFinalAnswer(data.answer)
      setStage('approve')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setStage('review')
    }
  }

  const handleApproveAndSend = async () => {
    setStage('sending')
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-token': token },
        body: JSON.stringify({ questionId: id, finalAnswer }),
      })
      if (!res.ok) throw new Error('Failed to send')
      setStage('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setStage('approve')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-600 text-sm">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  if (stage === 'sent') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="w-3 h-3 bg-white rounded-full" />
        <p className="text-white text-2xl font-bold">Sent.</p>
        <p className="text-gray-500 text-sm">Answer delivered to {record?.email}</p>
        <p className="text-gray-700 text-xs mt-2">Pinecone trained. This answer will improve future responses.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">

        <p className="text-xs text-gray-600 tracking-widest uppercase mb-8">Ask Elijah — Approval</p>

        {/* Question */}
        <div className="border-l-2 border-gray-700 pl-4 mb-10">
          <p className="text-xs text-gray-600 mb-2">From: {record?.email}</p>
          <p className="text-xl font-semibold">{record?.question}</p>
        </div>

        {/* Stage: Review draft + add context */}
        {(stage === 'review' || stage === 'regenerating') && (
          <>
            <div className="mb-8">
              <p className="text-xs text-gray-600 tracking-widest uppercase mb-3">AI Draft</p>
              <div className="bg-gray-950 border border-gray-800 p-4 text-gray-400 text-sm leading-relaxed">
                {draft}
              </div>
            </div>

            <div className="mb-8">
              <p className="text-xs text-gray-600 tracking-widest uppercase mb-3">
                Your real thoughts — add context, corrections, stories
              </p>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={6}
                autoFocus
                placeholder={`What do you actually want to say about this? Write it in your own words.\n\nExamples:\n"I want to mention the time in EuroLeague when..."\n"The AI missed the point — the real issue is..."\n"I'd also add that recovery depends on..."`}
                className="w-full bg-gray-950 border border-gray-700 focus:border-white text-white text-sm leading-relaxed p-4 outline-none resize-none transition-colors placeholder-gray-700"
              />
            </div>

            <div className="flex gap-4 items-center mb-4">
              <button
                onClick={handleRegenerate}
                disabled={!context.trim() || stage === 'regenerating'}
                className="bg-white text-black px-8 py-3 text-sm font-bold disabled:opacity-30 hover:opacity-80 transition-opacity"
              >
                {stage === 'regenerating' ? 'Regenerating...' : 'Regenerate with my context →'}
              </button>
              <button
                onClick={() => { setFinalAnswer(draft); setStage('approve') }}
                className="text-xs text-gray-600 hover:text-white transition-colors"
              >
                Skip — approve draft as-is
              </button>
            </div>
            <p className="text-xs text-gray-700">
              Claude will rewrite the answer using your real input in your voice.
            </p>
          </>
        )}

        {/* Stage: Review regenerated answer + approve */}
        {(stage === 'approve' || stage === 'sending') && (
          <>
            <div className="mb-6">
              <p className="text-xs text-gray-600 tracking-widest uppercase mb-3">Regenerated Answer — review before sending</p>
              <textarea
                value={finalAnswer}
                onChange={(e) => setFinalAnswer(e.target.value)}
                rows={12}
                className="w-full bg-gray-950 border border-gray-700 focus:border-white text-white text-base leading-relaxed p-4 outline-none resize-none transition-colors"
              />
            </div>

            <div className="flex gap-4 items-center mb-4">
              <button
                onClick={handleApproveAndSend}
                disabled={!finalAnswer.trim() || stage === 'sending'}
                className="bg-white text-black px-8 py-3 text-sm font-bold disabled:opacity-30 hover:opacity-80 transition-opacity"
              >
                {stage === 'sending' ? 'Sending...' : `Approve & Send to ${record?.email} →`}
              </button>
              <button
                onClick={() => setStage('review')}
                className="text-xs text-gray-600 hover:text-white transition-colors"
              >
                ← Add more context
              </button>
            </div>

            <p className="text-xs text-gray-700">
              This will send the answer to the user and train Pinecone automatically.
            </p>
          </>
        )}

      </div>
    </div>
  )
}

export default function ApprovePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-600 text-sm">Loading...</p>
      </div>
    }>
      <ApprovePageInner />
    </Suspense>
  )
}
