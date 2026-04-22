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
 * Stateless tracking page. Shows the player's questions based on the signed
 * `ae_track` cookie that /api/verify-email sets after Kickbox verification.
 * No account, no password, no auth session required — the signed cookie is
 * enough to prove that this browser submitted the email.
 *
 * Cookie is same-browser-only by design. Cross-device access = create an
 * account (the "Save to your account" CTA below).
 */
export default async function TrackPage() {
  const email = await readTrackEmail()

  return (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col">
      <nav className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="text-gray-500 hover:text-white transition-colors text-sm">← Home</Link>
        <Logo />
        <Link href="/ask" className="text-xs font-semibold text-white hover:opacity-70 transition-opacity whitespace-nowrap">
          Ask →
        </Link>
      </nav>

      {!email ? (
        <NoCookieState />
      ) : (
        <SignedInState email={email} />
      )}
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

async function SignedInState({ email }: { email: string }) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('questions')
    .select('id, question, answer, status, created_at, approved_at')
    .eq('email', email)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const questions = (data || []) as QuestionRow[]
  const approvedCount = questions.filter((q) => q.status === 'approved').length

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
    <div className="flex-1 px-5 py-6 max-w-xl mx-auto w-full pb-20">
      <div className="mb-6">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Tracking for</p>
        <p className="text-sm text-gray-400 mb-5 break-all">{email}</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {questions.length} question{questions.length === 1 ? '' : 's'}
        </h1>
        {approvedCount > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            {approvedCount} answered by Elijah
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {questions.map((q) => {
          const isApproved = q.status === 'approved'
          const isPending = q.status === 'pending'
          return (
            <div
              key={q.id}
              className="rounded-xl p-4"
              style={{
                background: isApproved ? '#0a1a0a' : isPending ? '#0a0d1a' : '#0a0a0a',
                border: `1px solid ${isApproved ? '#1a3a1a' : isPending ? '#1a2040' : '#1a1a1a'}`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: isApproved ? '#4ade80' : isPending ? '#6366f1' : '#555' }}
                />
                <span
                  className="text-[9px] uppercase tracking-widest"
                  style={{ color: isApproved ? '#4ade80' : isPending ? '#6366f1' : '#555' }}
                >
                  {isApproved ? 'Elijah answered' : isPending ? 'Elijah is reviewing' : 'Skipped'}
                </span>
                <span className="text-[9px] text-gray-600 ml-auto">{formatDate(q.created_at)}</span>
              </div>
              <p className="text-sm font-semibold leading-snug text-white italic mb-3">&ldquo;{q.question}&rdquo;</p>
              {isApproved && q.answer && (
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mt-3 pt-3 border-t border-gray-900">
                  {q.answer}
                </p>
              )}
              {isPending && (
                <p className="text-xs text-gray-500 leading-relaxed">
                  You&apos;ll get an email when I send my personal reply.
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-10 flex flex-col items-center gap-4">
        <Link
          href="/"
          className="w-full max-w-xs text-center bg-white text-black px-6 py-3 text-sm font-bold rounded-full hover:opacity-80 transition-opacity"
        >
          Ask me another →
        </Link>
        <Link
          href="/sign-up"
          className="text-xs text-gray-500 hover:text-white transition-colors"
        >
          Save these to an account so you can see them from any device →
        </Link>
      </div>
    </div>
  )
}
