'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { getLocal, setLocal } from '@/lib/safe-storage'

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

function LoadingLogo() {
  return (
    <>
      <svg width="130" height="20" viewBox="0 0 52 8" fill="none">
        {/* Dots always visible */}
        <circle cx="4"  cy="4" r="4" fill="white" />
        <circle cx="24" cy="4" r="4" fill="white" />
        <circle cx="44" cy="4" r="4" fill="white" />
        {/* Lines draw in: left segment first, then right */}
        <line className="seg-left"  x1="8" y1="4" x2="20" y2="4" stroke="white" strokeWidth="1.5" />
        <line className="seg-right" x1="28" y1="4" x2="40" y2="4" stroke="white" strokeWidth="1.5" />
      </svg>
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
      <div className={`flex items-center gap-2 text-xs bg-gray-900 border border-gray-700 px-3 py-2.5 rounded-full ${visible ? 'ticker-in' : 'ticker-out'}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
        <span className="text-white font-semibold">{count.toLocaleString()}</span>
        <span className="text-gray-400">{count === 1 ? 'question' : 'questions'} answered from</span>
        <span className="text-white font-medium">{locations[index]}</span>
      </div>
    </>
  )
}

const PLACEHOLDERS = [
  "What's the one thing costing you right now?",
  "¿Qué es lo que más te está costando?",
  "Τι είναι αυτό που σε κοστίζει τώρα;",
  "Šta te košta najviše u ovom trenutku?",
  "מה הדבר שהכי עולה לך עכשיו?",
  "Кое е нещото, което те коства сега?",
  "Quelle est la chose qui te coûte le plus?",
  "Ano ang isang bagay na nagpapahirap sa iyo?",
]

const ALL_SUGGESTIONS = [
  "I freeze up in real games but ball out in practice",
  "How do I get my confidence back after a bad streak?",
  "My coach keeps benching me and won't tell me why",
  "Is it too late for me to go D1?",
  "How do I stop overthinking on the court?",
  "I can't sleep the night before a big game",
  "How do I get out of a shooting slump?",
  "I'm scared to take big shots when it matters",
  "I work harder than everyone but I'm still not starting",
  "I lost my passion for the game",
  "How do I handle being moved to a new position?",
  "My teammates don't believe in me",
]

// Rotation used to depend on `new Date().getDate()` at module load, which
// evaluates once at SSR build time and again on client, causing hydration
// mismatches at day-rollover and crashing mobile Safari. Static list now —
// the page is pre-rendered, so date-based rotation never worked in prod
// anyway (the value was frozen to the deploy date).
const SUGGESTIONS = ALL_SUGGESTIONS

function ReturningView({
  question, setQuestion, handleKey, handleSubmit, resetToHome, prevQuestion, prevAnswer, userEmail, memories
}: {
  question: string
  setQuestion: (v: string) => void
  handleKey: (e: React.KeyboardEvent) => void
  handleSubmit: () => void
  resetToHome: () => void
  prevQuestion: string
  prevAnswer: string
  userEmail: string
  memories: { fact_type: string; fact_text: string; expires_at: string | null }[]
}) {
  const [showPrev, setShowPrev] = useState(false)
  const [reflection, setReflection] = useState('')
  const [reflectionDone, setReflectionDone] = useState(false)

  // Find the most recent event memory to personalize the reflection prompt
  const eventMemory = memories.find(m => m.fact_type === 'event')

  const submitReflection = async (text: string) => {
    setReflectionDone(true)
    if (text.trim()) {
      fetch('/api/reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, text }),
      }).catch(() => {})
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <nav className="flex items-center justify-between px-5 py-5">
        <Logo dark />
        <div className="flex items-center gap-5">
          {prevQuestion && (
            <button
              onClick={() => setShowPrev(v => !v)}
              className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
            >
              {showPrev ? 'Hide previous' : 'See previous answer'}
            </button>
          )}
          <button onClick={resetToHome} className="text-xs text-gray-700 hover:text-gray-400 transition-colors">Home</button>
        </div>
      </nav>

      {/* Previous Q&A — slides in when toggled */}
      {showPrev && (
        <div className="px-5 py-6 max-w-xl mx-auto w-full border-b border-gray-900 overflow-y-auto max-h-[45vh]">
          <p className="text-gray-600 text-xs italic mb-3">&ldquo;{prevQuestion}&rdquo;</p>
          <p className="text-gray-500 text-sm leading-relaxed">{prevAnswer}</p>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-5 max-w-xl mx-auto w-full gap-10">

        {/* Reflection prompt — show once, before ask box */}
        {!reflectionDone && prevQuestion && (
          <div className="w-full">
            <p className="text-gray-600 text-xs uppercase tracking-widest mb-3">How did it go?</p>
            <p className="text-gray-500 text-sm mb-4">
              {eventMemory
                ? `${eventMemory.fact_text}. How did it go?`
                : `Last time you asked about "${prevQuestion.slice(0, 60)}${prevQuestion.length > 60 ? '...' : ''}". What happened when you tried it?`
              }
            </p>
            <input
              type="text"
              value={reflection}
              onChange={e => setReflection(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitReflection(reflection) }}
              placeholder="What worked, what didn't..."
              autoFocus
              className="w-full bg-transparent border-b border-gray-800 focus:border-gray-600 text-white placeholder-gray-700 text-sm outline-none pb-2 transition-colors"
            />
            <div className="flex items-center justify-between mt-3">
              <button onClick={() => submitReflection('')} className="text-xs text-gray-700 hover:text-gray-500 transition-colors">Skip</button>
              <button
                onClick={() => submitReflection(reflection)}
                disabled={!reflection.trim()}
                className="text-xs text-white disabled:text-gray-700 hover:opacity-70 transition-all font-medium"
              >
                Save & continue →
              </button>
            </div>
          </div>
        )}

        {/* Ask input */}
        {(reflectionDone || !prevQuestion) && (
          <div className="w-full">
            {reflectionDone && (
              <p className="text-gray-600 text-xs uppercase tracking-widest mb-4">Good. Now go deeper.</p>
            )}
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKey}
              placeholder={reflectionDone ? "What's the next thing holding you back?" : "I'm here when you're ready."}
              rows={3}
              autoFocus
              className="w-full text-white placeholder-gray-700 text-lg sm:text-xl leading-relaxed resize-none outline-none bg-transparent border-b border-gray-800 focus:border-gray-600 transition-colors pb-3"
              style={{ minHeight: '80px' }}
            />
            <div className="flex justify-end w-full mt-4">
              <button
                onClick={handleSubmit}
                disabled={!question.trim()}
                className="text-sm font-semibold text-white disabled:text-gray-800 disabled:cursor-not-allowed hover:opacity-70 transition-all"
              >
                Ask →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type Mode = 'idle' | 'returning' | 'loading' | 'preview' | 'email_gate' | 'submitted'

const PREVIEW_CHARS = 300 // how many chars to show before blur

export default function HomePage() {
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<Mode>('idle')
  const [streamedText, setStreamedText] = useState('')
  const [email, setEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [newsletterOptIn, setNewsletterOptIn] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const fullAnswerRef = useRef('')
  const prevQuestionRef = useRef('')
  const prevAnswerRef = useRef('')
  const userEmailRef = useRef('')
  const profileRef = useRef<Record<string, string> | null>(null)
  const memoriesRef = useRef<{ fact_type: string; fact_text: string; expires_at: string | null }[]>([])
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [placeholderFade, setPlaceholderFade] = useState(true)

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderFade(false)
      setTimeout(() => {
        setPlaceholderIndex(i => (i + 1) % PLACEHOLDERS.length)
        setPlaceholderFade(true)
      }, 300)
    }, 3500)
    return () => clearInterval(id)
  }, [])

  // Capture UTM params once on landing and persist them. Safari throws
  // SecurityError on storage access when cookies are blocked or in some
  // private-browsing states — the safe-storage helper swallows that so it
  // can't crash the page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const utm = {
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
    }
    if (utm.utm_source || utm.utm_medium || utm.utm_campaign) {
      setLocal('ask_elijah_utm', JSON.stringify(utm))
    }
  }, [])

  useEffect(() => {
    const stored = getLocal('ask_elijah_email')
    if (stored) {
      userEmailRef.current = stored
      Promise.all([
        fetch(`/api/profile?email=${encodeURIComponent(stored)}`).then(r => r.json()).catch(() => null),
        fetch(`/api/memories?email=${encodeURIComponent(stored)}`).then(r => r.json()).catch(() => null),
      ]).then(([profile, mem]) => {
        if (profile?.position || profile?.level) profileRef.current = profile
        if (mem?.memories?.length) memoriesRef.current = mem.memories
      })
    }
  }, [])

  const handleSubmit = async () => {
    if (!question.trim() || (mode !== 'idle' && mode !== 'returning')) return
    setMode('loading')
    setStreamedText('')
    fullAnswerRef.current = ''

    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), profile: profileRef.current, memories: memoriesRef.current }),
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
    setEmailError('')
    setEmailLoading(true)

    try {
      // Verify the email is real BEFORE we commit the question to the DB
      // and notify Elijah. Kickbox-backed syntax + disposable + MX + mailbox
      // check. Fails open on upstream errors — see lib/email-verify.ts.
      const verifyRes = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const verifyData = await verifyRes.json().catch(() => ({ ok: false, reason: 'Could not verify email. Try again.' }))
      if (!verifyRes.ok || !verifyData?.ok) {
        setEmailError(verifyData?.reason || 'That email doesn\'t look right. Double-check it.')
        setEmailLoading(false)
        return
      }

      let utm: Record<string, unknown> = {}
      try {
        utm = JSON.parse(getLocal('ask_elijah_utm') || '{}')
      } catch {
        // Bad JSON — fine, just no UTM.
      }
      await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          email: email.trim(),
          previewAnswer: fullAnswerRef.current,
          newsletterOptIn: true,
          ...utm,
        }),
      })
      prevQuestionRef.current = question.trim()
      prevAnswerRef.current = fullAnswerRef.current
      userEmailRef.current = email.trim()
      setLocal('ask_elijah_email', email.trim())
      // Unblur the answer in-place instead of jumping to a success screen —
      // the player sees the full thing they unlocked, with a small confirmation
      // that Elijah's personal reply is on the way.
      setRevealed(true)
    } catch {
      // Network error after verification passed — still reveal so they see
      // what they paid for with their email. Elijah-notify will retry via
      // whatever mechanism eventually catches the failure.
      setRevealed(true)
    } finally {
      setEmailLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const reset = () => {
    if (prevQuestionRef.current) {
      setMode('returning')
    } else {
      setMode('idle')
    }
    setQuestion('')
    setStreamedText('')
    setEmail('')
    setAgeConfirmed(false)
    setRevealed(false)
    setEmailError('')
    fullAnswerRef.current = ''
  }

  const resetToHome = () => {
    prevQuestionRef.current = ''
    prevAnswerRef.current = ''
    setMode('idle')
    setQuestion('')
    setStreamedText('')
    setEmail('')
    setAgeConfirmed(false)
    setRevealed(false)
    setEmailError('')
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
          <LoadingLogo />
          <div>
            <p className="text-white text-lg font-semibold mb-1">Elijah is thinking...</p>
            <p className="text-gray-600 text-sm">Pulling from 20 years of pro experience</p>
          </div>
          <div className="border border-gray-800 px-5 py-4 max-w-sm w-full text-left mx-4">
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

        <div className="flex-1 flex flex-col items-center px-5 py-8 max-w-xl mx-auto w-full">
          {/* Question */}
          <div className="w-full mb-8">
            <p className="text-gray-600 text-xs uppercase tracking-widest mb-2">Your question</p>
            <p className="text-gray-300 text-base italic">&ldquo;{question}&rdquo;</p>
          </div>

          {/* Answer */}
          <div className="w-full">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-4">Elijah says</p>

            {revealed ? (
              // Full answer, unblurred. Shown after email verification succeeds.
              <div className="text-white text-base leading-relaxed mb-6 whitespace-pre-wrap">
                {streamedText}
              </div>
            ) : (
              <>
                {/* Visible part */}
                <div className="text-white text-base leading-relaxed mb-2">
                  {visibleText}
                  {!isDone && <span className="inline-block w-1 h-4 bg-white ml-1 animate-pulse" />}
                </div>

                {/* Blurred fade — no overlay, just visual hint there's more */}
                {hiddenText && (
                  <div
                    className="text-white text-base leading-relaxed select-none pointer-events-none mb-6"
                    style={{
                      maskImage: 'linear-gradient(to bottom, rgba(255,255,255,0.5) 0%, transparent 80%)',
                      WebkitMaskImage: 'linear-gradient(to bottom, rgba(255,255,255,0.5) 0%, transparent 80%)',
                      filter: 'blur(5px)',
                      maxHeight: '80px',
                      overflow: 'hidden',
                    }}
                  >
                    {hiddenText}
                  </div>
                )}
              </>
            )}

            {/* Email gate — stacked below. Hidden once revealed. */}
            {hiddenText && !revealed && (
              <div className="w-full border-t border-gray-800 pt-6 flex flex-col gap-3">
                <p className="text-white font-semibold text-base">Get Elijah's answer</p>
                <p className="text-gray-500 text-sm leading-relaxed">You'll also be joined to the Consistency Club, his weekly newsletter on building your Faith + Consistency on and off the court.</p>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (emailError) setEmailError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') handleEmailSubmit() }}
                  className={`w-full px-4 py-3 bg-transparent border ${emailError ? 'border-red-500' : 'border-gray-700 focus:border-white'} text-white placeholder-gray-600 outline-none transition-colors text-sm`}
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
                {emailError && (
                  <p className="text-red-400 text-xs">{emailError}</p>
                )}
                <button
                  onClick={handleEmailSubmit}
                  disabled={!email.trim() || !ageConfirmed || emailLoading}
                  className="w-full bg-white text-black py-3 text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
                >
                  {emailLoading ? 'Verifying...' : 'Get my answer →'}
                </button>
              </div>
            )}

            {/* Post-reveal confirmation — answer is now fully visible above. */}
            {revealed && (
              <div className="w-full border-t border-gray-800 pt-6 flex flex-col gap-3">
                <p className="text-white font-semibold text-base">Elijah is writing you personally.</p>
                <p className="text-gray-500 text-sm leading-relaxed">The version above is a first take. Elijah reviews every one. When he sends his personal reply, it'll land in your inbox.</p>
                <a href="/history" className="text-sm font-semibold text-white hover:opacity-70 transition-opacity mt-2">
                  Track your question →
                </a>
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
        <div className="flex-1 flex flex-col items-center justify-center px-5 text-center gap-6 max-w-sm mx-auto">
          <div>
            <h2 className="text-3xl font-bold mb-2">Elijah got your question.</h2>
            <p className="text-gray-500 text-base leading-relaxed mt-4">He reads every one personally.</p>
            <p className="text-gray-500 text-base leading-relaxed">When he writes back, it&apos;ll be in your inbox.</p>
          </div>

          <div className="border-l-2 border-gray-800 pl-4 text-left w-full">
            <p className="text-gray-600 text-sm italic">&ldquo;{question}&rdquo;</p>
          </div>

          <a href="/history" className="text-sm font-semibold text-white hover:opacity-70 transition-opacity">
            Track your question →
          </a>
        </div>
      </div>
    )
  }

  // ── Returning (ask again — clean, no distractions) ────────────────────────
  if (mode === 'returning') {
    return (
      <ReturningView
        question={question}
        setQuestion={setQuestion}
        handleKey={handleKey}
        handleSubmit={handleSubmit}
        resetToHome={resetToHome}
        prevQuestion={prevQuestionRef.current}
        prevAnswer={prevAnswerRef.current}
        userEmail={userEmailRef.current}
        memories={memoriesRef.current}
      />
    )
  }

  // ── Idle (homepage) ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-black">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <Logo dark />
        </div>
        <div className="flex items-center gap-6">
          <Link href="/browse" className="text-sm text-gray-500 hover:text-white transition-colors">Browse</Link>
          {userEmailRef.current ? (
            <Link href="/history" className="text-sm text-white font-semibold hover:opacity-70 transition-opacity">My questions →</Link>
          ) : (
            <Link href="/sign-in" className="text-sm text-gray-500 hover:text-white transition-colors">Sign in</Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-5 pb-24 text-center min-h-[calc(100vh-72px)]">

        {/* Above-fold credential */}
        <div className="flex items-center gap-3 mb-8">
          <p className="text-xs text-gray-500 tracking-widest uppercase">
            NBA &middot; EuroLeague Champion
          </p>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-3 max-w-3xl text-white">
          You know how to train
          <br />your body.
        </h1>
        <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-10 max-w-3xl text-gray-500">
          Nobody taught you
          <br />how to train your mind.
        </h2>

        <div className="w-full max-w-xl mt-6">
          <div className="flex items-end gap-4 border-b border-gray-700 focus-within:border-gray-400 transition-colors pb-3">
            <div className="relative flex-1">
              {!question && (
                <div
                  className="absolute top-0 left-0 pointer-events-none select-none text-gray-500 text-base sm:text-lg leading-relaxed"
                  style={{ opacity: placeholderFade ? 1 : 0, transition: 'opacity 0.3s ease' }}
                >
                  {PLACEHOLDERS[placeholderIndex]}
                </div>
              )}
              <textarea
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value)
                  // Auto-grow so long questions stay fully visible as the user types.
                  const el = e.target
                  el.style.height = 'auto'
                  el.style.height = `${el.scrollHeight}px`
                }}
                onKeyDown={handleKey}
                placeholder=""
                rows={1}
                autoFocus
                className="w-full text-white text-base sm:text-lg leading-relaxed resize-none outline-none bg-transparent overflow-hidden"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!question.trim()}
              className="text-sm font-semibold text-white disabled:text-gray-700 disabled:cursor-not-allowed hover:opacity-70 transition-all flex-shrink-0"
            >
              Ask →
            </button>
          </div>
        </div>
      </section>

      {/* Fixed live ticker — bottom left, smaller on mobile */}
      <div className="fixed bottom-4 left-4 z-50 max-w-[calc(100vw-2rem)]">
        <LiveTicker />
      </div>

      {/* Sample answer preview */}
      <section className="bg-black px-5 py-14 border-t border-gray-900">
        <div className="max-w-xl mx-auto">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">Here&apos;s what I told a player last week →</p>
          <div className="relative">
            <p className="text-gray-300 text-base leading-relaxed">
              &ldquo;The freeze-up in games but not practice is almost always one thing: your brain is trying to protect you from judgment. In practice there&apos;s no scoreboard. In games there is. So it switches into threat mode. Cortisol spikes, your body tightens, your instincts shut down...&rdquo;
            </p>
            <div
              className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
              style={{ background: 'linear-gradient(to bottom, transparent, #000)' }}
            />
          </div>
          <button
            onClick={() => (document.querySelector('textarea') as HTMLTextAreaElement | null)?.focus()}
            className="mt-6 text-xs text-gray-500 hover:text-white transition-colors"
          >
            Ask your version →
          </button>
        </div>
      </section>

      {/* Below fold */}
      <section className="bg-[#F7F5F0] px-5 py-16 md:py-20">
        <div className="max-w-2xl mx-auto">

          <div className="border-l-4 border-black pl-6 my-10">
            <p className="text-black font-bold text-2xl md:text-4xl leading-tight tracking-tight">
              The game is 90% mental.<br />Your training has been 90% physical.<br />
              <span className="text-gray-400">That is the gap.</span>
            </p>
          </div>

          <div className="bg-black text-white px-8 py-8">
            <p className="text-white text-base md:text-lg leading-relaxed mb-4">
              Elijah has been in EuroLeague finals. NBA locker rooms. High-pressure moments most coaches have only watched on TV. Ask him what&apos;s going on in your head, and what to do about it.
            </p>
            <p className="text-gray-400 text-xs font-semibold tracking-widest uppercase">
              NBA · EuroLeague Champion · 3 continents
            </p>
          </div>

        </div>
      </section>

      {/* Social proof */}
      <section className="bg-black px-6 py-20 text-center">
        <blockquote className="max-w-2xl mx-auto mb-16">
          <p className="text-2xl md:text-3xl font-semibold italic tracking-tight text-white leading-snug mb-4">
            &ldquo;First time I felt like I was getting real advice, not just content.&rdquo;
          </p>
          <cite className="text-sm text-gray-500 not-italic">Marcus, 17, Chicago</cite>
        </blockquote>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px max-w-2xl mx-auto bg-gray-900">
          {[
            { title: "He reads every one.", sub: "Elijah reads it. Elijah writes back." },
            { title: "NBA. EuroLeague finals. 3 continents.", sub: "Advice from inside the arena, not from the stands." },
          ].map(({ title, sub }) => (
            <div key={title} className="bg-black text-white p-8">
              <p className="font-bold text-base tracking-tight mb-2">{title}</p>
              <p className="text-sm text-gray-500">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Browse feed teaser */}
      <section className="bg-black border-t border-gray-900 px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-8">Questions Elijah has answered →</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SUGGESTIONS.slice(0, 3).map(s => (
              <Link key={s} href="/browse" className="border border-gray-800 p-5 hover:border-gray-600 transition-colors block">
                <p className="text-gray-400 text-sm italic">&ldquo;{s}&rdquo;</p>
              </Link>
            ))}
          </div>
          <Link href="/browse" className="mt-6 inline-block text-xs text-gray-600 hover:text-white transition-colors">
            Browse all answers →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-gray-900 px-6 py-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-3">
            <Logo dark />
            <p className="text-xs text-gray-600">Built by Elijah Bryant · NBA · EuroLeague Champion</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-gray-600 hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="text-xs text-gray-600 hover:text-white transition-colors">Terms</Link>
            <Link href="mailto:hello@elijahbryant.pro" className="text-xs text-gray-600 hover:text-white transition-colors">Contact</Link>
          </div>
          <p className="text-xs text-gray-700">© Ask Elijah</p>
        </div>
      </footer>
    </div>
  )
}
