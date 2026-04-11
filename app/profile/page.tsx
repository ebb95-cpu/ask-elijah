'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C', 'Coach']
const LEVELS = ['Youth', 'High School', 'College', 'Pro']
const CHALLENGES = ['Confidence', 'Pressure', 'Consistency', 'Leadership', 'Slumps', 'Focus']

export default function ProfilePage() {
  const [email, setEmail] = useState('')
  const [position, setPosition] = useState('')
  const [level, setLevel] = useState('')
  const [country, setCountry] = useState('')
  const [challenge, setChallenge] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('ask_elijah_email')
    if (stored) {
      setEmail(stored)
      fetch(`/api/profile?email=${encodeURIComponent(stored)}`)
        .then(r => r.json())
        .then(d => {
          if (d.position) setPosition(d.position)
          if (d.level) setLevel(d.level)
          if (d.country) setCountry(d.country)
          if (d.challenge) setChallenge(d.challenge)
        })
    }
  }, [])

  const save = async () => {
    if (!email.trim()) return
    setLoading(true)
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, position, level, country, challenge }),
    })
    localStorage.setItem('ask_elijah_email', email)
    setSaved(true)
    setLoading(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const filled = [position, level, country, challenge].filter(Boolean).length
  const pct = Math.round((filled / 4) * 100)

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-5 py-5 border-b border-gray-900">
        <Link href="/" className="text-xs text-gray-600 hover:text-white transition-colors">← Back</Link>
        <p className="text-xs text-gray-600 tracking-widest uppercase">Your Profile</p>
        <div className="w-12" />
      </nav>

      <div className="max-w-lg mx-auto px-5 py-12">
        <div className="mb-10">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">Profile complete</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-0.5 bg-gray-900">
              <div className="h-0.5 bg-white transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-gray-500">{pct}%</span>
          </div>
          <p className="text-xs text-gray-700 mt-2">The more you fill in, the more specific Elijah's answers get to your situation.</p>
        </div>

        <div className="space-y-8">
          <div>
            <label className="text-xs text-gray-600 uppercase tracking-widest block mb-3">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-transparent border-b border-gray-800 focus:border-gray-500 text-white placeholder-gray-700 text-base outline-none pb-2 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-gray-600 uppercase tracking-widest block mb-3">Position</label>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map(p => (
                <button key={p} onClick={() => setPosition(p)}
                  className={`px-3 py-1.5 text-xs border transition-colors ${position === p ? 'border-white text-white' : 'border-gray-800 text-gray-600 hover:border-gray-600'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-600 uppercase tracking-widest block mb-3">Level</label>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map(l => (
                <button key={l} onClick={() => setLevel(l)}
                  className={`px-3 py-1.5 text-xs border transition-colors ${level === l ? 'border-white text-white' : 'border-gray-800 text-gray-600 hover:border-gray-600'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-600 uppercase tracking-widest block mb-3">Country / League</label>
            <input
              type="text"
              value={country}
              onChange={e => setCountry(e.target.value)}
              placeholder="e.g. Turkey, USA, Spain..."
              className="w-full bg-transparent border-b border-gray-800 focus:border-gray-500 text-white placeholder-gray-700 text-sm outline-none pb-2 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-gray-600 uppercase tracking-widest block mb-3">Biggest mental challenge right now</label>
            <div className="flex flex-wrap gap-2">
              {CHALLENGES.map(c => (
                <button key={c} onClick={() => setChallenge(c)}
                  className={`px-3 py-1.5 text-xs border transition-colors ${challenge === c ? 'border-white text-white' : 'border-gray-800 text-gray-600 hover:border-gray-600'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={save}
            disabled={!email.trim() || loading}
            className="w-full py-3 bg-white text-black text-sm font-semibold disabled:opacity-30 hover:opacity-80 transition-opacity"
          >
            {saved ? 'Saved ✓' : loading ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
