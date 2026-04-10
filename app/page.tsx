'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'

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

function ThinkingDots() {
  return (
    <>
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        .dot-pulse span {
          display: inline-block;
          width: 10px;
          height: 10px;
          margin: 0 5px;
          background: white;
          border-radius: 50%;
          animation: dotPulse 1.4s ease-in-out infinite;
        }
        .dot-pulse span:nth-child(2) { animation-delay: 0.2s; }
        .dot-pulse span:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
      <div className="dot-pulse flex items-center justify-center">
        <span /><span /><span />
      </div>
    </>
  )
}

const ACTIVITY_LOCATIONS = [
  'Athens, Greece', 'Istanbul, Turkey', 'Lagos, Nigeria', 'Tel Aviv, Israel',
  'Belgrade, Serbia', 'Houston, TX', 'Barcelona, Spain', 'Brooklyn, NY',
  'Nairobi, Kenya', 'Paris, France', 'Toronto, Canada', 'Manila, Philippines',
  'Chicago, IL', 'Thessaloniki, Greece', 'Accra, Ghana', 'Madrid, Spain',
  'Los Angeles, CA', 'Ankara, Turkey', 'Dubai, UAE', 'Atlanta, GA',
  'London, UK', 'Johannesburg, South Africa', 'Detroit, MI', 'Beirut, Lebanon',
  'Rome, Italy', 'Phoenix, AZ', 'Dakar, Senegal', 'Amsterdam, Netherlands', 'Memphis, TN',
]

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function LiveTicker() {
  const locations = useState(() => shuffled(ACTIVITY_LOCATIONS))[0]
  const [index, setIndex] = useState(0)
  const [count, setCount] = useState<number | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => setCount(d.count ?? 0))
      .catch(() => setCount(0))
  }, [])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    const cycle = () => {
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % locations.length)
        setVisible(true)
        timeout = setTimeout(cycle, 4000 + Math.random() * 5000)
      }, 500)
    }

    // Show first notification after 2–4s
    timeout = setTimeout(() => {
      setVisible(true)
      timeout = setTimeout(cycle, 4000 + Math.random() * 5000)
    }, 2000 + Math.random() * 2000)

    return () => clearTimeout(timeout)
  }, [locations])

  if (count === null) return null

  return (
    <>
      <style>{`
        @keyframes tickerSlide {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ticker-in { animation: tickerSlide 0.4s ease forwards; }
        .ticker-out { opacity: 0; transition: opacity 0.3s ease; }
      `}</style>
      <div className={`flex items-center gap-2 text-xs bg-gray-900 border border-gray-700 px-3 py-2.5 rounded-full ${visible ? 'ticker-in' : 'ticker-out'}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
        <span className="text-white font-semibold">{count.toLocaleString()}</span>
        <span className="text-gray-400">questions answered from</span>
        <span className="text-white font-medium">{locations[index]}</span>
      </div>
    </>
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

type Mode = 'idle' | 'loading' | 'preview' | 'email_gate' | 'submitted'

const PREVIEW_CHARS = 300 // how many chars to show before blur

export default function HomePage() {
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<Mode>('idle')
  const [streamedText, setStreamedText] = useState('')
  const [email, setEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const fullAnswerRef = useRef('')

  const handleSubmit = async () => {
    if (!question.trim() || mode !== 'idle') return
    setMode('loading')
    setStreamedText('')
    fullAnswerRef.current = ''

    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      })

      if (!res.ok || !res.body) {
        setMode('idle')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let modeSet = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        fullAnswerRef.current = accumulated
        setStreamedText(accumulated)

        // Switch from loading to preview once we have enough text
        if (!modeSet && accumulated.length > 80) {
          modeSet = true
          setMode('preview')
        }
      }

      setMode('preview')
    } catch {
      setMode('idle')
    }
  }

  const handleEmailSubmit = async () => {
    if (!email.trim() || !ageConfirmed || emailLoading) return
    setEmailLoading(true)

    try {
      await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          email: email.trim(),
          previewAnswer: fullAnswerRef.current,
        }),
      })
      setMode('submitted')
    } catch {
      // still show submitted — question was received
      setMode('submitted')
    } finally {
      setEmailLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const reset = () => {
    setMode('idle')
    setQuestion('')
    setStreamedText('')
    setEmail('')
    setAgeConfirmed(false)
    fullAnswerRef.current = ''
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <nav className="flex items-center justify-between px-6 py-5">
          <Logo dark />
          <div className="flex items-center gap-6">
            <Link href="/sign-in" className="text-sm text-gray-500 hover:text-white transition-colors">Sign in</Link>
            <Link href="/history" className="text-sm text-gray-500 hover:text-white transition-colors">My questions</Link>
          </div>
        </nav>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8">
          <ThinkingDots />
          <div>
            <p className="text-white text-lg font-semibold mb-1">Elijah is thinking...</p>
            <p className="text-gray-600 text-sm">Pulling from 20 years of pro experience</p>
          </div>
          <div className="border border-gray-800 px-6 py-4 max-w-sm w-full text-left">
            <p className="text-gray-600 text-xs uppercase tracking-widest mb-2">Your question</p>
            <p className="text-gray-400 text-sm italic">&ldquo;{question}&rdquo;</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Preview + email gate ───────────────────────────────────────────────────
  if (mode === 'preview' || mode === 'email_gate') {
    const visibleText = streamedText.slice(0, PREVIEW_CHARS)
    const hiddenText = streamedText.slice(PREVIEW_CHARS)
    const isDone = streamedText.length > 0

    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <nav className="flex items-center justify-between px-6 py-5">
          <button onClick={reset} className="text-gray-500 hover:text-white text-sm transition-colors">← Back</button>
          <Logo dark />
          <div className="w-16" />
        </nav>

        <div className="flex-1 flex flex-col items-center px-6 py-10 max-w-xl mx-auto w-full">
          {/* Question */}
          <div className="w-full mb-8">
            <p className="text-gray-600 text-xs uppercase tracking-widest mb-2">Your question</p>
            <p className="text-gray-300 text-base italic">&ldquo;{question}&rdquo;</p>
          </div>

          {/* Answer */}
          <div className="w-full relative">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-4">Elijah says</p>

            {/* Visible part */}
            <div className="text-white text-base leading-relaxed">
              {visibleText}
              {!isDone && <span className="inline-block w-1 h-4 bg-white ml-1 animate-pulse" />}
            </div>

            {/* Blurred part + gate */}
            {hiddenText && (
              <div className="relative mt-0">
                <div
                  className="text-white text-base leading-relaxed select-none pointer-events-none"
                  style={{ filter: 'blur(6px)', opacity: 0.6, userSelect: 'none' }}
                >
                  {hiddenText}
                </div>

                {/* Email gate overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-black via-black/90 to-transparent pt-8">
                  <p className="text-white font-semibold text-lg mb-1 text-center">Get the full answer</p>
                  <p className="text-gray-500 text-sm mb-6 text-center">Enter your email and Elijah will send it to you</p>

                  <div className="w-full max-w-xs flex flex-col gap-3">
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEmailSubmit() }}
                      className="w-full px-4 py-3 bg-transparent border border-gray-700 text-white placeholder-gray-600 outline-none focus:border-white transition-colors text-sm"
                    />
                    <label className="flex items-start gap-2 text-xs text-gray-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ageConfirmed}
                        onChange={e => setAgeConfirmed(e.target.checked)}
                        className="mt-0.5 accent-white"
                      />
                      I confirm I am 13 years of age or older
                    </label>
                    <button
                      onClick={handleEmailSubmit}
                      disabled={!email.trim() || !ageConfirmed || emailLoading}
                      className="w-full bg-white text-black py-3 text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
                    >
                      {emailLoading ? 'Sending...' : 'Send me the full answer →'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Submitted ──────────────────────────────────────────────────────────────
  if (mode === 'submitted') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <nav className="flex items-center justify-between px-6 py-5">
          <div className="w-16" />
          <Logo dark />
          <div className="w-16" />
        </nav>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8 max-w-sm mx-auto">
          <div className="w-2 h-2 bg-white rounded-full" />

          <div>
            <h2 className="text-3xl font-bold mb-3">Elijah got your question.</h2>
            <p className="text-gray-500 text-base leading-relaxed">
              The full answer is on its way to
            </p>
            <p className="text-white font-semibold mt-1 mb-6">{email}</p>
          </div>

          {/* Beta message */}
          <div className="border border-gray-800 px-6 py-5 text-left w-full">
            <p className="text-gray-500 text-sm leading-relaxed">
              Since we&apos;re in beta, we personally verify every question and answer before it reaches you. Bear with us —{' '}
              <span className="text-white">we&apos;re connecting the dots.</span>
            </p>
          </div>

          <div className="border-l-2 border-gray-800 pl-4 text-left w-full">
            <p className="text-gray-600 text-sm italic">&ldquo;{question}&rdquo;</p>
          </div>

          <button
            onClick={reset}
            className="text-sm text-gray-600 hover:text-white transition-colors"
          >
            Ask another question
          </button>
        </div>
      </div>
    )
  }

  // ── Idle (homepage) ────────────────────────────────────────────────────────
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

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pb-16 text-center min-h-[calc(100vh-72px)]">
        <p className="text-xs text-gray-600 tracking-widest uppercase mb-8 font-medium">
          20 years of pro experience · Euroleague · NBA
        </p>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-4 max-w-3xl text-white">
          You know how to train
          <br />your body.
        </h1>
        <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-10 max-w-3xl text-gray-500">
          Nobody taught you
          <br />how to train your mind.
        </h2>

        <div className="w-full max-w-xl mt-10">
          <div className="border-b border-gray-700 focus-within:border-white transition-all bg-black">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKey}
              placeholder="What's going on in your head?"
              rows={3}
              className="w-full px-0 pt-4 pb-2 text-white placeholder-gray-600 text-base leading-relaxed resize-none outline-none bg-transparent"
              style={{ minHeight: '80px' }}
            />
            <div className="flex items-center justify-between px-4 pb-3">
              {question.length >= 140 && (
                <span className="text-xs text-gray-600">{question.length}</span>
              )}
              <button
                onClick={handleSubmit}
                disabled={!question.trim()}
                className="ml-auto bg-white text-black px-6 py-2 text-sm font-semibold tracking-tight disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
              >
                Ask Elijah →
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-2 mt-4 justify-center items-center">
            {SUGGESTIONS.slice(0, 4).map((s, i) => (
              <span key={s} className="flex items-center gap-3">
                <button
                  onClick={() => setQuestion(s)}
                  className="text-xs text-gray-600 hover:text-gray-200 transition-colors"
                >
                  {s}
                </button>
                {i < 3 && <span className="text-gray-800 text-xs">·</span>}
              </span>
            ))}
          </div>

        </div>
      </section>

      {/* Fixed live ticker — bottom left */}
      <div className="fixed bottom-6 left-6 z-50">
        <LiveTicker />
      </div>

      {/* Below fold */}
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

          <div className="flex flex-wrap gap-x-3 gap-y-2 items-center">
            {SUGGESTIONS.slice(4).map((s, i) => (
              <span key={s} className="flex items-center gap-3">
                <button
                  onClick={() => { setQuestion(s); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="text-sm text-gray-400 hover:text-black transition-colors"
                >
                  {s}
                </button>
                {i < SUGGESTIONS.slice(4).length - 1 && <span className="text-gray-300 text-xs">·</span>}
              </span>
            ))}
          </div>
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
