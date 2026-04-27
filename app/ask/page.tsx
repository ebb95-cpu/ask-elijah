'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase-client'
import { usePostHog } from 'posthog-js/react'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { getLocal, setLocal, removeLocal, getSession, setSession, removeSession } from '@/lib/safe-storage'
import LoadingDots from '@/components/ui/LoadingDots'
import ReturningDashboard from '@/components/ReturningDashboard'
import { simFetch } from '@/lib/simulator'

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
    <LoadingDots label="" size={5} className="text-white" />
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

type Mode = 'input' | 'email_gate' | 'clarifying' | 'loading' | 'onboarding' | 'submitted' | 'returning' | 'upvote_prompt' | 'beta_full' | 'dashboard' | 'unread_hero' | 'pending_wait' | 'welcome_back'

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
  // Most-recent journal entry — drives the decision to land on the
  // returning-user dashboard vs the cold input chip-picker.
  const [lastEntry, setLastEntry] = useState<JournalEntry | null>(null)
  // Student's actual first name, pulled from the profile so the welcome
  // modes can say "Welcome back, Eli" instead of guessing from the email.
  const [profileFirstName, setProfileFirstName] = useState<string | null>(null)
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
  const [clarifyQuestion, setClarifyQuestion] = useState('')
  const [clarifyAnswer, setClarifyAnswer] = useState('')
  const [clarifyConversation, setClarifyConversation] = useState<{ q: string; a: string }[]>([])
  const [clarifyLoading, setClarifyLoading] = useState(false)
  const clarifyInputRef = useRef<HTMLTextAreaElement>(null)

  // Entry path: drives tone, clarifying questions, and system-prompt mode.
  // Null means "generic ask" and goes through the existing flow unchanged.
  type EntryMode = 'bad_game' | 'coach' | 'playing_time' | 'parent' | null
  const [entryMode, setEntryMode] = useState<EntryMode>(null)

  // Level on the asker — drives level-filtered RAG retrieval. Persisted to
  // profile on submit so it's remembered for next time.
  type Level = string | null
  const [askerLevel, setAskerLevel] = useState<Level>(null)

  // Hydrate level from localStorage so returning users don't have to re-pick
  useEffect(() => {
    const stored = getLocal('asker_level')
    if (stored) setAskerLevel(stored as Level)
  }, [])

  const normalizeLevel = (raw?: string | null): Level => {
    if (!raw) return null
    const clean = raw.toLowerCase().trim().replace(/\s+/g, '_')
    const aliases: Record<string, string> = {
      youth: 'middle_school',
      under_18: 'middle_school',
      high_school: 'varsity',
      hs: 'varsity',
      recreational: 'rec',
      rec_adult: 'rec',
      'rec_/_adult': 'rec',
    }
    return aliases[clean] || clean
  }

  // Mobile bottom-sheet state for "what others are asking"
  const [communitySheetOpen, setCommunitySheetOpen] = useState(false)

  // Voice input — integrated via the existing useVoiceInput hook. On mobile
  // typing a real question is a huge barrier; voice is how you catch a kid
  // who's still in their feelings post-game.
  const voicePartialRef = useRef('')
  const voiceBaseRef = useRef('')
  const {
    state: voiceState,
    start: startVoice,
    stop: stopVoice,
  } = useVoiceInput({
    onPartial: (text) => {
      voicePartialRef.current = text
      setQuestion((voiceBaseRef.current + ' ' + text).trim())
    },
    onFinal: (text) => {
      voiceBaseRef.current = (voiceBaseRef.current + ' ' + text).trim()
      voicePartialRef.current = ''
      setQuestion(voiceBaseRef.current)
    },
    onError: (msg) => {
      console.warn('Voice input error:', msg)
    },
  })
  const toggleVoice = () => {
    if (voiceState === 'listening' || voiceState === 'requesting') {
      stopVoice()
    } else {
      voiceBaseRef.current = question
      voicePartialRef.current = ''
      startVoice()
    }
  }

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
    const pending = getSession('pending_question')
    if (pending) {
      removeSession('pending_question')
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


  // Fetch the student's first name once the stored email is known so every
  // returning-user screen can greet them by their actual name rather than
  // faking it from the email prefix.
  useEffect(() => {
    const storedEmail = getLocal('ask_elijah_email')
    if (!storedEmail) return
    let cancelled = false
    fetch(`/api/profile?email=${encodeURIComponent(storedEmail)}`)
      .then((r) => r.json())
      .then((d: { first_name?: string | null; level?: string | null }) => {
        if (!cancelled && d?.first_name) setProfileFirstName(d.first_name)
        const profileLevel = normalizeLevel(d?.level)
        if (!cancelled && profileLevel) {
          setAskerLevel(profileLevel)
          setLocal('asker_level', profileLevel)
        }
      })
      .catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [])

  // Keep /ask focused on one job: asking a question. The locker room (/track)
  // is the single hub for pending questions, answers, profile, and next reps.
  useEffect(() => {
    const storedEmail = getLocal('ask_elijah_email')
    if (!storedEmail) return
    setEmail(storedEmail)
  }, [])

  // Track funnel step changes
  useEffect(() => {
    if (mode === 'submitted') posthog?.capture('question_confirmed')
    if (mode === 'email_gate') posthog?.capture('email_gate_shown')
    if (mode === 'returning') posthog?.capture('return_visit')
  }, [mode, posthog])

  const getQuestionCount = () =>
    parseInt(getLocal('question_count') || '0', 10)
  const incrementQuestionCount = () =>
    setLocal('question_count', String(getQuestionCount() + 1))
  const hasCompletedProfile = () =>
    !!getLocal('profile_done')

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

  // Step 2: email submitted → check free tier → call API
  const handleEmailSubmit = async () => {
    if (!email.trim()) { setEmailError('Email is required to get your answer.'); return }
    if (!ageConfirmed) { setEmailError('Please confirm you are 13 or older.'); return }
    setEmailError('')
    posthog?.capture('email_submitted', { email: email.trim().toLowerCase() })
    posthog?.identify(email.trim().toLowerCase(), { email: email.trim().toLowerCase() })

    // Check if we need clarification before submitting.
    // If clarify API fails, we proceed without it — but track the event so we
    // know when answer quality is dropping because the classifier is down.
    try {
      const clarRes = await simFetch(
        '/api/clarify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, conversation: [], mode: entryMode }),
        },
        // Simulator skips clarification and goes straight to submit.
        { done: true }
      )
      const clarData = await clarRes.json()
      if (clarData.fallback) {
        posthog?.capture('clarify_fallback', { reason: clarData.reason })
      } else if (!clarData.done && clarData.followUp) {
        setClarifyQuestion(clarData.followUp)
        setClarifyConversation([])
        setClarifyAnswer('')
        setMode('clarifying')
        setTimeout(() => clarifyInputRef.current?.focus(), 100)
        return
      }
    } catch (err) {
      posthog?.capture('clarify_error', { error: String(err) })
    }

    setMode('loading')
    incrementQuestionCount()
    setSession('user_email', email.trim().toLowerCase())
    await submitToApi(question, email.trim().toLowerCase(), [])
  }

  const submitToApi = async (
    finalQuestion: string,
    userEmail: string,
    conversation: { q: string; a: string }[]
  ) => {
    // Build enriched question if there was clarification
    let enrichedQuestion = finalQuestion
    if (conversation.length > 0) {
      const context = conversation
        .map((c) => `Elijah asked: "${c.q}"\nPlayer said: "${c.a}"`)
        .join('\n')
      enrichedQuestion = `${finalQuestion}\n\n--- Additional context ---\n${context}`
    }

    try {
      const res = await simFetch(
        '/api/ask',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: enrichedQuestion,
            email: userEmail,
            language: detectedLang,
            mode: entryMode,
            askerType: entryMode === 'parent' ? 'parent' : 'player',
            level: askerLevel,
          }),
        },
        // Simulator mock: land on the "submitted" state with a placeholder
        // draft so the admin sees the full post-submit UI without writing
        // a real question to the DB or triggering the LLM.
        {
          ok: true,
          draft: 'This is a simulated preview of what your answer would look like from Elijah. The real flow would generate this with the LLM and store it for review.',
        }
      )

      const data = await res.json()

      if (!res.ok) {
        if (data.code === 'access_required') {
          setWaitlistEmail(userEmail)
          setWaitlistName('')
          setWaitlistChallenge(finalQuestion.slice(0, 160))
          setMode('beta_full')
          return
        }
        setEmailError(data.error || 'Something went wrong.')
        setMode('email_gate')
        return
      }

      if (data.draft) setDraftAnswer(data.draft)

      posthog?.capture('question_sent', { had_clarification: conversation.length > 0 })
      if (!hasCompletedProfile()) {
        setOnboardStep(0)
        setMode('onboarding')
      } else {
        router.push('/track')
      }
    } catch {
      setEmailError('Something went wrong. Try again.')
      setMode('email_gate')
    }
  }

  const handleOnboardComplete = async (skip = false) => {
    setLocal('profile_done', '1')
    if (!skip && (onboardName || onboardPosition || onboardLevel || onboardChallenge)) {
      const pendingProfile = {
        // Canonical field is first_name — used by crons, home, ask API,
        // and the returning-user welcome modes. Legacy `name` column
        // still works but first_name is the source of truth.
        first_name: onboardName || null,
        position: onboardPosition || null,
        level: onboardLevel || null,
        challenge: onboardChallenge || null,
        language: detectedLang,
      }
      setLocal('ae_pending_profile', JSON.stringify(pendingProfile))
      await simFetch(
        '/api/track-profile',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingProfile),
        },
        { ok: true }
      ).then((res) => {
        if (res.ok) removeLocal('ae_pending_profile')
      }).catch(() => { /* ProfileSyncer retries after /track loads */ })
    }
    router.push('/track')
  }

  const handleEmailKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleEmailSubmit()
  }

  const handleProfileComplete = async (profile: Record<string, unknown>) => {
    setLocal('profile_done', '1')
    const savedEmail = getSession('user_email')
    if (savedEmail) {
      try {
        await simFetch(
          '/api/profile',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: savedEmail, ...profile, language: detectedLang }),
          },
          { ok: true }
        )
      } catch { /* fail silently */ }
    }
    setShowProfile(false)
    setMode('email_gate')
    setTimeout(() => emailRef.current?.focus(), 100)
  }

  const handleProfileSkip = () => {
    setLocal('profile_done', '1')
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
      await simFetch(
        '/api/reflection',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, question_id: returnEntry.id, text: reflectionText }),
        },
        { ok: true }
      )
    } catch { /* fail silently */ }
    setReflectionSubmitting(false)
    setMode('upvote_prompt')
  }

  const handleClarifySubmit = async () => {
    if (!clarifyAnswer.trim()) return
    setClarifyLoading(true)

    const updatedConversation = [...clarifyConversation, { q: clarifyQuestion, a: clarifyAnswer.trim() }]
    setClarifyConversation(updatedConversation)
    setClarifyAnswer('')

    try {
      const res = await simFetch(
        '/api/clarify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, conversation: updatedConversation, mode: entryMode }),
        },
        // Follow-up clarify in simulator: mark done so it proceeds to submit.
        { done: true }
      )
      const data = await res.json()

      if (data.fallback) {
        posthog?.capture('clarify_fallback', { reason: data.reason, round: updatedConversation.length })
      }

      if (!data.done && data.followUp) {
        // Another follow-up needed
        setClarifyQuestion(data.followUp)
        setClarifyLoading(false)
        setTimeout(() => clarifyInputRef.current?.focus(), 100)
      } else {
        // Done — submit to API with full context
        setMode('loading')
        incrementQuestionCount()
        setSession('user_email', email.trim().toLowerCase())
        await submitToApi(question, email.trim().toLowerCase(), updatedConversation)
      }
    } catch (err) {
      // On error, proceed with what we have but record it
      posthog?.capture('clarify_error', { error: String(err), round: updatedConversation.length })
      setMode('loading')
      incrementQuestionCount()
      setSession('user_email', email.trim().toLowerCase())
      await submitToApi(question, email.trim().toLowerCase(), updatedConversation)
    }
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
      await simFetch(
        '/api/upvote',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question_id: questionId, email }),
        },
        { ok: true }
      )
    } catch { /* fail silently */ }
  }

  // Clarifying — Elijah asks follow-up questions before submitting
  if (mode === 'clarifying') {
    const roundNum = clarifyConversation.length + 1
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <nav className="flex items-center justify-between px-6 py-5">
          <button
            onClick={() => setMode('email_gate')}
            className="text-gray-500 hover:text-white transition-colors text-sm"
          >
            ← Back
          </button>
          <Logo dark />
          <div className="w-16" />
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <div className="w-full max-w-sm">

            {/* Progress dots */}
            <div className="flex gap-2 justify-center mb-10">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i < roundNum ? 'w-5 h-2 bg-white' : i === roundNum - 1 ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-gray-800'
                  }`}
                />
              ))}
            </div>

            {/* Their original question — small, above */}
            <div className="border-l-2 border-gray-800 pl-4 mb-8">
              <p className="text-gray-600 text-xs italic leading-relaxed">&ldquo;{question}&rdquo;</p>
            </div>

            {/* Previous answers shown above current question */}
            {clarifyConversation.length > 0 && (
              <div className="space-y-4 mb-8">
                {clarifyConversation.map((c, i) => (
                  <div key={i}>
                    <p className="text-xs text-gray-600 mb-1">{c.q}</p>
                    <p className="text-sm text-gray-400 border-l border-gray-700 pl-3">{c.a}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Elijah's follow-up */}
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">Elijah wants to know</p>
            <h2 className="text-2xl font-bold mb-8 leading-tight">{clarifyQuestion}</h2>

            <textarea
              ref={clarifyInputRef}
              value={clarifyAnswer}
              onChange={(e) => setClarifyAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && clarifyAnswer.trim()) {
                  e.preventDefault()
                  handleClarifySubmit()
                }
              }}
              placeholder="Be honest. The more specific, the better the answer."
              rows={3}
              className="w-full bg-transparent border border-gray-700 focus:border-white transition-colors px-4 py-3 text-white placeholder-gray-700 text-base leading-relaxed resize-none outline-none mb-4"
            />

            <div className="flex flex-col gap-3">
              <button
                onClick={handleClarifySubmit}
                disabled={!clarifyAnswer.trim() || clarifyLoading}
                className="w-full bg-white text-black py-4 text-base font-bold rounded-full disabled:opacity-30 hover:opacity-80 transition-opacity min-h-[48px]"
              >
                {clarifyLoading ? <LoadingDots label="Got it" /> : 'Answer →'}
              </button>
              <button
                onClick={async () => {
                  setMode('loading')
                  incrementQuestionCount()
                  setSession('user_email', email.trim().toLowerCase())
                  await submitToApi(question, email.trim().toLowerCase(), clarifyConversation)
                }}
                className="text-sm text-gray-600 hover:text-white transition-colors py-2 min-h-[44px]"
              >
                Skip and just send it →
              </button>
            </div>

          </div>
        </div>
      </div>
    )
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
                  {waitlistLoading ? <LoadingDots label="Saving" /> : "I'm ready when you are →"}
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
                {reflectionSubmitting ? <LoadingDots label="Saving" /> : 'Tell Elijah →'}
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

  // Second-visit edge case: they signed in before but never actually asked
  // a question. The default "Ask anything" screen would be identical to what
  // they saw on visit 1 — which breaks habit formation (app has amnesia).
  // Show a tight welcome that acknowledges them and points at trending peer
  // questions as the nudge to actually ask this time.
  if (mode === 'welcome_back') {
    // Prefer the real name from their profile. If missing, show a clean
    // "Welcome back." without a fake name — the email-prefix guess ("Ebb95")
    // felt robotic and undercut the warmth the greeting is supposed to land.
    const greeting = profileFirstName
      ? `Welcome back, ${profileFirstName}.`
      : 'Welcome back.'
    return (
      <div className="min-h-[100dvh] bg-black text-white flex flex-col">
        <nav className="flex items-center justify-between px-5 py-4 md:px-6 md:py-5 shrink-0">
          <Link href="/track" className="text-gray-500 hover:text-white transition-colors text-sm">
            ← Locker room
          </Link>
          <Logo dark />
          <div className="w-16" />
        </nav>
        <div className="flex-1 overflow-y-auto px-5 md:px-6 pb-16">
          <div className="max-w-2xl mx-auto pt-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{greeting}</h1>
            <p className="text-sm text-gray-500 mb-8">
              Last time you looked around but didn&apos;t ask. What&apos;s been sitting on your mind?
            </p>

            <button
              onClick={() => {
                setShowSuggestions(false)
                setMode('input')
                setTimeout(() => textareaRef.current?.focus(), 50)
              }}
              className="bg-white text-black text-sm font-semibold px-5 py-2.5 rounded-full hover:opacity-80 transition-opacity mb-10"
            >
              Ask Elijah →
            </button>

            {topQuestions.length > 0 && (
              <div className="border-t border-gray-900 pt-8">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">
                  Other players are asking
                </p>
                <ul className="flex flex-col gap-1">
                  {topQuestions.slice(0, 5).map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/browse/${t.id}`}
                        className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-gray-950 transition-colors"
                      >
                        <span className="text-xs text-gray-600 mt-0.5 shrink-0 w-8">↑ {t.upvote_count}</span>
                        <span className="text-sm text-gray-300 leading-snug">{t.question}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // State 1 — the Hooked payoff. Returning user has a fresh approved answer
  // they haven't tapped yet. Show it full-screen as the first thing they
  // see on sign-in: the reward precedes the next investment ask.
  if (mode === 'unread_hero' && returnEntry) {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex flex-col">
        <nav className="flex items-center justify-between px-5 py-4 md:px-6 md:py-5 shrink-0">
          <button
            onClick={() => {
              try {
                const raw = getLocal('ask_elijah_viewed_question_ids')
                const arr = raw ? JSON.parse(raw) : []
                const next = new Set([...(Array.isArray(arr) ? arr : []), returnEntry.id])
                setLocal('ask_elijah_viewed_question_ids', JSON.stringify(Array.from(next)))
              } catch { /* localStorage blocked */ }
              setMode('dashboard')
            }}
            className="text-gray-500 hover:text-white transition-colors text-sm"
          >
            Locker room →
          </button>
          <Logo dark />
          <div className="w-20" />
        </nav>

        <div className="flex-1 overflow-y-auto px-5 md:px-6 pb-16">
          <div className="max-w-2xl mx-auto pt-8">
            <p className="text-[10px] text-emerald-400 uppercase tracking-widest mb-6">
              ✓ Elijah wrote back
            </p>

            <p className="text-sm text-gray-500 mb-2">You asked</p>
            <p className="text-base italic text-gray-300 leading-snug mb-8">
              &ldquo;{returnEntry.question}&rdquo;
            </p>

            <div className="border-l-2 border-white pl-5 mb-10">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">
                Elijah&apos;s answer
              </p>
              <p className="text-base text-gray-100 leading-relaxed whitespace-pre-wrap">
                {returnEntry.answer}
              </p>
            </div>

            {returnEntry.action_steps && (
              <div className="bg-gray-950 border border-gray-900 px-5 py-4 mb-10">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                  Your steps
                </p>
                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {returnEntry.action_steps}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {returnEntry.action_steps && !returnEntry.reflection && (
                <button
                  onClick={() => {
                    // Investment step — reflection UI already exists in mode='returning'.
                    setMode('returning')
                  }}
                  className="bg-white text-black text-sm font-semibold px-5 py-2.5 rounded-full hover:opacity-80 transition-opacity"
                >
                  Reflect on this →
                </button>
              )}
              <button
                onClick={() => {
                  setQuestion(`Going deeper on this — ${returnEntry.question.replace(/\?$/, '')}. `)
                  setShowSuggestions(false)
                  try {
                    const raw = getLocal('ask_elijah_viewed_question_ids')
                    const arr = raw ? JSON.parse(raw) : []
                    const next = new Set([...(Array.isArray(arr) ? arr : []), returnEntry.id])
                    setLocal('ask_elijah_viewed_question_ids', JSON.stringify(Array.from(next)))
                  } catch { /* */ }
                  setMode('input')
                  setTimeout(() => textareaRef.current?.focus(), 50)
                }}
                className={`text-sm font-semibold px-5 py-2.5 rounded-full transition-colors ${
                  returnEntry.action_steps && !returnEntry.reflection
                    ? 'border border-gray-700 text-white hover:bg-white/5'
                    : 'bg-white text-black hover:opacity-80'
                }`}
              >
                Ask a follow-up
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // State 2 — pending question, nothing new yet. Set expectation ("Elijah
  // writes back within 24h") so the student doesn't refresh anxiously, then
  // offer variable-reward filler via the trending list.
  if (mode === 'pending_wait' && returnEntry) {
    const hoursAgo = Math.max(
      0,
      Math.floor((Date.now() - new Date(returnEntry.answered_at).getTime()) / 3_600_000)
    )
    const timeStr =
      hoursAgo < 1 ? 'just now' : hoursAgo === 1 ? '1 hour ago' : `${hoursAgo} hours ago`
    return (
      <div className="min-h-[100dvh] bg-black text-white flex flex-col">
        <nav className="flex items-center justify-between px-5 py-4 md:px-6 md:py-5 shrink-0">
          <button
            onClick={() => setMode('dashboard')}
            className="text-gray-500 hover:text-white transition-colors text-sm"
          >
            Locker room →
          </button>
          <Logo dark />
          <div className="w-20" />
        </nav>
        <div className="flex-1 overflow-y-auto px-5 md:px-6 pb-16">
          <div className="max-w-2xl mx-auto pt-8">
            <p className="text-[10px] text-amber-400 uppercase tracking-widest mb-4">
              ⏱ Elijah is working on it
            </p>
            <p className="text-sm text-gray-500 mb-2">You asked {timeStr}</p>
            <p className="text-xl font-semibold leading-snug mb-3">
              &ldquo;{returnEntry.question}&rdquo;
            </p>
            <p className="text-sm text-gray-500 mb-10">
              He usually writes back within 24 hours. You&apos;ll get an email the moment he does.
            </p>

            {topQuestions.length > 0 && (
              <div className="border-t border-gray-900 pt-8">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">
                  While you wait — what other players are asking
                </p>
                <ul className="flex flex-col gap-1 mb-8">
                  {topQuestions.slice(0, 4).map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/browse/${t.id}`}
                        className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-gray-950 transition-colors"
                      >
                        <span className="text-xs text-gray-600 mt-0.5 shrink-0 w-8">↑ {t.upvote_count}</span>
                        <span className="text-sm text-gray-300 leading-snug">{t.question}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => {
                setShowSuggestions(false)
                setMode('input')
                setTimeout(() => textareaRef.current?.focus(), 50)
              }}
              className="bg-white text-black text-sm font-semibold px-5 py-2.5 rounded-full hover:opacity-80 transition-opacity"
            >
              Ask another question →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // State 3 — has history, nothing pending, nothing unread. The personal
  // dashboard with a Craig Manning quote rotating in as the variable reward.
  if (mode === 'dashboard') {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex flex-col">
        <nav className="flex items-center justify-between px-5 py-4 md:px-6 md:py-5 shrink-0">
          <Link href="/track" className="text-gray-500 hover:text-white transition-colors text-sm">
            ← Locker room
          </Link>
          <Logo dark />
          <Link href="/track" className="text-xs text-gray-500 hover:text-white transition-colors">
            Locker room
          </Link>
        </nav>
        <div className="flex-1 overflow-y-auto">
          <ReturningDashboard
            email={email || getLocal('ask_elijah_email') || ''}
            firstName={profileFirstName}
            trending={topQuestions}
            onAsk={() => {
              setMode('input')
              setTimeout(() => textareaRef.current?.focus(), 50)
            }}
            onContinueThread={(prior) => {
              setQuestion(`Going deeper on this — ${prior.replace(/\?$/, '')}. `)
              setShowSuggestions(false)
              setMode('input')
              setTimeout(() => textareaRef.current?.focus(), 50)
            }}
          />
        </div>
      </div>
    )
  }

  // Input mode
  if (mode === 'input') {
    const entryOptions: { id: EntryMode; label: string; hint: string }[] = [
      { id: 'bad_game', label: 'I just played bad', hint: "Tell Elijah what happened tonight. He gets it — he's been there." },
      { id: 'coach', label: 'Coach situation', hint: 'Playing time, benching, conflict, favoritism — what\'s going on?' },
      { id: 'playing_time', label: 'Not getting minutes', hint: 'Lay out the rotation and where you fit. Elijah will give you a play.' },
      { id: 'parent', label: "I'm a parent", hint: 'Asking on behalf of your kid. Give Elijah the situation.' },
    ]

    const modePlaceholders: Record<string, string> = {
      bad_game: "What happened? How'd you play? How are you feeling right now?",
      coach: 'Walk Elijah through your coach situation.',
      playing_time: 'Who\'s ahead of you? What has the coach said? What have you tried?',
      parent: 'How old is your kid, what level, and what are you seeing?',
    }

    const activePlaceholder = entryMode ? modePlaceholders[entryMode] : 'Ask anything.'

    const entryChooser = (
      <div className="w-full mb-4">
        <div className="flex flex-wrap gap-2">
          {entryOptions.map((opt) => {
            const active = entryMode === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => {
                  setEntryMode(active ? null : opt.id)
                  posthog?.capture('entry_mode_selected', { mode: active ? null : opt.id })
                  setTimeout(() => textareaRef.current?.focus(), 50)
                }}
                className={`text-xs px-4 py-2 rounded-full border transition-colors ${
                  active
                    ? 'border-white/80 text-white bg-white/10'
                    : 'border-white/10 text-gray-500 hover:border-white/25 hover:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        {entryMode && (
          <p className="text-xs text-gray-600 mt-3 leading-relaxed">
            {entryOptions.find((o) => o.id === entryMode)?.hint}
          </p>
        )}
      </div>
    )

    const askPanel = (
      <div className="w-full">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_80px_rgba(255,255,255,0.04)]">
          <p className="text-[10px] text-gray-600 uppercase tracking-[0.22em] font-bold mb-5">
            Ask Elijah
          </p>
          {entryChooser}
          <div className="rounded-[24px] border border-white/15 bg-black/40 focus-within:border-white/50 transition-colors overflow-hidden">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onKeyDown={handleKey}
              placeholder={activePlaceholder}
              rows={3}
              className="w-full px-6 pt-6 pb-3 text-white placeholder-gray-600 text-2xl leading-relaxed resize-none outline-none bg-transparent"
              style={{ minHeight: '170px' }}
            />
            <div className="flex items-center justify-between px-6 pb-5">
              <div className="flex items-center gap-3">
                {question.length >= 140 && (
                  <span className="text-xs text-gray-600">{question.length}</span>
                )}
              </div>
              <div className="ml-auto">
                <button
                  onClick={handleQuestionSubmit}
                  disabled={!question.trim()}
                  className="rounded-full bg-white text-black px-6 py-3 text-sm font-bold tracking-tight disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
                >
                  Ask Elijah →
                </button>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-600 leading-relaxed">
            Be specific. The better the situation, the better the answer.
          </p>
        </div>
      </div>
    )

    // Mobile-first input layout: textarea fills the viewport, chips in a
    // horizontal scroll row, voice input inline, sticky Ask button in the
    // thumb zone with safe-area padding. Desktop keeps the two-column look.
    const voiceButton = (
      <button
        onClick={toggleVoice}
        aria-label={voiceState === 'listening' ? 'Stop voice input' : 'Start voice input'}
        className={`flex items-center justify-center w-11 h-11 rounded-full border transition-colors shrink-0 ${
          voiceState === 'listening'
            ? 'border-red-500 bg-red-500/10 text-red-400'
            : voiceState === 'requesting'
              ? 'border-gray-600 text-gray-400'
              : 'border-gray-700 text-gray-400 hover:border-white hover:text-white'
        }`}
      >
        {voiceState === 'listening' ? (
          <span className="w-3 h-3 bg-red-500 rounded-sm animate-pulse" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>
    )

    return (
      <div className="min-h-[100dvh] bg-black text-white flex flex-col">
        {/* Top nav — compact on mobile */}
        <nav className="flex items-center justify-between px-5 py-4 md:px-6 md:py-5 shrink-0">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-white transition-colors text-sm">
            ← Back
          </button>
          <Logo dark />
          {isLoggedIn ? (
            <Link href="/track" className="text-xs text-gray-500 hover:text-white transition-colors">Locker room</Link>
          ) : (
            <Link href="/sign-in" className="text-xs text-gray-500 hover:text-white transition-colors">Sign in</Link>
          )}
        </nav>

        {betaSpotsLeft !== null && betaSpotsLeft <= 10 && (
          <div className="text-center py-2 px-6 shrink-0">
            <p className="text-xs text-gray-600">
              {betaSpotsLeft === 0 ? 'Beta is full' : `${betaSpotsLeft} beta spot${betaSpotsLeft === 1 ? '' : 's'} left`}
            </p>
          </div>
        )}

        {/* ────────── Mobile layout ────────── */}
        <div className="flex md:hidden flex-col flex-1 min-h-0">
          {/* Entry mode chips — horizontal scroll row */}
          <div className="chip-row flex gap-2 px-5 pt-2 pb-3 shrink-0">
            {entryOptions.map((opt) => {
              const active = entryMode === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    setEntryMode(active ? null : opt.id)
                    posthog?.capture('entry_mode_selected', { mode: active ? null : opt.id })
                    setTimeout(() => textareaRef.current?.focus(), 50)
                  }}
                  className={`shrink-0 text-sm px-4 py-2 rounded-full border whitespace-nowrap transition-colors ${
                    active ? 'border-white text-white bg-white/10' : 'border-gray-800 text-gray-400'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {/* Textarea fills remaining space */}
          <div className="flex-1 min-h-0 px-5 pt-2 pb-3 flex">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKey}
              placeholder={activePlaceholder}
              className="w-full h-full bg-transparent text-white placeholder-gray-600 text-xl leading-relaxed resize-none outline-none"
            />
          </div>

          {entryMode && (
            <p className="text-xs text-gray-600 px-5 pb-2 shrink-0">
              {entryOptions.find((o) => o.id === entryMode)?.hint}
            </p>
          )}

          {/* Sticky bottom action row — thumb zone, above home indicator */}
          <div
            className="shrink-0 border-t border-gray-900 bg-black px-4 pt-3 pb-safe-plus-16 flex items-center gap-3"
          >
            <button
              onClick={() => setCommunitySheetOpen(true)}
              className="w-11 h-11 rounded-full border border-gray-800 text-gray-400 flex items-center justify-center shrink-0"
              aria-label="See what others asked"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h18M3 6h18M3 18h12" />
              </svg>
            </button>
            {voiceButton}
            <button
              onClick={handleQuestionSubmit}
              disabled={!question.trim()}
              className="flex-1 bg-white text-black py-3 text-base font-bold disabled:opacity-30 disabled:cursor-not-allowed rounded-full"
            >
              Ask Elijah →
            </button>
          </div>

          {/* Community bottom sheet */}
          {communitySheetOpen && (
            <div
              className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60"
              onClick={() => setCommunitySheetOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-black border-t border-gray-800 rounded-t-2xl max-h-[75vh] flex flex-col slide-up"
              >
                <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
                  <p className="text-xs text-gray-500 uppercase tracking-widest">What others are asking</p>
                  <button
                    onClick={() => setCommunitySheetOpen(false)}
                    className="text-gray-500 text-xl"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <div className="overflow-y-auto pb-safe-plus-16">
                  {topQuestions.length === 0 ? (
                    <p className="text-sm text-gray-600 px-5 py-8 text-center">Nothing yet — be the first.</p>
                  ) : (
                    topQuestions.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => {
                          setQuestion(q.question)
                          setShowSuggestions(false)
                          setCommunitySheetOpen(false)
                          setTimeout(() => textareaRef.current?.focus(), 50)
                        }}
                        className="w-full text-left py-4 border-b border-gray-900 px-5 flex items-start gap-3"
                      >
                        <span className="text-xs text-gray-600 mt-0.5 shrink-0 tabular-nums">↑ {q.upvote_count}</span>
                        <span className="text-gray-300 text-sm leading-snug">{q.question}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ────────── Desktop layout ────────── */}
        <div className="hidden md:flex flex-1 items-center justify-center px-10 py-10">
          <div className="w-full max-w-5xl">
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
              className="w-full bg-white text-black py-4 text-base font-bold rounded-full disabled:opacity-30 hover:opacity-80 transition-opacity min-h-[48px]"
            >
              Send my question →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Loading
  if (mode === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex flex-col items-center justify-center gap-8 px-6 text-center">
        <ThinkingDots />
        <div>
          <p className="text-white text-xl font-bold mb-2">Elijah is thinking...</p>
          <p className="text-gray-500 text-sm">Pulling from 20 years of pro experience</p>
        </div>
        <div className="border border-gray-800 rounded-xl px-5 py-4 max-w-sm w-full text-left">
          <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-2">Your question</p>
          <p className="text-gray-300 text-base italic leading-relaxed">&ldquo;{question}&rdquo;</p>
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
            <h2 className="text-3xl font-bold mb-3">
              {draftAnswer ? "Here\u2019s a first take." : "Question received."}
            </h2>
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
              <Link href="/track" className="text-xs text-gray-600 hover:text-white transition-colors">
                View locker room →
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
