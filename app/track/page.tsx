import Link from 'next/link'
import { readTrackEmail } from '@/lib/track-cookie'
import { getSupabase } from '@/lib/supabase-server'
import LockerRoomWelcomeBanner from '@/components/LockerRoomWelcomeBanner'
import ShareAnswerButton from '@/components/ShareAnswerButton'
import InlineAskComposer from '@/components/InlineAskComposer'
import ProfileSyncer from '@/components/ProfileSyncer'
import SignOutButton from '@/components/SignOutButton'

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
    <div className="flex flex-col">
      <span className="text-2xl font-bold tabular-nums leading-none tracking-tight">{value}</span>
      <span className="text-[10px] text-gray-600 uppercase tracking-widest mt-2">{label}</span>
    </div>
  )
}

/**
 * "Your locker room" — the player's home, not a tracker.
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
        <Link href={email ? '/track' : '/'} className="text-gray-500 hover:text-white transition-colors text-sm">
          {email ? '← Locker room' : '← Home'}
        </Link>
        <Logo />
        <div className="flex items-center gap-3">
          {email && (
            <SignOutButton
              className="text-xs text-gray-600 hover:text-white transition-colors"
              label="Sign out"
            />
          )}
          <Link
            href="/ask"
            className="bg-white text-black px-4 py-2 text-xs font-bold rounded-full hover:opacity-80 transition-opacity whitespace-nowrap"
          >
            Ask →
          </Link>
        </div>
      </nav>

      {!email ? <NoCookieState /> : <SignedInState email={email} />}
    </div>
  )
}

function NoCookieState() {
  return (
    <div className="flex-1 flex flex-col justify-center px-6 pb-20 max-w-sm mx-auto w-full">
      <p className="text-[10px] text-gray-700 uppercase tracking-widest mb-8">Your locker room</p>
      <h1 className="text-4xl font-bold tracking-tight leading-tight mb-5">
        Ask me something first.
      </h1>
      <p className="text-gray-500 text-sm leading-relaxed mb-12">
        Once you send me a question I&apos;ll set up your locker room. No account needed.
      </p>
      <Link
        href="/"
        className="text-sm font-semibold text-white hover:opacity-60 transition-opacity"
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

  const greeting = profile.firstName ? `Hey ${profile.firstName}` : 'Your locker room'
  const initial = (profile.firstName || email)[0].toUpperCase()
  const profileLine = [prettyLevel(profile.level), profile.position].filter(Boolean).join(' · ')
  const profileComplete = Boolean(profile.firstName && profile.level && profile.position && profile.challenge)

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center px-6 pb-20 max-w-sm mx-auto w-full">
        <p className="text-[10px] text-gray-700 uppercase tracking-widest mb-8">Your locker room</p>
        <h1 className="text-4xl font-bold tracking-tight leading-tight mb-5">No questions yet.</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-12">
          Ask me something and I&apos;ll set up your locker room.
        </p>
        <Link href="/" className="text-sm font-semibold text-white hover:opacity-60 transition-opacity">
          Ask me something →
        </Link>
      </div>
    )
  }

  return (
    <div className="flex-1 px-6 pt-8 max-w-xl mx-auto w-full pb-32">

      {/* ── Identity block ───────────────────────────────────────────────
          No card box. Let the content breathe. Stats sit below the
          greeting as a clean row — no borders wrapping everything. */}
      <div className="mb-12">
        <div className="flex items-start justify-between mb-1">
          <h1 className="text-4xl font-bold tracking-tight leading-tight">{greeting}.</h1>
          <Link
            href="/profile"
            className="text-[10px] text-gray-700 hover:text-white transition-colors uppercase tracking-widest mt-3"
          >
            Edit →
          </Link>
        </div>

        {profile.isFoundingMember && (
          <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-amber-400 mb-1">
            <span aria-hidden="true">★</span>Founding member
          </p>
        )}
        {profileLine && (
          <p className="text-sm text-gray-500 mt-1">{profileLine}</p>
        )}
        {profile.challenge && (
          <p className="text-sm text-gray-600 mt-1 italic">Working on: {profile.challenge}</p>
        )}

        <div className="flex items-center gap-10 mt-8">
          <Stat value={questions.length} label="Asked" />
          <Stat value={approved.length} label="Answered" />
          {joinedLabel && <Stat value={joinedLabel} label="Since" />}
        </div>

        {!profileComplete && (
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-white transition-colors mt-6 group"
          >
            <span>Finish your profile so my answers are more specific</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        )}
      </div>

      {/* Hidden syncer + banner — no visual footprint */}
      <ProfileSyncer />
      <LockerRoomWelcomeBanner struggle={profile.challenge} />

      {/* ── Expectation line ─────────────────────────────────────────── */}
      <p className="text-xs text-gray-600 leading-relaxed mb-12">
        I answer every one personally. Queue runs 24 to 48 hours. You&apos;ll get it in your inbox.
      </p>

      {/* ── Fresh answer ─────────────────────────────────────────────────
          White left bar distinguishes the newest answer. No glow, no
          green — the content is the reward, not the notification chrome. */}
      {freshAnswer && (
        <div className="border-l-2 border-white pl-6 mb-14">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] text-white uppercase tracking-widest font-semibold">
              New
            </p>
            {freshAnswer.approved_at && (
              <span className="text-[10px] text-gray-600">{formatDate(freshAnswer.approved_at)}</span>
            )}
          </div>
          <p className="text-sm text-gray-400 italic leading-relaxed mb-5">
            &ldquo;{freshAnswer.question}&rdquo;
          </p>
          {freshAnswer.answer && (
            <p className="text-base text-gray-100 leading-[1.85] whitespace-pre-wrap">
              {freshAnswer.answer}
            </p>
          )}
          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-gray-700">— Elijah</p>
            <ShareAnswerButton questionId={freshAnswer.id} question={freshAnswer.question} />
          </div>
        </div>
      )}

      {/* ── Ask composer — Hooked loop: reward fires, then immediately
          surfaces the next trigger ───────────────────────────────────── */}
      <InlineAskComposer />

      {/* ── Pending questions ────────────────────────────────────────────
          Gray left bar signals "in progress" without a status label.
          "On my way." tells them something is coming without overpromising. */}
      {pending.length > 0 && (
        <div className="mb-14">
          <p className="text-[10px] text-gray-700 uppercase tracking-widest mb-6">
            {pending.length === 1 ? 'In progress' : 'In progress'}
          </p>
          <div className="space-y-8">
            {pending.map((q) => (
              <div key={q.id} className="border-l border-gray-800 pl-6">
                <p className="text-sm text-gray-500 italic leading-relaxed mb-3">
                  &ldquo;{q.question}&rdquo;
                </p>
                {q.answer ? (
                  <p className="text-base text-gray-100 leading-[1.85] whitespace-pre-wrap">
                    {q.answer}
                  </p>
                ) : (
                  <p className="text-xs text-gray-700 italic">On my way.</p>
                )}
                <p className="text-[10px] text-gray-800 mt-4">{formatDate(q.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Answer library ───────────────────────────────────────────────
          Gray left bar, unified with pending. Attribution on every answer
          reinforces that this came from a real person. */}
      {libraryAnswers.length > 0 && (
        <div className="mb-14">
          <p className="text-[10px] text-gray-700 uppercase tracking-widest mb-6">
            {libraryAnswers.length === 1 ? 'Your answer' : 'Your answers'}
          </p>
          <div className="space-y-10">
            {libraryAnswers.map((q) => (
              <div key={q.id} className="border-l border-gray-800 pl-6">
                <p className="text-sm text-gray-500 italic leading-relaxed mb-4">
                  &ldquo;{q.question}&rdquo;
                </p>
                {q.answer && (
                  <p className="text-base text-gray-100 leading-[1.85] whitespace-pre-wrap">
                    {q.answer}
                  </p>
                )}
                <div className="flex items-center justify-between mt-5">
                  <p className="text-xs text-gray-700">— Elijah</p>
                  <ShareAnswerButton questionId={q.id} question={q.question} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Community feed ───────────────────────────────────────────────
          Clean list — no bordered cards. Tap pre-fills the ask input. */}
      {feed.length > 0 && (
        <div className="mb-16">
          <p className="text-[10px] text-gray-700 uppercase tracking-widest mb-6">
            What other players asked
          </p>
          <div className="flex flex-col">
            {feed.map((p) => (
              <Link
                key={p.id}
                href={`/?q=${encodeURIComponent(p.question)}`}
                className="group flex items-start justify-between gap-4 py-4 border-b border-gray-900 last:border-0"
              >
                <p className="text-sm text-gray-500 italic leading-snug group-hover:text-white transition-colors">
                  &ldquo;{p.question}&rdquo;
                </p>
                <span className="shrink-0 text-[10px] text-gray-700 group-hover:text-white transition-colors whitespace-nowrap mt-0.5">
                  Ask →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/sign-up"
        className="text-xs text-gray-700 hover:text-white transition-colors"
      >
        Save your locker room to an account &rarr;
      </Link>
    </div>
  )
}
