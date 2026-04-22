import Link from 'next/link'
import { readTrackEmail } from '@/lib/track-cookie'
import { getSupabase } from '@/lib/supabase-server'

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

/**
 * Stateless tracking page — no account required. Powered by the signed
 * `ae_track` cookie set by /api/verify-email. See lib/track-cookie.ts.
 *
 * UX follows the Hooked investment-phase playbook: celebrate the one
 * answered card (variable reward), set anticipation on pending ones
 * (when to expect a reply), surface a tribe reward (popular questions
 * from other players), and always keep the next trigger one tap away
 * (prominent Ask CTA).
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
      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-4">Track your question</p>
      <h1 className="text-3xl font-bold mb-4 max-w-md">Ask me something first.</h1>
      <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-sm">
        Once you send me a question I&apos;ll show the status here. No account needed.
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
    // De-dupe by question text so "how do I shoot better" doesn't appear twice.
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

async function SignedInState({ email }: { email: string }) {
  const supabase = getSupabase()
  const [{ data: myData }, popular] = await Promise.all([
    supabase
      .from('questions')
      .select('id, question, answer, status, created_at, approved_at')
      .eq('email', email)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(30),
    fetchPopular(),
  ])

  const questions = (myData || []) as QuestionRow[]
  const approved = questions.filter((q) => q.status === 'approved')
  const pending = questions.filter((q) => q.status !== 'approved')
  const myQuestionTexts = new Set(questions.map((q) => q.question.trim().toLowerCase()))
  const feed = popular.filter((p) => !myQuestionTexts.has(p.question.trim().toLowerCase())).slice(0, 6)

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-4">Track your question</p>
        <h1 className="text-2xl font-bold mb-3">No questions here yet.</h1>
        <p className="text-gray-500 text-sm mb-10">Ask me something and it&apos;ll show up here.</p>
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
      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Tracking for</p>
        <p className="text-sm text-gray-400 mb-6 break-all">{email}</p>
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          {questions.length} question{questions.length === 1 ? '' : 's'}
        </h1>
        {/* Single expectation line instead of repeating it on every pending card. */}
        <p className="text-xs text-gray-500 leading-relaxed">
          I answer every one personally. My queue runs 24&ndash;48 hours. When I reply, it&apos;ll land in your inbox.
        </p>
      </div>

      {/* Celebratory answered cards — pinned at the top, distinct treatment.
          One green-glowing card per answered question so the variable reward
          pops instead of being buried in the grid. */}
      {approved.length > 0 && (
        <div className="mb-10 space-y-4">
          {approved.map((q) => (
            <div
              key={q.id}
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
                {q.approved_at && (
                  <span className="text-[10px] text-gray-500 ml-auto">
                    {formatDate(q.approved_at)}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold leading-snug text-white italic mb-4">&ldquo;{q.question}&rdquo;</p>
              {q.answer && (
                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {q.answer}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pending — compact rows, not boxes. One dot, question, timestamp.
          No repeated "you'll get an email" line; the header already said it. */}
      {pending.length > 0 && (
        <div className="mb-12">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">
            In my queue ({pending.length})
          </p>
          <div className="flex flex-col">
            {pending.map((q, i) => (
              <div
                key={q.id}
                className={`flex items-start gap-3 py-3 ${i < pending.length - 1 ? 'border-b border-gray-900' : ''}`}
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                <p className="flex-1 text-sm text-gray-300 italic leading-snug">
                  &ldquo;{q.question}&rdquo;
                </p>
                <span className="text-[10px] text-gray-600 whitespace-nowrap mt-1">
                  {formatDate(q.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tribe reward + next-trigger loader — popular questions from other
          players, pre-fill into /ask. */}
      {feed.length > 0 && (
        <div className="mb-16">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">
            What players like you are asking
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

      {/* Terminal CTA + upgrade path */}
      <div className="flex flex-col items-center gap-4">
        <Link
          href="/"
          className="w-full max-w-xs text-center bg-white text-black px-6 py-3 text-sm font-bold rounded-full hover:opacity-80 transition-opacity"
        >
          Ask me another →
        </Link>
        <Link
          href="/sign-up"
          className="text-xs text-gray-500 hover:text-white transition-colors text-center"
        >
          Save these to an account so you can see them from any device &rarr;
        </Link>
      </div>
    </div>
  )
}
