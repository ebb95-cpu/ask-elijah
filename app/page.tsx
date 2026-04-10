'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

function Logo({ dark = false }: { dark?: boolean }) {
  const c = dark ? '#fff' : '#000'
  return (
    <svg width="52" height="8" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill={c} />
      <line x1="8" y1="4" x2="20" y2="4" stroke={c} strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill={c} />
      <line x1="28" y1="4" x2="40" y2="4" stroke={c} strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill={c} />
    </svg>
  )
}

const SUGGESTIONS = [
  "I freeze up in real games but ball out in practice",
  "How do I get my confidence back after a bad game?",
  "My coach keeps benching me and won't tell me why",
  "Is it too late for me to go D1?",
  "How do I stop overthinking on the court?",
  "Night before a big game",
  "How do I get out of a shooting slump?",
  "I'm scared to take shots when it matters",
]

export default function HomePage() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = () => {
    if (!question.trim() || loading) return
    setLoading(true)
    sessionStorage.setItem('pending_question', question.trim())
    router.push('/ask')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  return (
    <div className="flex flex-col min-h-screen bg-black">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5">
        <Logo dark />
        <div className="flex items-center gap-6">
          <Link href="/sign-in" className="text-sm text-gray-500 hover:text-white transition-colors">Sign in</Link>
          <Link href="/history" className="text-sm text-gray-500 hover:text-white transition-colors">My questions</Link>
        </div>
      </nav>

      {/* Hero — everything above the fold */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pb-16 text-center min-h-[calc(100vh-72px)]">

        {/* Credibility */}
        <p className="text-xs text-gray-600 tracking-widest uppercase mb-8 font-medium">
          20 years of pro experience · Euroleague · NBA
        </p>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-4 max-w-3xl text-white">
          You know how to train
          <br />your body.
        </h1>
        <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-10 max-w-3xl text-gray-500">
          Nobody taught you
          <br />how to train your mind.
        </h2>

        <p className="text-gray-600 text-base md:text-lg max-w-md leading-relaxed mb-10">
          Elijah Bryant did both. Ask him anything.
        </p>

        {/* Ask box */}
        <div className="w-full max-w-xl">
          <div className="border border-gray-700 focus-within:border-white transition-all bg-black">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKey}
              placeholder="What's going on in your head?"
              rows={3}
              className="w-full px-4 pt-4 pb-2 text-white placeholder-gray-600 text-base leading-relaxed resize-none outline-none bg-transparent"
              style={{ minHeight: '80px' }}
            />
            <div className="flex items-center justify-between px-4 pb-3">
              {question.length >= 140 && (
                <span className="text-xs text-gray-600">{question.length}</span>
              )}
              <button
                onClick={handleSubmit}
                disabled={!question.trim() || loading}
                className="ml-auto bg-white text-black px-6 py-2 text-sm font-semibold tracking-tight disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
              >
                {loading ? 'Getting your answer...' : 'Ask Elijah →'}
              </button>
            </div>
          </div>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {SUGGESTIONS.slice(0, 4).map((s) => (
              <button
                key={s}
                onClick={() => setQuestion(s)}
                className="text-xs border border-gray-800 px-3 py-1.5 text-gray-500 hover:border-gray-400 hover:text-gray-200 transition-colors text-left"
              >
                {s}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-700 mt-5">No account needed. First answer is free.</p>
        </div>
      </section>

      {/* Below fold — for the undecided */}
      <section className="bg-white px-6 py-24">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs text-gray-400 tracking-widest uppercase mb-8">The real problem</p>

          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-black leading-tight mb-10">
            Every coach has trained
            <br />your body.
            <br />
            <span className="text-gray-300">Nobody has trained your mind.</span>
          </h2>

          <div className="space-y-6 text-gray-500 text-lg leading-relaxed mb-12">
            <p>
              Every coach you&apos;ve ever had has focused on your shot, your footwork, your conditioning. That&apos;s what they know how to teach.
            </p>
            <p>
              Nobody has sat down with you and talked about what is actually happening in your head. The doubt before a big game. Losing confidence mid-series. Performing under pressure when everything is on the line.
            </p>
            <p className="text-black font-semibold text-xl">
              The game is 90% mental. Your training has been 90% physical. That is the gap.
            </p>
          </div>

          <div className="border-l-2 border-black pl-6 mb-14">
            <p className="text-gray-600 text-base leading-relaxed">
              Elijah has been in Euroleague finals. NBA locker rooms. High pressure moments most coaches have only watched on TV. Ask him what is going on in your head and what to do about it.
            </p>
          </div>

          {/* Second ask box for those who scrolled */}
          <div className="border border-black focus-within:border-2 transition-all">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKey}
              placeholder="What's actually going on in your head?"
              rows={3}
              className="w-full px-4 pt-4 pb-2 text-black placeholder-gray-300 text-lg leading-relaxed resize-none outline-none bg-transparent"
              style={{ minHeight: '80px' }}
            />
            <div className="flex items-center justify-between px-4 pb-3">
              <button
                onClick={handleSubmit}
                disabled={!question.trim() || loading}
                className="ml-auto bg-black text-white px-6 py-2 text-sm font-semibold tracking-tight disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
              >
                {loading ? 'Getting your answer...' : 'Ask Elijah for Free →'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {SUGGESTIONS.slice(4).map((s) => (
              <button
                key={s}
                onClick={() => setQuestion(s)}
                className="text-sm border border-gray-200 px-3 py-1.5 text-gray-400 hover:border-black hover:text-black transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-300 mt-4">No account needed. First answer is free.</p>
        </div>
      </section>

      {/* Social proof */}
      <section className="bg-black px-6 py-20 text-center">
        <blockquote className="max-w-2xl mx-auto mb-16">
          <p className="text-2xl md:text-3xl font-semibold italic tracking-tight text-white leading-snug mb-4">
            &ldquo;First time I felt like I was getting real advice, not just content.&rdquo;
          </p>
          <cite className="text-sm text-gray-500 not-italic">— CC Newsletter subscriber, age 17</cite>
        </blockquote>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px max-w-3xl mx-auto bg-gray-900">
          {[
            { title: "From Elijah's vault", sub: "His real protocols, not the internet's average answer" },
            { title: "Mental game included", sub: "The 90% nobody else is training" },
            { title: "Built on 20 years", sub: "Pro leagues across 3 continents" },
          ].map(({ title, sub }) => (
            <div key={title} className="bg-black text-white p-8">
              <p className="font-bold text-base tracking-tight mb-2">{title}</p>
              <p className="text-sm text-gray-500">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-gray-900 px-6 py-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-3">
            <Logo dark />
            <p className="text-xs text-gray-600">Built by Elijah Bryant. Consistency Club.</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-gray-600 hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="text-xs text-gray-600 hover:text-white transition-colors">Terms</Link>
            <Link href="mailto:hello@consistencyclub.com" className="text-xs text-gray-600 hover:text-white transition-colors">Contact</Link>
          </div>
          <p className="text-xs text-gray-700">© Consistency Club</p>
        </div>
      </footer>
    </div>
  )
}
