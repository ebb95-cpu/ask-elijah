'use client'

import { useState } from 'react'

/**
 * Share an approved answer via the public /browse/[id] page. Uses the
 * native Web Share sheet on mobile (iMessage / Instagram / WhatsApp /
 * whatever's installed), falls back to clipboard copy on desktop with a
 * 2-second "Link copied" confirmation. Last-resort fallback opens the
 * share URL in a new tab if clipboard is blocked in the runtime (some
 * embedded contexts).
 */
export default function ShareAnswerButton({
  questionId,
  question,
}: {
  questionId: string
  question: string
}) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = `${window.location.origin}/browse/${questionId}`
    const shareText = `"${question}" — Elijah's answer:`
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Ask Elijah', text: shareText, url })
        return
      } catch {
        // User cancelled or share failed — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.open(url, '_blank', 'noopener')
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1.5 shrink-0"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      {copied ? 'Link copied' : 'Share'}
    </button>
  )
}
