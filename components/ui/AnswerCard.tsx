'use client'

import { useState, useEffect } from 'react'
import LoadingDots from './LoadingDots'

interface AnswerCardProps {
  question: string
  answer: string
  streaming?: boolean
  onSave?: () => void
  onFollowUp?: () => void
  showUpsell?: boolean
}

export default function AnswerCard({
  question,
  answer,
  streaming = false,
  onSave,
  onFollowUp,
  showUpsell = true,
}: AnswerCardProps) {
  const [showSaveBar, setShowSaveBar] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!streaming && answer.length > 0) {
      const timer = setTimeout(() => setShowSaveBar(true), 4000)
      return () => clearTimeout(timer)
    }
  }, [streaming, answer])

  const handleSave = () => {
    setSaved(true)
    setShowSaveBar(false)
    onSave?.()
  }

  return (
    <div className="relative">
      <div className="max-w-2xl mx-auto">
        {/* Label */}
        <p className="text-xs text-gray-400 tracking-widest uppercase mb-4">From Elijah's vault</p>

        {/* Question */}
        <p className="text-gray-500 text-sm mb-6">{question}</p>

        {/* Answer */}
        <div className={`text-black text-lg leading-relaxed font-sans ${streaming && !answer ? 'text-gray-400' : ''}`}>
          {streaming && !answer ? (
            <LoadingDots label="Getting your answer" />
          ) : (
            <span className={streaming ? 'streaming-cursor' : ''}>
              {answer}
            </span>
          )}
        </div>

        {/* Actions */}
        {!streaming && answer && (
          <div className="flex gap-3 mt-10">
            <button
              onClick={onFollowUp}
              className="bg-black text-white px-6 py-3 text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity"
            >
              Ask a follow-up
            </button>
            {showUpsell && (
              <button
                onClick={() => window.location.href = '/ask-directly'}
                className="border border-black text-black px-6 py-3 text-sm font-semibold tracking-tight hover:bg-black hover:text-white transition-colors"
              >
                Ask Directly
              </button>
            )}
          </div>
        )}

        {saved && (
          <p className="text-xs text-gray-400 mt-4">Saved to your playbook.</p>
        )}
      </div>

      {/* Sticky save bar */}
      {showSaveBar && (
        <div className="fixed bottom-0 left-0 right-0 bg-black text-white p-4 flex items-center justify-between slide-up z-50">
          <span className="text-sm font-semibold">Save this answer.</span>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="text-sm border border-white px-4 py-2 hover:bg-white hover:text-black transition-colors"
            >
              Save →
            </button>
            <button
              onClick={() => setShowSaveBar(false)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
