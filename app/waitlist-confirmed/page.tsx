'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'

function Logo() {
  return (
    <svg width="52" height="8" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill="#fff" />
      <line x1="8" y1="4" x2="20" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill="#fff" />
      <line x1="28" y1="4" x2="40" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill="#fff" />
    </svg>
  )
}

function ConfirmedInner() {
  const params = useSearchParams()
  const name = params.get('name') || ''
  const firstName = name.split(' ')[0]

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <nav className="flex items-center justify-center px-6 py-5">
        <Logo />
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 text-center">
        <div className="w-full max-w-sm">
          <div className="w-2 h-2 bg-white rounded-full mx-auto mb-10" />
          <h1 className="text-3xl font-bold mb-4 leading-tight">
            {firstName ? `You're locked in, ${firstName}.` : "You're locked in."}
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-10">
            When the next wave opens, you&apos;ll get an email before anyone else. Elijah already knows you&apos;re waiting.
          </p>
          <Link
            href="/"
            className="text-xs text-gray-600 hover:text-white transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function WaitlistConfirmedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ConfirmedInner />
    </Suspense>
  )
}
