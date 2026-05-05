import Link from 'next/link'
import ThreeDots from '@/components/ui/ThreeDots'
import { FOUNDING_SEAT_LIMIT, getFoundingSeatCount, getFoundingSeatsLeft } from '@/lib/founding-seats'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type Founder = {
  name: string | null
  city: string | null
}

async function getFounders(): Promise<Founder[]> {
  try {
    const { data, error } = await getSupabase()
      .from('waitlist')
      .select('name, city')
      .eq('approved', true)
      .eq('founders_wall_opt_in', true)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) return []
    return (data || []).filter((row) => row.name && row.city)
  } catch {
    return []
  }
}

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

export default async function FoundersPage() {
  const [seatsTaken, founders] = await Promise.all([
    getFoundingSeatCount(),
    getFounders(),
  ])
  const seatsLeft = getFoundingSeatsLeft(seatsTaken) ?? 196

  return (
    <main className="min-h-[100dvh] bg-black text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-[10px] font-black uppercase tracking-[0.18em] text-gray-600 sm:inline">
            {seatsLeft} seats left
          </span>
          <Link href="/pricing" className="rounded-full bg-white px-5 py-3 text-sm font-black text-black">
            Apply →
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <p className="mb-5 text-[10px] font-black uppercase tracking-[0.28em] text-gray-600">
          THE ROSTER
        </p>
        <h1 className="text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
          The Founders 200.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-500">
          The original class. Locked at $9.99/mo for life. The door closes when it fills.
        </p>
        <p className="mt-8 text-4xl font-black tabular-nums text-[#F7F5F0]">
          {seatsLeft} / {FOUNDING_SEAT_LIMIT} SEATS LEFT
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        {founders.length === 0 ? (
          <div className="rounded-[2rem] border border-gray-900 bg-[#050505] p-8">
            <p className="text-sm font-semibold leading-relaxed text-gray-500">
              No public founders yet. Opt-in names appear here after acceptance.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {founders.map((founder, index) => (
              <div key={`${founder.name}-${founder.city}-${index}`} className="rounded-[1.5rem] border border-gray-900 bg-[#050505] p-5">
                <ThreeDots size={3} color="#F7F5F0" />
                <p className="mt-5 text-lg font-black text-white">
                  {founder.name} · {founder.city}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <Link href="/pricing" className="inline-flex rounded-full bg-white px-7 py-4 text-sm font-black text-black">
            Apply for a Founding seat →
          </Link>
        </div>
      </section>
    </main>
  )
}
