'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import LoadingDots from '@/components/ui/LoadingDots'

type QuestionRecord = {
  id: string
  question: string
  answer: string
  email: string
  created_at: string
}

function ApprovePageInner() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [record, setRecord] = useState<QuestionRecord | null>(null)
  const [answer, setAnswer] = useState('')
  const [additions, setAdditions] = useState('')
  const [actionSteps, setActionSteps] = useState('')
  const [loading, setLoading] = useState(true)
  const [remixing, setRemixing] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const answerRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const res = await fetch(`/api/question/${id}?token=${token}`)
        if (!res.ok) throw new Error('Not found or unauthorized')
        const data = await res.json()
        setRecord(data)
        setAnswer(data.answer)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    if (id && token) fetchRecord()
    else { setError('Missing token'); setLoading(false) }
  }, [id, token])

  // Auto-resize answer textarea
  useEffect(() => {
    if (answerRef.current) {
      answerRef.current.style.height = 'auto'
      answerRef.current.style.height = `${answerRef.current.scrollHeight}px`
    }
  }, [answer])

  const handleRemix = async () => {
    if (!additions.trim() || remixing) return
    setRemixing(true)
    setError('')
    try {
      const res = await fetch('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-token': token },
        body: JSON.stringify({ question: record?.question, draft: answer, context: additions }),
      })
      if (!res.ok) throw new Error('Remix failed')
      const data = await res.json()
      setAnswer(data.answer)
      setAdditions('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remix failed')
    } finally {
      setRemixing(false)
    }
  }

  const handleApprove = async () => {
    if (!answer.trim() || !actionSteps.trim() || sending) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-token': token },
        body: JSON.stringify({ questionId: id, finalAnswer: answer, actionSteps }),
      })
      if (!res.ok) throw new Error('Failed to send')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingDots label="Loading" className="text-gray-500 text-sm" />
      </div>
    )
  }

  if (error && !record) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  if (sent) {
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

        <p className="text-xs text-gray-600 tracking-widest uppercase mb-8">Ask Elijah — Review</p>

        {/* Question */}
        <div className="border-l-2 border-gray-800 pl-4 mb-10">
          <p className="text-xs text-gray-600 mb-1">From: {record?.email}</p>
          <p className="text-lg font-semibold leading-snug">{record?.question}</p>
        </div>

        {/* Answer — editable */}
        <div className="mb-2">
          <p className="text-xs text-gray-600 tracking-widest uppercase mb-3">Answer</p>
          <textarea
            ref={answerRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full bg-transparent border border-gray-800 focus:border-gray-600 text-white text-base leading-relaxed p-5 outline-none resize-none transition-colors"
            style={{ minHeight: '200px' }}
          />
        </div>
        <p className="text-xs text-gray-700 mb-10">Edit directly or use Add &amp; Remix below.</p>

        {/* Add & Remix */}
        <div className="mb-3">
          <p className="text-xs text-gray-600 tracking-widest uppercase mb-3">Add your thoughts</p>
          <textarea
            value={additions}
            onChange={(e) => setAdditions(e.target.value)}
            rows={5}
            placeholder={"What do you actually want to say?\n\n\"I remember when I was in EuroLeague and...\"\n\"The AI missed it — the real issue is...\"\n\"I'd add that the key is...\""}
            className="w-full bg-transparent border border-gray-800 focus:border-gray-600 text-white text-sm leading-relaxed p-5 outline-none resize-none transition-colors placeholder-gray-800"
          />
        </div>

        {/* Three buttons */}
        <div className="flex items-center gap-4 mb-12">
          <button
            onClick={handleRemix}
            disabled={!additions.trim() || remixing}
            style={{
              background: additions.trim() && !remixing ? '#ffffff' : 'transparent',
              color: additions.trim() && !remixing ? '#000000' : '#444444',
              border: '1px solid ' + (additions.trim() && !remixing ? '#ffffff' : '#333333'),
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: additions.trim() && !remixing ? 'pointer' : 'default',
              fontFamily: '-apple-system, sans-serif',
              transition: 'all 0.15s',
            }}
          >
            {remixing ? <LoadingDots label="Remixing" /> : 'Add & Remix →'}
          </button>

          <button
            onClick={handleApprove}
            disabled={!answer.trim() || !actionSteps.trim() || sending}
            style={{
              background: answer.trim() && actionSteps.trim() && !sending ? '#000000' : 'transparent',
              color: answer.trim() && actionSteps.trim() && !sending ? '#ffffff' : '#444444',
              border: '1px solid ' + (answer.trim() && actionSteps.trim() && !sending ? '#ffffff' : '#333333'),
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: answer.trim() && actionSteps.trim() && !sending ? 'pointer' : 'default',
              fontFamily: '-apple-system, sans-serif',
              transition: 'all 0.15s',
            }}
          >
            {sending ? <LoadingDots label="Sending" /> : `Approve & Send →`}
          </button>

          <button
            onClick={() => window.history.back()}
            style={{
              background: 'none',
              border: 'none',
              padding: '10px 0',
              fontSize: '12px',
              color: '#444444',
              cursor: 'pointer',
              fontFamily: '-apple-system, sans-serif',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#444444')}
          >
            Skip
          </button>
        </div>

        {/* Action Steps */}
        <div className="border-t border-gray-900 pt-10">
          <p className="text-xs text-gray-600 tracking-widest uppercase mb-1">Action Steps</p>
          <p className="text-xs text-gray-700 mb-4">
            2 to 3 things they must do. Specific enough that there is no excuse not to start today. Sent in the email and used for the 48hr follow-up.
          </p>
          <textarea
            value={actionSteps}
            onChange={(e) => setActionSteps(e.target.value)}
            rows={4}
            placeholder={"1. Before your next practice, write down one thing you are going to control. Just one.\n2. After the game, voice memo yourself for 60 seconds. What did you actually control?\n3. Do this for 7 days. Don't miss."}
            className="w-full bg-transparent border border-gray-800 focus:border-gray-600 text-white text-sm leading-relaxed p-5 outline-none resize-none transition-colors placeholder-gray-800"
          />
          {!actionSteps.trim() && (
            <p className="text-xs text-gray-700 mt-2">Required before you can approve.</p>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-xs mt-6">{error}</p>
        )}

      </div>
    </div>
  )
}

export default function ApprovePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingDots label="Loading" className="text-gray-500 text-sm" />
      </div>
    }>
      <ApprovePageInner />
    </Suspense>
  )
}
