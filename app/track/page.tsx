import Link from 'next/link'
import { readTrackEmail } from '@/lib/track-cookie'
import { getSupabase } from '@/lib/supabase-server'
import CourtWelcomeBanner from '@/components/CourtWelcomeBanner'
import ShareAnswerButton from '@/components/ShareAnswerButton'
import InlineAskComposer from '@/components/InlineAskComposer'

export const dynamic = 'force-dynamic'

type QuestionRow = {
  id: string
  question: string
  answer: string | null
  status: 'pending' | 'approved' | 'skipped' | null
  created_at: string
  approved_at: string | null
}

type PopularQuestion = {
  id: string
  question: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const diffH = Math.floor((Date.now() - d.getTime()) / 3600000)
  if (diffH < 1) return 'Just now'
  if (diffH < 24) return `${diffH}h ago`
  if (diffH < 48) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Logo() {
  return (
    <svg width="52" height="8" viewBox="0 0 52 8" fill="none" aria-hidden="true">
      <circle cx="4" cy="4" r="4" fill="#fff" />
      <line x1="8" y1="4" x2="20" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill="#fff" />
      <line x1="28" y1="4" x2="40" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill="#fff" />
    </svg>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-lg font-bold tabular-nums leading-none">{value}</span>
      <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-1.5">{label}</span>
    </div>
  )
}

/**
 * "Your court" — the player's home, not a tracker.
 *
 * Reframed from the earlier /track "status page" identity. The URL stays
 * `/track` (email links, the verify cookie, and the homepage CTA all point
 * here) but the page now reads as a dashboard the player returns to: a
 * permanent library of Elijah's answers, a queue of pending questions,
 * tribe reward of what other players are asking, and a one-tap Ask CTA.
 *
 * Auth: signed `ae_track` cookie set by /api/verify-email after Kickbox
 * verification. Same-browser only. No account required. See lib/track-cookie.ts.
 */
export default async function TrackPage() {
  const email = await readTrackEmail()

  return (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col">
      <nav className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="text-gray-500 hover:text-white transition-colors text-sm">← Home</Link>
        <Logo />
        <Link
          href="/"
          className="bg-white text-black px-4 py-2 text-xs font-bold rounded-full hover:opacity-80 transition-opacity whitespace-nowrap"
        >
          Ask →
        </Link>
      </nav>

      {!email ? <NoCookieState /> : <SignedInState email={email} />}
    </div>
  )
}

function NoCookieState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-4">Your court</p>
      <h1 className="text-3xl font-bold mb-4 max-w-md">Ask me something first.</h1>
      <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-sm">
        Once you send me a question I&apos;ll set up your court. No account needed.
      </p>
      <Link
        href="/"
        className="bg-white text-black px-6 py-3 text-sm font-bold rounded-full hover:opacity-80 transition-opacity"
      >
        Ask me something →
      </Link>
    </div>
  )
}

async function fetchPopular(): Promise<PopularQuestion[]> {
  try {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('questions')
      .select('id, question')
      .eq('status', 'approved')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20)
    if (!data) return []
    const seen = new Set<string>()
    const out: PopularQuestion[] = []
    for (const row of data) {
      const key = row.question.trim().toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ id: row.id, question: row.question })
    }
    return out
  } catch {
    return []
  }
}

type PlayerProfile = {
  firstName: string | null
  position: string | null
  level: string | null
  challenge: string | null
  isFoundingMember: boolean
}

const LEVEL_LABELS: Record<string, string> = {
  middle_school: 'Middle school',
  jv: 'JV',
  varsity: 'Varsity',
  aau: 'AAU',
  college: 'College',
  pro: 'Pro',
  rec: 'Rec',
}

function prettyLevel(raw: string | null): string | null {
  if (!raw) return null
  const normalized = raw.toLowerCase().trim()
  return LEVEL_LABELS[normalized] || raw
}

async function fetchProfile(email: string): Promise<PlayerProfile> {
  try {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('profiles')
      .select('first_name, name, position, level, challenge, is_founding_member')
      .eq('email', email)
      .single()
    if (!data) {
      return { firstName: null, position: null, level: null, challenge: null, isFoundingMember: false }
    }
    const raw = (data.first_name || data.name || '').trim()
    // If they registered with a full name, just take the first token so the
    // greeting stays personal ("Hey Marcus") rather than formal.
    const firstName = raw ? raw.split(/\s+/)[0] : null
    return {
      firstName,
      position: data.position || null,
      level: data.level || null,
      challenge: data.challenge || null,
      isFoundingMember: data.is_founding_member === true,
    }
  } catch {
    return { firstName: null, position: null, level: null, challenge: null, isFoundingMember: false }
  }
}

async function SignedInState({ email }: { email: string }) {
  const supabase = getSupabase()
  const [{ data: myData }, popular, profile] = await Promise.all([
    supabase
      .from('questions')
      .select('id, question, answer, status, created_at, approved_at')
      .eq('email', email)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(30),
    fetchPopular(),
    fetchProfile(email),
  ])

  const questions = (myData || []) as QuestionRow[]
  const approved = questions.filter((q) => q.status === 'approved')
  const pending = questions.filter((q) => q.status !== 'approved')
  const myQuestionTexts = new Set(questions.map((q) => q.question.trim().toLowerCase()))
  const feed = popular.filter((p) => !myQuestionTexts.has(p.question.trim().toLowerCase())).slice(0, 6)

  // First approved question is the "freshest reward" and gets the celebratory
  // glow treatment. Older approved ones render as the accumulating library
  // below — retention lives in the stacked collection, not endless glow.
  const freshAnswer = approved[0] || null
  const libraryAnswers = approved.slice(1)

  // Member-since = oldest question they've submitted. Cheap "you've been
  // here" signal without a separate users.created_at query.
  const oldestQuestion = questions[questions.length - 1]
  const joinedLabel = oldestQuestion
    ? new Date(oldestQuestion.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  const greeting = profile.firstName ? `Hey ${profile.firstName}` : 'Your court'
  const initial = (profile.firstName || email)[0].toUpperCase()
  const profileLine = [prettyLevel(profile.level), profile.position].filter(Boolean).join(' · ')
  const profileComplete = Boolean(profile.firstName && profile.level && profile.position && profile.challenge)

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-4">Your court</p>
        <h1 className="text-2xl font-bold mb-3">No questions here yet.</h1>
        <p className="text-gray-500 text-sm mb-10">Ask me something and I&apos;ll set up your court.</p>
        <Link
          href="/"
          className="bg-white text-black px-6 py-3 text-sm font-bold rounded-full hover:opacity-80 transition-opacity"
        >
          Ask me something →
        </Link>
      </div>
    )
  }

  return (
    <div className="flex-1 px-5 pt-6 max-w-xl mx-auto w-full pb-32">
      {/* Small page label — "Your court" identity, not a greeting. */}
      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">Your court</p>

      {/* Profile card — dashboard-style identity block. Avatar + greeting
          + level/position line + stats row + edit link. If the profile is
          incomplete, the bottom of the card softly nudges them to finish
          it (never blocking). */}
      <div className="rounded-2xl border border-gray-800 bg-gradient-to-b from-[#0d0d0d] to-[#070707] p-5 mb-6">
        <div className="flex items-start gap-4">
          <div
            className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ background: 'linear-gradient(135deg, #2a2a2a 0%, #0a0a0a 100%)', border: '1px solid #2a2a2a' }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight leading-tight">{greeting}.</h1>
              <Link
                href="/profile"
                className="text-[10px] text-gray-600 hover:text-white transition-colors uppercase tracking-widest whitespace-nowrap shrink-0 mt-1.5"
              >
                Edit →
              </Link>
            </div>
            {profile.isFoundingMember && (
              // First-30-members flag lives on profiles.is_founding_member
              // (set by ask/route.ts maybeMarkFoundingMember). Badge is the
              // retention perk — "I was here early" is the reward.
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-amber-400">
                <span aria-hidden="true">★</span>
                Founding member
              </p>
            )}
            {profileLine && (
              <p className="text-xs text-gray-400 mt-1">{profileLine}</p>
            )}
            {profile.challenge && (
              <p className="text-xs text-gray-500 mt-1 italic">Working on: {profile.challenge}</p>
            )}
          </div>
        </div>

        {/* Stats row — asked / answered / joined. Not a streak or badge
            system (those belong in v2 after retention data proves out). */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-900">
          <Stat value={questions.length} label={questions.length === 1 ? 'Asked' : 'Asked'} />
          <Stat value={approved.length} label={approved.length === 1 ? 'Answered' : 'Answered'} />
          <Stat value={joinedLabel || '—'} label="Joined" />
        </div>

        {!profileComplete && (
          <div className="mt-4 pt-4 border-t border-gray-900">
            <Link
              href="/profile"
              className="flex items-center justify-between text-xs text-gray-500 hover:text-white transition-colors group"
            >
              <span>Finish your profile so my answers hit more specifically</span>
              <span className="text-gray-600 group-hover:text-white transition-colors">→</span>
            </Link>
          </div>
        )}
      </div>

      {/* Expectation line — single source of truth for queue timing. */}
      <p className="text-xs text-gray-500 leading-relaxed mb-6">
        I answer every one personally. My queue runs 24&ndash;48 hours. When I reply, it&apos;ll land in your inbox.
      </p>

      {/* First-visit welcome banner. Dismissible, localStorage-gated. */}
      <CourtWelcomeBanner />

      {/* Fresh answer — the latest reward, green glow + pulsing dot. Only
          the newest approved one gets this treatment so the signal stays
          meaningful as the library grows. */}
      {freshAnswer && (
        <div className="mb-10">
          <div
            className="rounded-2xl p-5 relative overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #0f2a12 0%, #081408 100%)',
              border: '1px solid #1f4a22',
              boxShadow: '0 0 40px -10px rgba(74, 222, 128, 0.25)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
              <span className="text-[10px] uppercase tracking-widest text-green-400 font-semibold">
                Elijah wrote you back
              </span>
              {freshAnswer.approved_at && (
                <span className="text-[10px] text-gray-500 ml-auto">
                  {formatDate(freshAnswer.approved_at)}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold leading-snug text-white italic mb-4">
              &ldquo;{freshAnswer.question}&rdquo;
            </p>
            {freshAnswer.answer && (
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                {freshAnswer.answer}
              </p>
            )}
            <div className="mt-4 pt-4 border-t border-green-900/40 flex justify-end">
              <ShareAnswerButton questionId={freshAnswer.id} question={freshAnswer.question} />
            </div>
          </div>
        </div>
      )}

      {/* Inline ask composer — post-reward moment is when the "ask another"
          impulse is highest. Keeps the Hooked loop tight: reward → compose
          → new pending card without ever leaving this page. */}
      <InlineAskComposer />

      {/* Pending — cards show Elijah's AI draft so the player re-reads
          their first-take here (same reveal moment as the homepage, now
          in the context of their court). Framed as "my draft, I'm still
          writing yours" to set the correct expectation. */}
      {pending.length > 0 && (
        <div className="mb-12">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">
            {pending.length === 1 ? "What I'm working on" : `What I'm working on (${pending.length})`}
          </p>
          <div className="space-y-4">
            {pending.map((q) => (
              <div
                key={q.id}
                className="rounded-xl p-4"
                style={{
                  background: '#0a0d1a',
                  border: '1px solid #1a2040',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-semibold">
                    I&apos;m reviewing
                  </span>
                  <span className="text-[10px] text-gray-600 ml-auto">
                    {formatDate(q.created_at)}
                  </span>
                </div>
                <p className="text-sm font-semibold leading-snug text-white italic mb-3">
                  &ldquo;{q.question}&rdquo;
                </p>
                {q.answer && (
                  <>
                    <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                      My AI draft — I&apos;m rewriting this one personally
                    </p>
                    <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
                      {q.answer}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permanent library — accumulating value. Older answered questions
          that don't need the celebratory treatment anymore. */}
      {libraryAnswers.length > 0 && (
        <div className="mb-12">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">
            Your answers from me
          </p>
          <div className="space-y-4">
            {libraryAnswers.map((q) => (
              <div
                key={q.id}
                className="rounded-xl p-4 border border-gray-900 bg-[#0a0a0a]"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-[10px] uppercase tracking-widest text-green-400 font-semibold">
                    Answered
                  </span>
                  {q.approved_at && (
                    <span className="text-[10px] text-gray-600 ml-auto">
                      {formatDate(q.approved_at)}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold leading-snug text-white italic mb-3">
                  &ldquo;{q.question}&rdquo;
                </p>
                {q.answer && (
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {q.answer}
                  </p>
                )}
                <div className="mt-3 pt-3 border-t border-gray-900 flex justify-end">
                  <ShareAnswerButton questionId={q.id} question={q.question} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tribe reward + next-trigger loader. Tap → /?q=... pre-fills the
          ask input on the homepage. */}
      {feed.length > 0 && (
        <div className="mb-16">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">
            What other players are asking
          </p>
          <div className="flex flex-col gap-2">
            {feed.map((p) => (
              <Link
                key={p.id}
                href={`/?q=${encodeURIComponent(p.question)}`}
                className="group flex items-start justify-between gap-3 border border-gray-900 hover:border-gray-700 rounded-xl p-4 transition-colors"
              >
                <p className="text-sm text-gray-300 italic leading-snug group-hover:text-white transition-colors">
                  &ldquo;{p.question}&rdquo;
                </p>
                <span className="shrink-0 text-[10px] text-gray-600 uppercase tracking-widest whitespace-nowrap mt-0.5">
                  Ask →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Soft upgrade path. The primary "ask another" action lives in the
          InlineAskComposer up top — no need for a redundant bottom pill. */}
      <div className="flex flex-col items-center gap-4">
        <Link
          href="/sign-up"
          className="text-xs text-gray-500 hover:text-white transition-colors text-center"
        >
          Save your court to an account &rarr;
        </Link>
      </div>
    </div>
  )
}
