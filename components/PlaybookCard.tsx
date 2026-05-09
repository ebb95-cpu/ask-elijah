'use client'

import { useState } from 'react'

type PlaybookCardProps = {
  question: string
  answer: string | null
  actionSteps: string | null
  reflection: string | null
  solvedAt: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function firstActionStep(answer: string | null, actionSteps: string | null): string | null {
  const raw = actionSteps || answer || ''
  if (!raw) return null
  const lines = raw
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean)
  const actionLine = lines.find((line) =>
    /^(today|before|next|write|try|do|practice|text|ask|watch|pick|choose|focus|set|tell)\b/i.test(line),
  )
  return actionLine || null
}

export default function PlaybookCard({ question, answer, actionSteps, reflection, solvedAt }: PlaybookCardProps) {
  const [expanded, setExpanded] = useState(false)
  const theSystem = firstActionStep(answer, actionSteps)

  const previewAnswer = answer
    ? answer.replace(/\s+/g, ' ').trim().slice(0, 240).trimEnd() + (answer.length > 240 ? '...' : '')
    : null

  return (
    <div className="rounded-[24px] border border-emerald-500/15 bg-emerald-500/[0.04] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <span className="text-[10px] text-emerald-400 uppercase tracking-[0.2em] font-bold">
          ✓ Solved
        </span>
        <span className="text-[10px] text-gray-600">
          {formatDate(solvedAt)}
        </span>
      </div>

      {/* The Problem */}
      <div className="px-5 pb-4">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">The problem</p>
        <p className="text-sm text-white italic leading-relaxed">
          &ldquo;{question}&rdquo;
        </p>
      </div>

      {/* Elijah's Answer */}
      {answer && (
        <div className="px-5 pb-4">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Elijah&apos;s answer</p>
          <p className="text-sm text-gray-300 leading-[1.75]">
            {expanded ? answer : previewAnswer}
          </p>
          {answer.length > 240 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-600 hover:text-white transition-colors mt-2 font-semibold"
            >
              {expanded ? 'Show less ↑' : 'Read full answer ↓'}
            </button>
          )}
        </div>
      )}

      {/* The System — extracted action step */}
      {theSystem && (
        <div className="mx-5 mb-4 rounded-[14px] bg-white/[0.04] border border-white/8 px-4 py-3">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1.5">The system</p>
          <p className="text-xs text-gray-300 leading-relaxed">{theSystem}</p>
        </div>
      )}

      {/* What I Did */}
      {reflection && (
        <div className="mx-5 mb-5 border-l-2 border-emerald-500/30 pl-3">
          <p className="text-[10px] text-emerald-400/70 uppercase tracking-widest mb-1.5">What I did</p>
          <p className="text-xs text-gray-400 leading-relaxed">{reflection}</p>
        </div>
      )}
    </div>
  )
}
