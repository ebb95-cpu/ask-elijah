'use client'

import { useState } from 'react'
import LoadingDots from '@/components/ui/LoadingDots'

export default function ParentLeadForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/parents/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, magnet: '1-for-9' }),
    })
    if (res.ok) setDone(true)
    else {
      const data = await res.json().catch(() => null)
      setError(data?.error || 'Something broke. Try again.')
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div className="rounded-[2rem] bg-[#F7F5F0] p-7 text-black">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Sent</p>
        <p className="mt-4 text-2xl font-black">Check your inbox.</p>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          The parent letter is on its way. Start with that before you try to fix anything.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-[2rem] bg-[#F7F5F0] p-7 text-black">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">The parent letter</p>
      <h2 className="mt-4 text-3xl font-black leading-tight">What to say after a 1 for 9 game.</h2>
      <p className="mt-4 text-sm leading-relaxed text-gray-600">
        Most parents say one of three things. All three make it worse. Get the line to use instead.
      </p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="parent@email.com"
          className="min-w-0 flex-1 rounded-full border border-black/10 bg-white px-5 py-4 text-sm outline-none placeholder:text-gray-400 focus:border-black"
        />
        <button
          disabled={loading || !email.trim()}
          className="rounded-full bg-black px-6 py-4 text-sm font-black text-white disabled:opacity-40"
        >
          {loading ? <LoadingDots label="Sending" /> : 'Get the letter'}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </form>
  )
}
