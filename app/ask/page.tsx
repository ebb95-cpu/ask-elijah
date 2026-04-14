'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase-client'
import { usePostHog } from 'posthog-js/react'

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
      <div className="dot-pulse">
        <span /><span /><span />
      </div>
    </>
  )
}

const SUGGESTIONS = [
  "I freeze up in real games but ball out in practice",
  "How do I get my confidence back after a bad game?",
  "My coach keeps benching me and won't tell me why",
  "How do I stop overthinking on the court?",
  "Night before a big game",
  "How do I get out of a shooting slump?",
]

const GOAL_OPTIONS = [
  "Make the starting lineup",
  "Get a college scholarship",
  "Play pro in Europe",
  "Make the NBA",
  "Improve my scoring average",
  "Get more minutes",
  "Master the mental game",
  "Come back from injury",
  "Make varsity",
  "Improve my athleticism",
]

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']

const LEVELS = [
  { value: 'middle_school', label: 'Middle School' },
  { value: 'high_school', label: 'High School' },
  { value: 'college', label: 'College' },
  { value: 'pro', label: 'Pro' },
  { value: 'recreational', label: 'Recreational' },
]

const STRUGGLES = [
  "Confidence and mental game",
  "Getting more minutes",
  "Performing under pressure",
  "Recovery and staying healthy",
  "Nutrition and energy",
  "Breaking into the starting lineup",
  "Getting recruited",
  "Dealing with a tough coach",
]

type Mode = 'input' | 'email_gate' | 'loading' | 'onboarding' | 'submitted' | 'returning' | 'upvote_prompt' | 'beta_full'

type JournalEntry = {
  id: string
  question: string
  answer: string
  action_steps: string | null
  answered_at: string
  reflection: { text: string; created_at: string } | null
}

const TOTAL_CARDS = 7

function ProfileModal({
  onComplete,
  onSkip,
  pendingQuestion,
}: {
  onComplete: (profile: Record<string, unknown>) => void
  onSkip: () => void
  pendingQuestion: string
}) {
  const [card, setCard] = useState(0)
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [position, setPosition] = useState('')
  const [level, setLevel] = useState('')
  const [struggle, setStruggle] = useState('')
  const [goals, setGoals] = useState<string[]>([])
  const [customGoal, setCustomGoal] = useState('')

  const toggleGoal = (g: string) =>
    setGoals((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])

  const next = () => setCard((c) => Math.min(c + 1, TOTAL_CARDS - 1))

  const finish = () => {
    onComplete({ name, age, position, level, struggle, goals, customGoal })
  }

  const progress = ((card + 1) / TOTAL_CARDS) * 100

  return (
    <div className="fixed inset-0 bg-black text-white z-50 flex flex-col">
      <div className="h-0.5 bg-gray-800 w-full">
        <div
          className="h-full bg-white transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-lg mx-auto w-full">

        {card === 0 && (
          <div className="w-full text-center">
            <p className="text-xs text-gray-600 tracking-widest uppercase mb-6">Before you ask again</p>
            <h2 className="text-3xl font-bold mb-2">What should Elijah call you?</h2>
            <p className="text-gray-600 text-sm mb-10">He wants to know who he is talking to.</p>
            <input
              autoFocus
              type="text"
              placeholder="First name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && next()}
              className="w-full bg-transparent border-b border-gray-700 focus:border-white pb-3 text-2xl text-center text-white placeholder-gray-700 outline-none transition-colors mb-10"
            />
            <button
              onClick={next}
              disabled={!name.trim()}
              className="bg-white text-black px-10 py-3 text-sm font-semibold disabled:opacity-20 hover:opacity-80 transition-opacity"
            >
              Next →
            </button>
          </div>
        )}

        {card === 1 && (
          <div className="w-full text-center">
            <h2 className="text-3xl font-bold mb-2">How old are you, {name}?</h2>
            <p className="text-gray-600 text-sm mb-10">Helps Elijah give you advice that is right for where you are.</p>
            <input
              autoFocus
              type="number"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && age && parseInt(age) >= 13 && next()}
              className="w-32 bg-transparent border-b border-gray-700 focus:border-white pb-3 text-4xl text-center text-white placeholder-gray-700 outline-none transition-colors mb-4 mx-auto block"
            />
            {age && parseInt(age) < 13 && (
              <p className="text-yellow-500 text-xs mb-6 leading-relaxed max-w-xs mx-auto">
                Ask the Pro is for users 13 and older. If you are under 13, please ask a parent or guardian to help you use this site.
              </p>
            )}
            {(!age || parseInt(age) >= 13) && <div className="mb-6" />}
            <div className="flex gap-3 justify-center">
              <button onClick={() => setCard((c) => c - 1)} className="text-gray-600 hover:text-white text-sm px-4">← Back</button>
              <button
                onClick={next}
                disabled={!age || parseInt(age) < 13}
                className="bg-white text-black px-10 py-3 text-sm font-semibold disabled:opacity-20 hover:opacity-80 transition-opacity"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {card === 2 && (
          <div className="w-full text-center">
            <h2 className="text-3xl font-bold mb-2">What position do you play?</h2>
            <p className="text-gray-600 text-sm mb-10">Tap one.</p>
            <div className="flex gap-3 justify-center flex-wrap mb-10">
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => { setPosition(pos); setTimeout(next, 200) }}
                  className={`w-16 h-16 text-lg font-bold border-2 transition-all duration-150 ${
                    position === pos
                      ? 'bg-white text-black border-white scale-110'
                      : 'border-gray-700 text-gray-400 hover:border-white hover:text-white'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setCard((c) => c - 1)} className="text-gray-600 hover:text-white text-sm px-4">← Back</button>
              <button onClick={next} className="text-gray-600 hover:text-white text-sm">Skip →</button>
            </div>
          </div>
        )}

        {card === 3 && (
          <div className="w-full text-center">
            <h2 className="text-3xl font-bold mb-2">What level do you play at?</h2>
            <p className="text-gray-600 text-sm mb-10">Tap one.</p>
            <div className="flex flex-col gap-3 max-w-xs mx-auto mb-10">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => { setLevel(l.value); setTimeout(next, 200) }}
                  className={`py-3 px-6 text-sm font-semibold border transition-all duration-150 ${
                    level === l.value
                      ? 'bg-white text-black border-white'
                      : 'border-gray-700 text-gray-400 hover:border-white hover:text-white'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setCard((c) => c - 1)} className="text-gray-600 hover:text-white text-sm px-4">← Back</button>
              <button onClick={next} className="text-gray-600 hover:text-white text-sm">Skip →</button>
            </div>
          </div>
        )}

        {card === 4 && (
          <div className="w-full text-center">
            <h2 className="text-3xl font-bold mb-2">What is your biggest struggle right now?</h2>
            <p className="text-gray-600 text-sm mb-8">Tap one.</p>
            <div className="flex flex-wrap gap-2 justify-center mb-10">
              {STRUGGLES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setStruggle(s); setTimeout(next, 200) }}
                  className={`px-4 py-2 text-sm border transition-all duration-150 ${
                    struggle === s
                      ? 'bg-white text-black border-white'
                      : 'border-gray-700 text-gray-400 hover:border-white hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setCard((c) => c - 1)} className="text-gray-600 hover:text-white text-sm px-4">← Back</button>
              <button onClick={next} className="text-gray-600 hover:text-white text-sm">Skip →</button>
            </div>
          </div>
        )}

        {card === 5 && (
          <div className="w-full text-center">
            <h2 className="text-3xl font-bold mb-2">What are you working toward?</h2>
            <p className="text-gray-600 text-sm mb-8">Tap everything that applies.</p>
            <div className="flex flex-wrap gap-2 justify-center mb-10">
              {GOAL_OPTIONS.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGoal(g)}
                  className={`px-4 py-2 text-sm border transition-all duration-150 ${
                    goals.includes(g)
                      ? 'bg-white text-black border-white'
                      : 'border-gray-700 text-gray-400 hover:border-white hover:text-white'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setCard((c) => c - 1)} className="text-gray-600 hover:text-white text-sm px-4">← Back</button>
              <button
                onClick={next}
                className="bg-white text-black px-10 py-3 text-sm font-semibold hover:opacity-80 transition-opacity"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {card === 6 && (
          <div className="w-full text-center">
            <h2 className="text-3xl font-bold mb-2">Anything else you are working toward?</h2>
            <p className="text-gray-600 text-sm mb-10">Optional. In your own words.</p>
            <input
              autoFocus
              type="text"
              placeholder="Type it here..."
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && finish()}
              className="w-full bg-transparent border-b border-gray-700 focus:border-white pb-3 text-xl text-center text-white placeholder-gray-700 outline-none transition-colors mb-10"
            />
            <div className="flex gap-3 justify-center">
              <button onClick={() => setCard((c) => c - 1)} className="text-gray-600 hover:text-white text-sm px-4">← Back</button>
              <button
                onClick={finish}
                className="bg-white text-black px-10 py-3 text-sm font-semibold hover:opacity-80 transition-opacity"
              >
                Continue →
              </button>
            </div>
            <p className="text-xs text-gray-700 mt-4">
              Your question: &ldquo;{pendingQuestion}&rdquo;
            </p>
          </div>
        )}
      </div>

      <div className="text-center pb-8">
        <button onClick={onSkip} className="text-xs text-gray-700 hover:text-gray-500 transition-colors">
          Skip and just ask
        </button>
      </div>
    </div>
  )
}

function AskPageInner() {
  const [mode, setMode] = useState<Mode>('input')
  const [question, setQuestion] = useState('')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [showProfile, setShowProfile] = useState(false)
  const [pendingQ, setPendingQ] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [topQuestions, setTopQuestions] = useState<{ id: string; question: string; upvote_count: number }[]>([])
  const [returnEntry, setReturnEntry] = useState<JournalEntry | null>(null)
  const [draftAnswer, setDraftAnswer] = useState('')
  const [betaSpotsLeft, setBetaSpotsLeft] = useState<number | null>(null)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistName, setWaitlistName] = useState('')
  const [waitlistChallenge, setWaitlistChallenge] = useState('')
  const [waitlistDone, setWaitlistDone] = useState(false)
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [reflectionText, setReflectionText] = useState('')
  const [reflectionSubmitting, setReflectionSubmitting] = useState(false)
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())

  // Onboarding state
  const [onboardStep, setOnboardStep] = useState(0)
  const [onboardName, setOnboardName] = useState('')
  const [onboardPosition, setOnboardPosition] = useState('')
  const [onboardLevel, setOnboardLevel] = useState('')
  const [onboardChallenge, setOnboardChallenge] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  const posthog = usePostHog()
  const router = useRouter()
  const searchParams = useSearchParams()

  const detectedLang = typeof navigator !== 'undefined'
    ? navigator.language?.split('-')[0] || 'en'
    : 'en'

  useEffect(() => {
    getSupabaseClient().auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user)
      if (data.user?.email) setEmail(data.user.email)
    })
  }, [])

  useEffect(() => {
    const pending = sessionStorage.getItem('pending_question')
    if (pending) {
      sessionStorage.removeItem('pending_question')
      setQuestion(pending)
      setShowSuggestions(false)
    } else {
      const qParam = searchParams.get('q')
      if (qParam) {
        setQuestion(qParam)
        setShowSuggestions(false)
      } else {
        textareaRef.current?.focus()
      }
    }
  }, [])

  useEffect(() => {
    fetch('/api/browse')
      .then(r => r.json())
      .then(d => setTopQuestions((d.questions || []).slice(0, 6)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/beta-status')
      .then(r => r.json())
      .then(d => {
        if (d.isCapped) {
          setMode('beta_full')
          posthog?.capture('beta_cap_hit')
        } else if (d.spotsLeft !== null) {
          setBetaSpotsLeft(d.spotsLeft)
        }
      })
      .catch(() => {})
  }, [])

  // Returning user: check if they have an answered question with no reflection
  useEffect(() => {
    const storedEmail = localStorage.getItem('ask_elijah_email')
    const count = parseInt(localStorage.getItem('question_count') || '0', 10)
    if (!storedEmail || count === 0) return
    // Don't show return flow if they came with a pending question in session
    if (sessionStorage.getItem('pending_question')) return

    fetch(`/api/journal?email=${encodeURIComponent(storedEmail)}`)
      .then(r => r.json())
      .then(d => {
        const entries: JournalEntry[] = d.entries || []
        const needsReflection = entries.find(e => !e.reflection && e.action_steps)
        if (needsReflection) {
          setReturnEntry(needsReflection)
          setEmail(storedEmail)
          setMode('returning')
        }
      })
      .catch(() => {})
  }, [])

  // Track funnel step changes
  useEffect(() => {
    if (mode === 'submitted') posthog?.capture('question_confirmed')
    if (mode === 'email_gate') posthog?.capture('email_gate_shown')
    if (mode === 'returning') posthog?.capture('return_visit')
  }, [mode, posthog])

  const getQuestionCount = () =>
    parseInt(localStorage.getItem('question_count') || '0', 10)
  const incrementQuestionCount = () =>
    localStorage.setItem('question_count', String(getQuestionCount() + 1))
  const hasCompletedProfile = () =>
    !!localStorage.getItem('profile_done')

  // Step 1: question submitted → go to email gate
  const handleQuestionSubmit = () => {
    if (!question.trim()) return
    posthog?.capture('question_drafted', { question_length: question.trim().length })
    setMode('email_gate')
    setTimeout(() => emailRef.current?.focus(), 100)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuestionSubmit() }
  }

  // Step 2: email submitted → call API
  const handleEmailSubmit = async () => {
    if (!email.trim()) { setEmailError('Email is required to get your answer.'); return }
    if (!ageConfirmed) { setEmailError('Please confirm you are 13 or older.'); return }
    setEmailError('')
    posthog?.capture('email_submitted', { email: email.trim().toLowerCase() })
    posthog?.identify(email.trim().toLowerCase(), { email: email.trim().toLowerCase() })
    setMode('loading')
    incrementQuestionCount()
    sessionStorage.setItem('user_email', email.trim().toLowerCase())

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          email: email.trim().toLowerCase(),
          language: detectedLang,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setEmailError(data.error || 'Something went wrong.')
        setMode('email_gate')
        return
      }

      // Store draft answer to show immediately
      if (data.draft) setDraftAnswer(data.draft)

      // Route to onboarding if profile not done, otherwise straight to submitted
      posthog?.capture('question_sent')
      if (!hasCompletedProfile()) {
        setOnboardStep(0)
        setMode('onboarding')
      } else {
        setMode('submitted')
      }
    } catch {
      setEmailError('Something went wrong. Try again.')
      setMode('email_gate')
    }
  }

  const handleOnboardComplete = async (skip = false) => {
    localStorage.setItem('profile_done', '1')
    if (!skip && (onboardName || onboardPosition || onboardLevel || onboardChallenge)) {
      const savedEmail = sessionStorage.getItem('user_email') || email
      try {
        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: savedEmail,
            name: onboardName,
            position: onboardPosition,
            level: onboardLevel,
            challenge: onboardChallenge,
            language: detectedLang,
          }),
        })
      } catch { /* fail silently */ }
    }
    setMode('submitted')
  }

  const handleEmailKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleEmailSubmit()
  }

  const handleProfileComplete = async (profile: Record<string, unknown>) => {
    localStorage.setItem('profile_done', '1')
    const savedEmail = sessionStorage.getItem('user_email')
    if (savedEmail) {
      try {
        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: savedEmail, ...profile, language: detectedLang }),
        })
      } catch { /* fail silently */ }
    }
    setShowProfile(false)
    setMode('email_gate')
    setTimeout(() => emailRef.current?.focus(), 100)
  }

  const handleProfileSkip = () => {
    localStorage.setItem('profile_done', '1')
    setShowProfile(false)
    setMode('email_gate')
  }

  const handleAskAnother = () => {
    setMode('input')
    setQuestion('')
    setShowSuggestions(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handleReflectionSubmit = async () => {
    if (!reflectionText.trim() || !returnEntry) return
    setReflectionSubmitting(true)
    try {
      await fetch('/api/reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, question_id: returnEntry.id, text: reflectionText }),
      })
    } catch { /* fail silently */ }
    setReflectionSubmitting(false)
    setMode('upvote_prompt')
  }

  const handleUpvote = async (questionId: string) => {
    const newVoted = new Set(votedIds)
    if (newVoted.has(questionId)) {
      newVoted.delete(questionId)
    } else {
      newVoted.add(questionId)
    }
    setVotedIds(newVoted)
    try {
      await fetch('/api/upvote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: questionId, email }),
      })
    } catch { /* fail silently */ }
  }

  // Beta full — waitlist screen
  if (mode === 'beta_full') {
    const handleWaitlist = async () => {
      if (!waitlistEmail.trim() || !waitlistName.trim()) return
      setWaitlistLoading(true)
      try {
        await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: waitlistEmail.trim(),
            name: waitlistName.trim(),
            challenge: waitlistChallenge.trim(),
          }),
        })
        posthog?.capture('waitlist_joined', { email: waitlistEmail.trim().toLowerCase() })
        setWaitlistDone(true)
      } catch { /* fail silently */ }
      setWaitlistLoading(false)
    }

    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <nav className="flex items-center justify-between px-6 py-5">
          <div className="w-12" />
          <Logo dark />
          <div className="w-12" />
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <div className="w-full max-w-sm text-center">
            {!waitlistDone ? (
              <>
                <p className="text-xs text-gray-600 tracking-widest uppercase mb-6">Beta</p>
                <h1 className="text-3xl font-bold mb-4 leading-tight">Access is closed right now.</h1>
                <p className="text-gray-500 text-sm leading-relaxed mb-10">
                  Most players train their body every day and never once train their mind. That gap is why you freeze up, lose confidence, go blank under pressure. Every question goes to Elijah. He reads it, shapes the answer, sends it back. That takes real time so he controls who&apos;s in. Leave your name and what you&apos;re dealing with. When he opens it back up, you&apos;re first.
                </p>

                <div className="space-y-6 mb-8 text-left">
                  <div>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Your name"
                      value={waitlistName}
                      onChange={(e) => setWaitlistName(e.target.value)}
                      className="w-full bg-transparent border-b border-gray-700 focus:border-white pb-3 text-lg text-center text-white placeholder-gray-700 outline-none transition-colors block"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      className="w-full bg-transparent border-b border-gray-700 focus:border-white pb-3 text-lg text-center text-white placeholder-gray-700 outline-none transition-colors block"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="What are you working through right now?"
                      value={waitlistChallenge}
                      onChange={(e) => setWaitlistChallenge(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleWaitlist() }}
                      className="w-full bg-transparent border-b border-gray-700 focus:border-white pb-3 text-lg text-center text-white placeholder-gray-700 outline-none transition-colors block"
                    />
                  </div>
                </div>

                <button
                  onClick={handleWaitlist}
                  disabled={!waitlistEmail.trim() || !waitlistName.trim() || waitlistLoading}
                  className="w-full bg-white text-black py-3 text-sm font-semibold tracking-tight disabled:opacity-30 hover:opacity-80 transition-opacity"
                >
                  {waitlistLoading ? 'Saving...' : "I'm ready when you are →"}
                </button>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-white rounded-full mx-auto mb-10" />
                <h1 className="text-3xl font-bold mb-4">Check your email.</h1>
                <p className="text-gray-500 text-sm leading-relaxed mb-2">
                  We sent a confirmation to
                </p>
                <p className="text-white font-semibold mb-6">{waitlistEmail}</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Click the link to lock in your spot. When access opens, you&apos;ll be first.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Return visit — reflection prompt
  if (mode === 'returning' && returnEntry) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <nav className="flex items-center justify-between px-6 py-5">
          <button onClick={() => setMode('input')} className="text-gray-500 hover:text-white transition-colors text-sm">Skip →</button>
          <Logo dark />
          <div className="w-16" />
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <div className="w-full max-w-lg">
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-8">You're back. Elijah wants to know.</p>

            <div className="border-l-2 border-gray-800 pl-5 mb-8">
              <p className="text-xs text-gray-700 mb-2">You asked</p>
              <p className="text-gray-400 text-sm italic leading-relaxed">&ldquo;{returnEntry.question}&rdquo;</p>
            </div>

            {returnEntry.action_steps && (
              <div className="bg-gray-950 border border-gray-900 px-6 py-5 mb-10">
                <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Your steps from Elijah</p>
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{returnEntry.action_steps}</p>
              </div>
            )}

            <p className="text-white font-semibold text-xl mb-2">Did you try the steps?</p>
            <p className="text-gray-500 text-sm mb-6">Tell Elijah what happened. This goes into your journal — yours to keep.</p>

            <textarea
              autoFocus
              value={reflectionText}
              onChange={e => setReflectionText(e.target.value)}
              placeholder="What happened when you tried it..."
              rows={4}
              className="w-full bg-transparent border border-gray-700 focus:border-white transition-colors px-4 py-3 text-white placeholder-gray-700 text-base leading-relaxed resize-none outline-none mb-4"
            />

            <div className="flex items-center gap-4">
              <button
                onClick={handleReflectionSubmit}
                disabled={!reflectionText.trim() || reflectionSubmitting}
                className="bg-white text-black px-8 py-3 text-sm font-semibold disabled:opacity-30 hover:opacity-80 transition-opacity"
              >
                {reflectionSubmitting ? 'Saving...' : 'Tell Elijah →'}
              </button>
              <button onClick={() => setMode('upvote_prompt')} className="text-xs text-gray-600 hover:text-white transition-colors">
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Return visit — upvote prompt
  if (mode === 'upvote_prompt') {
    const upvoteCandidates = topQuestions.slice(0, 5)
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <nav className="flex items-center justify-between px-6 py-5">
          <div className="w-16" />
          <Logo dark />
          <div className="w-16" />
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <div className="w-full max-w-lg">
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">While you&apos;re here</p>
            <h2 className="text-2xl font-bold mb-2">Which of these do you also deal with?</h2>
            <p className="text-gray-600 text-sm mb-10">Tap everything that applies. It helps other players know they&apos;re not alone.</p>

            <div className="space-y-2 mb-12">
              {upvoteCandidates.map(q => {
                const voted = votedIds.has(q.id)
                return (
                  <button
                    key={q.id}
                    onClick={() => handleUpvote(q.id)}
                    className={`w-full text-left px-5 py-4 border transition-all duration-150 flex items-start gap-4 ${
                      voted ? 'border-white bg-white/5' : 'border-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <span className={`text-sm mt-0.5 shrink-0 transition-colors ${voted ? 'text-white' : 'text-gray-700'}`}>
                      {voted ? '✓' : '↑'}
                    </span>
                    <span className={`text-sm leading-snug transition-colors ${voted ? 'text-white' : 'text-gray-500'}`}>
                      {q.question}
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setMode('input')}
              className="w-full bg-white text-black py-3 text-sm font-semibold hover:opacity-80 transition-opacity"
            >
              Ask your next question →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Profile modal
  if (showProfile) {
    return (
      <ProfileModal
        pendingQuestion={pendingQ}
        onComplete={handleProfileComplete}
        onSkip={handleProfileSkip}
      />
    )
  }

  // Input mode
  if (mode === 'input') {
    const askPanel = (
      <div className="w-full">
        <div className="border border-gray-700 focus-within:border-white transition-colors">
          <textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onKeyDown={handleKey}
            placeholder="Ask anything."
            rows={3}
            className="w-full px-4 pt-4 pb-2 text-white placeholder-gray-600 text-xl leading-relaxed resize-none outline-none bg-transparent"
            style={{ minHeight: '80px' }}
          />
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex items-center gap-3">
              {question.length >= 140 && (
                <span className="text-xs text-gray-600">{question.length}</span>
              )}
            </div>
            <div className="ml-auto">
              <button
                onClick={handleQuestionSubmit}
                disabled={!question.trim()}
                className="bg-white text-black px-6 py-2 text-sm font-semibold tracking-tight disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
              >
                Ask Elijah →
              </button>
            </div>
          </div>
        </div>
      </div>
    )

    const communityPanel = topQuestions.length > 0 && (
      <div className="w-full">
        <p className="text-xs text-gray-700 uppercase tracking-widest mb-3 px-1">What others are asking</p>
        <div>
          {topQuestions.map((q) => (
            <button
              key={q.id}
              onClick={() => {
                setQuestion(q.question)
                setShowSuggestions(false)
                textareaRef.current?.focus()
              }}
              className="w-full text-left py-4 border-b border-gray-900 hover:bg-gray-950 transition-colors px-1 group flex items-start gap-3"
            >
              <span className="text-xs text-gray-700 group-hover:text-gray-500 transition-colors mt-0.5 shrink-0 tabular-nums">
                ↑ {q.upvote_count}
              </span>
              <span className="text-gray-500 text-sm group-hover:text-gray-300 transition-colors leading-snug">
                {q.question}
              </span>
            </button>
          ))}
        </div>
      </div>
    )

    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <nav className="flex items-center justify-between px-6 py-5">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-white transition-colors text-sm">
            ← Back
          </button>
          <Logo dark />
          {isLoggedIn ? (
            <Link href="/history" className="text-xs text-gray-500 hover:text-white transition-colors">My questions</Link>
          ) : (
            <Link href="/sign-in" className="text-xs text-gray-500 hover:text-white transition-colors">Sign in</Link>
          )}
        </nav>

        {/* Beta spots remaining banner */}
        {betaSpotsLeft !== null && betaSpotsLeft <= 10 && (
          <div className="text-center py-2 px-6">
            <p className="text-xs text-gray-600">
              {betaSpotsLeft === 0 ? 'Beta is full' : `${betaSpotsLeft} beta spot${betaSpotsLeft === 1 ? '' : 's'} left`}
            </p>
          </div>
        )}

        {/* Desktop: side by side. Mobile: stacked (ask first) */}
        <div className="flex-1 flex flex-col md:flex-row">

          {/* Mobile: ask on top */}
          <div className="flex md:hidden flex-col px-6 pt-10 pb-6">
            {askPanel}
          </div>

          {/* Left — community questions (desktop only as left col, mobile below) */}
          <div className="md:w-2/5 md:border-r border-gray-900 md:overflow-y-auto md:flex md:flex-col md:justify-center px-6 py-10 order-last md:order-first">
            {communityPanel}
          </div>

          {/* Right — ask textarea (desktop only, hidden on mobile since it's above) */}
          <div className="hidden md:flex md:w-3/5 flex-col items-center justify-center px-10 py-10">
            {askPanel}
          </div>

        </div>
      </div>
    )
  }

  // Email gate
  if (mode === 'email_gate') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <nav className="flex items-center justify-between px-6 py-5">
          <button onClick={() => setMode('input')} className="text-gray-500 hover:text-white transition-colors text-sm">
            ← Back
          </button>
          <Logo dark />
          <div className="w-16" />
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <div className="w-full max-w-sm text-center">
            <p className="text-xs text-gray-600 tracking-widest uppercase mb-6">Almost there</p>
            <h2 className="text-3xl font-bold mb-3">Where should Elijah send your answer?</h2>
            <p className="text-gray-600 text-sm mb-10 leading-relaxed">
              Your question is in. Elijah will review the answer and send it to your inbox.
            </p>

            <div className="border-b border-gray-700 focus-within:border-white transition-colors mb-6">
              <input
                ref={emailRef}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleEmailKey}
                className="w-full bg-transparent pb-3 text-xl text-center text-white placeholder-gray-700 outline-none"
              />
            </div>

            {/* COPPA */}
            <label className="flex items-start gap-3 mb-6 cursor-pointer text-left">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 accent-white w-4 h-4 flex-shrink-0"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                I confirm I am 13 years of age or older.
              </span>
            </label>

            {emailError && (
              <p className="text-red-400 text-xs mb-4">{emailError}</p>
            )}

            <button
              onClick={handleEmailSubmit}
              disabled={!email.trim() || !ageConfirmed}
              className="w-full bg-white text-black py-3 text-sm font-semibold disabled:opacity-30 hover:opacity-80 transition-opacity"
            >
              Send my question →
            </button>

            <p className="text-xs text-gray-700 mt-4">No spam. Just your answer.</p>
          </div>
        </div>
      </div>
    )
  }

  // Loading
  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-8 px-6 text-center">
        <ThinkingDots />
        <div>
          <p className="text-white text-lg font-semibold mb-2">Elijah is thinking...</p>
          <p className="text-gray-500 text-sm">Pulling from 20 years of pro experience</p>
        </div>
        <div className="border border-gray-800 rounded-lg px-6 py-4 max-w-sm w-full text-left">
          <p className="text-gray-600 text-xs uppercase tracking-widest mb-2">Your question</p>
          <p className="text-gray-300 text-sm italic">&ldquo;{question}&rdquo;</p>
        </div>
      </div>
    )
  }

  // Onboarding — fires after email submit, before showing submitted
  if (mode === 'onboarding') {
    const CHALLENGES = [
      'Confidence & mental game',
      'Getting more minutes',
      'Performing under pressure',
      'Dealing with a tough coach',
      'Breaking out of a slump',
      'Getting recruited',
    ]
    const ONBOARD_LEVELS = [
      { value: 'middle_school', label: 'Middle School' },
      { value: 'high_school', label: 'High School' },
      { value: 'college', label: 'College' },
      { value: 'pro', label: 'Pro / Semi-Pro' },
      { value: 'recreational', label: 'Recreational' },
    ]
    const totalSteps = 3
    const progress = ((onboardStep + 1) / totalSteps) * 100

    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        {/* Progress bar */}
        <div className="h-0.5 bg-gray-900 w-full">
          <div className="h-full bg-white transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-lg mx-auto w-full">

          {/* Step 0 — Name */}
          {onboardStep === 0 && (
            <div className="w-full text-center">
              <p className="text-xs text-gray-600 tracking-widest uppercase mb-6">While Elijah reads your question</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-3">What should he call you?</h2>
              <p className="text-gray-600 text-sm mb-10">He wants to know who he&apos;s talking to.</p>
              <input
                autoFocus
                type="text"
                placeholder="First name"
                value={onboardName}
                onChange={(e) => setOnboardName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onboardName.trim() && setOnboardStep(1)}
                className="w-full bg-transparent border-b border-gray-700 focus:border-white pb-3 text-2xl text-center text-white placeholder-gray-700 outline-none transition-colors mb-10"
              />
              <button
                onClick={() => setOnboardStep(1)}
                disabled={!onboardName.trim()}
                className="bg-white text-black px-10 py-3 text-sm font-semibold disabled:opacity-20 hover:opacity-80 transition-opacity"
              >
                Next →
              </button>
            </div>
          )}

          {/* Step 1 — Position + Level */}
          {onboardStep === 1 && (
            <div className="w-full text-center">
              <p className="text-xs text-gray-600 tracking-widest uppercase mb-6">Help him tailor the answer</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-10">Where do you play?</h2>

              <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Position</p>
              <div className="flex gap-3 justify-center mb-10">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setOnboardPosition(pos === onboardPosition ? '' : pos)}
                    className={`w-14 h-14 text-base font-bold border-2 transition-all duration-150 ${
                      onboardPosition === pos
                        ? 'bg-white text-black border-white'
                        : 'border-gray-700 text-gray-400 hover:border-white hover:text-white'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>

              <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Level</p>
              <div className="flex flex-col gap-2 max-w-xs mx-auto mb-10">
                {ONBOARD_LEVELS.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setOnboardLevel(l.value === onboardLevel ? '' : l.value)}
                    className={`py-2.5 px-6 text-sm font-semibold border transition-all duration-150 ${
                      onboardLevel === l.value
                        ? 'bg-white text-black border-white'
                        : 'border-gray-800 text-gray-400 hover:border-gray-500 hover:text-white'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-4 justify-center">
                <button onClick={() => setOnboardStep(0)} className="text-gray-600 hover:text-white text-sm transition-colors">← Back</button>
                <button
                  onClick={() => setOnboardStep(2)}
                  className="bg-white text-black px-10 py-3 text-sm font-semibold hover:opacity-80 transition-opacity"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Biggest challenge */}
          {onboardStep === 2 && (
            <div className="w-full text-center">
              <p className="text-xs text-gray-600 tracking-widest uppercase mb-6">One more thing</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-3">What&apos;s holding you back right now?</h2>
              <p className="text-gray-600 text-sm mb-10">Elijah will use this to sharpen your answer.</p>
              <div className="flex flex-wrap gap-2 justify-center mb-10">
                {CHALLENGES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setOnboardChallenge(c === onboardChallenge ? '' : c)}
                    className={`px-4 py-2.5 text-sm border transition-all duration-150 ${
                      onboardChallenge === c
                        ? 'bg-white text-black border-white'
                        : 'border-gray-800 text-gray-400 hover:border-gray-500 hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="flex gap-4 justify-center">
                <button onClick={() => setOnboardStep(1)} className="text-gray-600 hover:text-white text-sm transition-colors">← Back</button>
                <button
                  onClick={() => handleOnboardComplete(false)}
                  className="bg-white text-black px-10 py-3 text-sm font-semibold hover:opacity-80 transition-opacity"
                >
                  Done →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step dots + skip */}
        <div className="text-center pb-8">
          <div className="flex gap-2 justify-center mb-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`rounded-full transition-all ${i === onboardStep ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-gray-700'}`} />
            ))}
          </div>
          <button
            onClick={() => handleOnboardComplete(true)}
            className="text-xs text-gray-700 hover:text-gray-500 transition-colors"
          >
            Skip for now →
          </button>
        </div>
      </div>
    )
  }

  // Submitted
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <nav className="flex items-center justify-between px-6 py-5">
        <div className="w-16" />
        <Logo dark />
        <div className="w-16" />
      </nav>

      <div className="flex-1 flex flex-col items-center justify-start px-6 pt-12 pb-20">
        <div className="w-full max-w-lg">

          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-2 h-2 bg-white rounded-full mx-auto mb-8" />
            <h2 className="text-3xl font-bold mb-3">Here&apos;s a first take.</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Elijah is reviewing this personally. Once he signs off, the final answer lands in your inbox at <span className="text-white">{email}</span>
            </p>
          </div>

          {/* Draft answer */}
          {draftAnswer ? (
            <div className="mb-10">
              <div className="border-l-2 border-gray-800 pl-4 mb-6">
                <p className="text-gray-600 text-xs italic">&ldquo;{question}&rdquo;</p>
              </div>
              <div className="bg-gray-950 border border-gray-900 px-6 py-6 mb-3">
                <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">First take</p>
                <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{draftAnswer}</p>
              </div>
              <p className="text-xs text-gray-700 text-center">Elijah reviews every answer before it sends. This may change.</p>
            </div>
          ) : (
            <div className="border-l-2 border-gray-800 pl-4 mb-10">
              <p className="text-gray-600 text-sm italic">&ldquo;{question}&rdquo;</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleAskAnother}
              className="text-sm border border-gray-700 px-6 py-3 text-gray-400 hover:border-white hover:text-white transition-colors w-full max-w-xs"
            >
              Ask another question
            </button>
            {isLoggedIn && (
              <Link href="/history" className="text-xs text-gray-600 hover:text-white transition-colors">
                View all my questions →
              </Link>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

export default function AskPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <AskPageInner />
    </Suspense>
  )
}
