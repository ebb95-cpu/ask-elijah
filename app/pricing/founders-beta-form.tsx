'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import LoadingDots from '@/components/ui/LoadingDots'

type Props = {
  closed: boolean
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function FoundersBetaForm({ closed }: Props) {
  const [email, setEmail] = useState('')
  const [basketballCost, setBasketballCost] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const enoughContext = closed || basketballCost.trim().length >= 30
  const canSubmit = isEmail(email.trim()) && enoughContext && !loading

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setError('')

    const res = await fetch('/api/founders-beta/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        basketballCost: closed ? undefined : basketballCost,
        waitlistOnly: closed,
      }),
    })

    const data = await res.json().catch(() => null)
    if (res.ok) {
      setDone(true)
    } else {
      setError(data?.error || 'Could not save this yet. Try again.')
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div className="rounded-[2rem] bg-[#F7F5F0] p-7 text-black">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-gray-500">
          {closed ? 'Waitlist saved' : 'Application sent'}
        </p>
        <h2 className="mt-4 text-3xl font-black leading-tight">
          {closed ? 'You are on the waitlist.' : 'You are in the stack.'}
        </h2>
        <p className="mt-4 text-sm font-semibold leading-relaxed text-gray-600">
          {closed
            ? 'If a seat opens, this is where we will reach you.'
            : 'Elijah will review the Founding 200 applications before seats open.'}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-[2rem] bg-[#F7F5F0] p-7 text-black">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-gray-500">
        {closed ? 'Closed. Waitlist.' : 'Application'}
      </p>
      <h2 className="mt-4 text-3xl font-black leading-tight">
        {closed ? 'Founding 200 is full.' : 'Apply for a seat.'}
      </h2>

      <div className="mt-7 space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full rounded-full border border-black/10 bg-white px-5 py-4 text-sm font-semibold outline-none placeholder:text-gray-400 focus:border-black"
          required
        />

        {!closed && (
          <div>
            <textarea
              value={basketballCost}
              onChange={(e) => setBasketballCost(e.target.value)}
              placeholder="What's the one thing costing you in basketball right now?"
              minLength={30}
              required
              className="min-h-40 w-full resize-none rounded-[2rem] border border-black/10 bg-white px-5 py-5 text-sm font-semibold leading-relaxed outline-none placeholder:text-gray-400 focus:border-black"
            />
            <p className="mt-2 text-xs font-semibold text-gray-500">
              Minimum 30 characters. Be real. The better the situation, the better the answer.
            </p>
          </div>
        )}
      </div>

      <button
        disabled={!canSubmit}
        className="mt-7 w-full rounded-full bg-black px-6 py-4 text-sm font-black text-white disabled:opacity-40"
      >
        {loading ? <LoadingDots label="Saving" /> : closed ? 'Join the waitlist' : 'Apply for a seat.'}
      </button>
      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
    </form>
  )
}
