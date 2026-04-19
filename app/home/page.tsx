'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { setSession } from '@/lib/safe-storage'

function Logo() {
  return (
    <svg width="52" height="8" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill="#000" />
      <line x1="8" y1="4" x2="20" y2="4" stroke="#000" strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill="#000" />
      <line x1="28" y1="4" x2="40" y2="4" stroke="#000" strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill="#000" />
    </svg>
  )
}

export default function HomePage() {
  const [firstName, setFirstName] = useState('')
  const [streak, setStreak] = useState(0)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/sign-in'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, streak_count')
        .eq('id', user.id)
        .single()

      if (profile) {
        setFirstName(profile.first_name || '')
        setStreak(profile.streak_count || 0)
      }
    }
    fetchProfile()
  }, [])

  const handleSubmit = () => {
    if (!question.trim() || loading) return
    setLoading(true)
    setSession('pending_question', question.trim())
    router.push('/ask')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <Link href="/home"><Logo /></Link>
        <div className="flex items-center gap-8">
          <Link href="/home" className="text-sm font-semibold">Home</Link>
          <Link href="/library" className="text-sm text-gray-400 hover:text-black transition-colors">Library</Link>
          <Link href="/browse" className="text-sm text-gray-400 hover:text-black transition-colors">Browse</Link>
          <Link href="/ask-directly" className="text-sm text-gray-400 hover:text-black transition-colors">Ask Directly</Link>
          <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-black transition-colors">
            {firstName || 'Profile'}
          </button>
        </div>
      </nav>

      {/* Mobile nav */}
      <nav className="flex md:hidden items-center justify-between px-6 py-5 border-b border-gray-100">
        <Logo />
        <button onClick={handleSignOut} className="text-xs text-gray-400">
          {firstName}
        </button>
      </nav>

      <main className="flex-1 px-6 py-12 max-w-2xl mx-auto w-full pb-28">
        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Welcome back{firstName ? `, ${firstName}` : ''}.
          </h1>
          {streak > 0 && (
            <p className="text-xs text-gray-400 tracking-widest uppercase mt-2">Day {streak}</p>
          )}
        </div>

        {/* Locker room message */}
        <div className="bg-black text-white p-6 mb-8 text-sm leading-relaxed">
          <p className="mb-2">You're in the locker room. Athletes are waiting on the bench for your spot.</p>
          <p>Ask questions. Act on the answers. <span className="font-semibold">Build faith and consistency.</span></p>
        </div>

        {/* Ask box */}
        <div className="border border-black focus-within:border-2 transition-all mb-8">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything."
            rows={3}
            className="w-full px-4 pt-4 pb-2 text-black placeholder-gray-300 text-lg leading-relaxed resize-none outline-none"
            style={{ minHeight: '80px' }}
          />
          <div className="flex items-center justify-end px-4 pb-3">
            <button
              onClick={handleSubmit}
              disabled={!question.trim() || loading}
              className="bg-black text-white px-6 py-2 text-sm font-semibold tracking-tight disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
            >
              {loading ? 'Getting your answer...' : 'Ask Elijah →'}
            </button>
          </div>
        </div>

        {/* Weekly tip */}
        <div className="bg-black text-white p-8 mb-6">
          <p className="text-xs text-gray-500 tracking-widest uppercase mb-3">This week&apos;s pro tip</p>
          <p className="font-semibold leading-relaxed">
            The night before a game, stop reviewing film after 8pm. Let your brain consolidate. Your preparation is done — trust it.
          </p>
          <p className="text-xs text-gray-500 mt-4">— Elijah</p>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/library" className="border border-gray-100 p-5 hover:border-gray-300 transition-colors">
            <p className="font-semibold text-sm tracking-tight">Your playbook</p>
            <p className="text-xs text-gray-400 mt-1">Saved answers →</p>
          </Link>
          <Link href="/ask-directly" className="border border-gray-100 p-5 hover:border-gray-300 transition-colors">
            <p className="font-semibold text-sm tracking-tight">Ask Directly</p>
            <p className="text-xs text-gray-400 mt-1">Personal review →</p>
          </Link>
        </div>
      </main>

      {/* Mobile bottom nav is provided globally via <MobileBottomNav /> in
          app/layout.tsx — no duplicate bar needed here. */}
    </div>
  )
}
