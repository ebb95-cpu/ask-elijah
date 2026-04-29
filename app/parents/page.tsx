import Link from 'next/link'
import { getSupabase } from '@/lib/supabase-server'
import ParentLeadForm from './ParentLeadForm'

export const dynamic = 'force-dynamic'

type ParentAnswer = {
  id: string
  question: string
  answer: string
  asker_label?: string | null
}

const WRAPPERS = [
  "Here's what I told a player who messaged me about this. Your son might be feeling some version of it. Read it. Do not forward it. Let him find it himself.",
  "Read this like you are not his parent for a second. Then put your phone down.",
  "Half the kids on your son's roster are sitting on a version of this and not saying it.",
  "The answer is the same whether your son is a freshman or a senior.",
  "Read this and resist the urge to do anything with it. Just know what might be underneath when he gets quiet on the drive home.",
]

function Logo() {
  return (
    <svg width="52" height="8" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill="white" />
      <line x1="8" y1="4" x2="20" y2="4" stroke="white" strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill="white" />
      <line x1="28" y1="4" x2="40" y2="4" stroke="white" strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill="white" />
    </svg>
  )
}

async function getParentAnswers(): Promise<ParentAnswer[]> {
  try {
    const { data, error } = await getSupabase()
      .from('questions')
      .select('id, question, answer, asker_label')
      .eq('status', 'approved')
      .eq('public', true)
      .eq('parent_relevant', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(6)

    if (error) return []
    return data || []
  } catch {
    return []
  }
}

export default async function ParentsPage() {
  const answers = await getParentAnswers()

  return (
    <main className="min-h-[100dvh] bg-black text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label="Home"><Logo /></Link>
        <Link href="/pricing" className="rounded-full bg-white px-5 py-3 text-sm font-black text-black">
          Give him the locker room
        </Link>
      </nav>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <p className="mb-5 text-[10px] font-black uppercase tracking-[0.28em] text-gray-600">
          NBA · EuroLeague Champion · 3 continents
        </p>
        <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
          Your son is grinding 20 hours a week.
          <span className="block text-gray-500">He is still freezing in games.</span>
        </h1>
        <p className="mt-8 max-w-2xl text-xl leading-relaxed text-gray-400">
          He will not tell you what is going on in his head. That is because you are his parent.
          He will tell someone who has been there.
        </p>
        <Link href="/pricing" className="mt-10 inline-block rounded-full bg-white px-7 py-4 text-sm font-black text-black">
          Give him the locker room
        </Link>
      </section>

      <section className="border-y border-gray-900 px-5 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[0.8fr_1.2fr]">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-gray-600">Why this exists</p>
          <div className="max-w-2xl space-y-5 text-2xl font-bold leading-tight text-white">
            <p>You already paid for the trainer.</p>
            <p>You already paid for the team.</p>
            <p>You already paid for the shoes, camps, and travel.</p>
            <p className="text-gray-500">The freeze up is not a body problem. It is a mind problem.</p>
            <p>I coach that part.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-px px-5 py-16 md:grid-cols-3">
        {[
          ['A real first take.', "The first thing I would tell him if he asked me in person. On his screen, in 30 seconds."],
          ['A reviewed answer.', 'Within 24 to 48 hours, a full reply he can come back to all season.'],
          ['A locker room he owns.', 'Every answer saved. Every reflection logged. His. Not yours.'],
        ].map(([title, body]) => (
          <div key={title} className="border border-gray-900 bg-[#050505] p-7">
            <p className="text-xl font-black">{title}</p>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">{body}</p>
          </div>
        ))}
      </section>

      <section className="bg-[#F7F5F0] px-5 py-16 text-black">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-gray-500">This is for him. Not you.</p>
          <h2 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">You will not see his questions.</h2>
          <div className="mt-8 grid gap-6 text-lg font-semibold leading-relaxed text-gray-700 sm:grid-cols-2">
            <p>You will not read his answers. You will not see his profile, reflections, or saved items.</p>
            <p>You will see that he is using it. That is the signal that matters.</p>
          </div>
        </div>
      </section>

      {answers.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-16">
          <p className="mb-8 text-xs font-black uppercase tracking-[0.24em] text-gray-600">
            Here is what he would be reading
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {answers.map((answer, index) => (
              <article key={answer.id} className="rounded-[2rem] border border-gray-900 bg-[#050505] p-7">
                <p className="mb-5 text-sm leading-relaxed text-gray-500">{WRAPPERS[index % WRAPPERS.length]}</p>
                <p className="text-xl font-black leading-tight">&ldquo;{answer.question}&rdquo;</p>
                <p className="mt-5 line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-400">{answer.answer}</p>
                <Link href={`/browse/${answer.id}`} className="mt-6 inline-block text-sm font-bold text-white">
                  Read answer
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-4xl px-5 py-16">
        <ParentLeadForm />
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 text-center">
        <h2 className="text-4xl font-black leading-tight tracking-tight">He does not need another trainer.</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-500">
          He needs the inside the arena conversation no AAU coach has time for.
        </p>
        <Link href="/pricing" className="mt-9 inline-block rounded-full bg-white px-7 py-4 text-sm font-black text-black">
          Give him the locker room
        </Link>
      </section>
    </main>
  )
}
