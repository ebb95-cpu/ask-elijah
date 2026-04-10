'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

// Test-only page — streams answers directly without approval flow
// Only accessible via /test which requires being Elijah

const SUGGESTIONS = [
  "I freeze up in real games but ball out in practice",
  "How do I get my confidence back after a bad game?",
  "My coach keeps benching me and won't tell me why",
  "How do I stop overthinking on the court?",
  "Night before a big game",
  "How do I get out of a shooting slump?",
]

export default function TestAskPage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [mode, setMode] = useState<'input' | 'loading' | 'answer'>('input')
  const [correctionText, setCorrectionText] = useState('')
  const [showCorrection, setShowCorrection] = useState(false)
  const [correctionSaved, setCorrectionSaved] = useState(false)
  const [questionId, setQuestionId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    if (!question.trim()) return
    setMode('loading')
    setAnswer('')
    setShowCorrection(false)

    try {
      // Use the streaming approach for test mode
      const res = await fetch('/api/test-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, language: 'en' }),
      })

      if (!res.ok) {
        const text = await res.text()
        setAnswer(text)
        setMode('answer')
        return
      }

      const qId = res.headers.get('X-Question-Id')
      if (qId) setQuestionId(qId)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No stream')

      setMode('answer')
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setAnswer(full)
      }
    } catch {
      setMode('input')
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const handleCorrection = async () => {
    if (!correctionText.trim()) return
    try {
      const res = await fetch('/api/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, question, correctAnswer: correctionText.trim() }),
      })
      if (res.ok) {
        setCorrectionSaved(true)
        setAnswer(correctionText.trim())
        setTimeout(() => { setShowCorrection(false); setCorrectionSaved(false) }, 2000)
      }
    } catch { /* fail silently */ }
  }

  const reset = () => {
    setMode('input')
    setAnswer('')
    setQuestion('')
    setShowCorrection(false)
    setCorrectionText('')
    setCorrectionSaved(false)
    setQuestionId(null)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Test mode banner */}
      <div className="bg-yellow-400 text-black text-xs font-semibold text-center py-2 tracking-wide">
        TEST MODE — Answers are streamed directly. Use the correction button to train Pinecone.
      </div>

      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <button onClick={reset} className="text-gray-400 hover:text-black text-sm transition-colors">
          ← New question
        </button>
        <p className="text-xs text-gray-400 font-semibold">Ask Elijah · Test</p>
        <Link href="/" className="text-xs text-gray-400 hover:text-black transition-colors">Exit test</Link>
      </nav>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">
        {mode === 'input' && (
          <div>
            <div className="border border-gray-200 focus-within:border-black transition-colors mb-4">
              <textarea
                ref={textareaRef}
                autoFocus
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything to test the response..."
                rows={3}
                className="w-full px-4 pt-4 pb-2 text-black placeholder-gray-300 text-xl resize-none outline-none"
                style={{ minHeight: '80px' }}
              />
              <div className="px-4 pb-3 flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={!question.trim()}
                  className="bg-black text-white px-6 py-2 text-sm font-semibold disabled:opacity-30"
                >
                  Test →
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuestion(s)}
                  className="text-xs border border-gray-200 px-3 py-1.5 text-gray-400 hover:border-black hover:text-black transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'loading' && (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-400 text-sm">Generating...</p>
          </div>
        )}

        {mode === 'answer' && (
          <div>
            <p className="text-xs text-gray-400 tracking-widest uppercase mb-3">From Elijah&apos;s vault</p>
            <p className="text-gray-400 text-sm mb-8">{question}</p>
            <div className="text-black text-lg leading-relaxed mb-8">
              {answer}
              {answer && (
                <span className="inline-block w-0.5 h-5 bg-black animate-pulse ml-0.5 align-middle" />
              )}
            </div>

            {answer && (
              <div className="flex gap-3 mb-8">
                <button
                  onClick={reset}
                  className="bg-black text-white px-6 py-2 text-sm font-semibold hover:opacity-80 transition-opacity"
                >
                  Ask another →
                </button>
              </div>
            )}

            {/* Correction UI */}
            {answer && !showCorrection && (
              <button
                onClick={() => { setShowCorrection(true); setCorrectionText(answer) }}
                className="text-xs text-gray-300 border border-gray-200 px-3 py-1.5 hover:border-black hover:text-black transition-colors"
              >
                ✏️ This isn&apos;t right — correct it
              </button>
            )}

            {showCorrection && (
              <div className="border border-black p-4 mt-4">
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-widest">Your correction</p>
                <textarea
                  value={correctionText}
                  onChange={(e) => setCorrectionText(e.target.value)}
                  rows={8}
                  className="w-full text-black text-base leading-relaxed outline-none resize-none border-b border-gray-200 pb-3 mb-4"
                  autoFocus
                />
                <div className="flex gap-3 items-center">
                  <button
                    onClick={handleCorrection}
                    disabled={!correctionText.trim()}
                    className="bg-black text-white px-5 py-2 text-sm font-semibold disabled:opacity-30"
                  >
                    {correctionSaved ? 'Saved to Pinecone ✓' : 'Save & train →'}
                  </button>
                  <button
                    onClick={() => setShowCorrection(false)}
                    className="text-xs text-gray-400 hover:text-black"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  This trains Pinecone so future similar questions get your real answer.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
