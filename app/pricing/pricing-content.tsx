import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import type { ReactNode } from 'react'
import FoundersBetaForm from './founders-beta-form'
import { getSupabase } from '@/lib/supabase-server'
import type { PricingPhase } from '@/lib/pricing-phase'

const FOUNDING_SEAT_LIMIT = 200
const INNER_CIRCLE_LIMIT = 200

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

const getFoundingSeatCount = unstable_cache(async () => {
  try {
    const { count, error } = await getSupabase()
      .from('waitlist')
      .select('id', { count: 'exact', head: true })
      .eq('approved', true)

    if (error) return null
    return count || 0
  } catch {
    return null
  }
}, ['founding-seat-count'], { revalidate: 60 })

const getInnerCircleSeatCount = unstable_cache(async () => {
  try {
    const { count, error } = await getSupabase()
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('subscription_tier', ['inner_circle', 'founding_inner_circle'])
      .in('subscription_status', ['active', 'trialing'])

    if (error) return null
    return count || 0
  } catch {
    return null
  }
}, ['inner-circle-seat-count'], { revalidate: 60 })

function SeatCounter({ count, limit, label }: { count: number | null; limit: number; label: string }) {
  if (count === null) {
    return (
      <p className="mt-6 inline-flex rounded-full border border-gray-900 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-gray-500">
        Seats remaining
      </p>
    )
  }

  return (
    <p className="mt-6 inline-flex rounded-full border border-gray-900 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-gray-400">
      {count} of {limit} {label} taken
    </p>
  )
}

function DisplayCard({ label, price, body, cream = false }: { label: string; price: string; body: string; cream?: boolean }) {
  return (
    <div className={cream ? 'rounded-[2rem] bg-[#F7F5F0] p-6 text-black' : 'rounded-[2rem] border border-gray-900 bg-[#050505] p-6'}>
      <p className={cream ? 'text-xs font-black uppercase tracking-[0.22em] text-gray-500' : 'text-xs font-black uppercase tracking-[0.22em] text-gray-600'}>
        {label}
      </p>
      <p className="mt-4 text-3xl font-black">{price}</p>
      <p className={cream ? 'mt-3 text-sm font-semibold leading-relaxed text-gray-600' : 'mt-3 text-sm leading-relaxed text-gray-500'}>
        {body}
      </p>
    </div>
  )
}

function ValueStack() {
  const rows = [
    {
      label: 'Private basketball trainer',
      cost: '$75-$200+ / session',
      body: 'Great for skill work. But most trainers are not answering the confidence, role, pressure, and coach problems that follow you home.',
    },
    {
      label: 'Sport psychologist',
      cost: '$100-$250+ / session',
      body: 'Helpful for mental skills. Ask Elijah is different because the answer comes through someone who has lived the bench, the pressure, the slump, and the locker room.',
    },
    {
      label: 'Sports physio',
      cost: '$100-$300 / visit',
      body: 'Important when your body needs help. This is for the part nobody can stretch out: fear, doubt, playing time, identity, and what to do next.',
    },
    {
      label: 'Pro locker-room perspective',
      cost: 'Usually not available',
      body: 'NBA and EuroLeague champion context. Coach problems. Role problems. Confidence problems. The stuff players do not always say out loud.',
    },
  ]

  return (
    <section className="mx-auto max-w-6xl px-5 py-14">
      <div className="rounded-[2rem] border border-gray-900 bg-[#050505] p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-gray-600">
          What families already pay for
        </p>
        <div className="mt-8 grid gap-3 lg:grid-cols-4">
          {rows.map((row) => (
            <div key={row.label} className="rounded-[1.5rem] border border-gray-900 bg-black p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">{row.label}</p>
              <p className="mt-4 text-2xl font-black text-[#F7F5F0]">{row.cost}</p>
              <p className="mt-4 text-sm font-semibold leading-relaxed text-gray-500">{row.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-[1.5rem] bg-[#F7F5F0] p-5 text-black">
          <p className="text-2xl font-black">Ask Elijah is the missing part.</p>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-black/60">
            It does not replace a trainer, therapist, doctor, or physio. It gives players the conversation they usually cannot get:
            a pro who has been in the arena helping them understand what is happening and what rep to take next.
          </p>
        </div>
      </div>
    </section>
  )
}

function PublicTierCard({
  label,
  price,
  body,
  cream = false,
  children,
}: {
  label: string
  price: string
  body: string
  cream?: boolean
  children: ReactNode
}) {
  return (
    <div className={cream ? 'rounded-[2rem] border border-white bg-[#F7F5F0] p-7 text-black shadow-[0_0_80px_rgba(255,255,255,0.12)]' : 'rounded-[2rem] border border-gray-900 bg-[#050505] p-7'}>
      <p className={cream ? 'text-xs font-black uppercase tracking-[0.22em] text-gray-500' : 'text-xs font-black uppercase tracking-[0.22em] text-gray-600'}>
        {label}
      </p>
      <p className="mt-5 text-4xl font-black">{price}</p>
      <p className={cream ? 'mt-3 text-sm font-semibold leading-relaxed text-gray-600' : 'mt-3 text-sm leading-relaxed text-gray-500'}>
        {body}
      </p>
      <div className="mt-8 space-y-3">{children}</div>
    </div>
  )
}

function PreviewTiers() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16">
      <p className="mb-6 text-xs font-black uppercase tracking-[0.24em] text-gray-600">
        Preview: post-launch pricing
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DisplayCard label="Free" price="$0" body="Browse public answers. 1 trial question per month." />
        <DisplayCard label="Locker Room" price="$14.99/mo" body="$129/year if they want annual. Unlimited questions. Personal archive. Source citations. Reviewed by Elijah's standard." cream />
        <DisplayCard label="Inner Circle" price="$29/mo" body="$290/year if they want annual. Priority routing, deeper answer mode, and profile-aware answers. Capped at 200." />
        <DisplayCard label="Skip the Line" price="$29" body="Single fast-routed question for non-members. One per quarter." />
      </div>
    </section>
  )
}

async function BetaPricing() {
  const seatsTaken = await getFoundingSeatCount()
  const isClosed = seatsTaken !== null && seatsTaken >= FOUNDING_SEAT_LIMIT

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <p className="mb-5 text-[10px] font-black uppercase tracking-[0.28em] text-gray-600">
            Founders beta
          </p>
          <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
            Founding 200.
            <span className="block text-gray-500">Free during beta.</span>
          </h1>
          <p className="mt-5 text-2xl font-black leading-tight text-[#F7F5F0]">
            $9.99/mo for life after launch.
          </p>
          <SeatCounter count={seatsTaken} limit={FOUNDING_SEAT_LIMIT} label="seats" />
          <p className="mt-8 max-w-2xl text-base leading-relaxed text-gray-500">
            This is a 90-day beta. Founding members can ask unlimited questions for free while we build.
            Every Q&A goes to browse anonymized with first name, age, and city. If you are accepted,
            you lock the founding rate of $9.99/mo for life when public pricing turns on.
          </p>
        </div>
        <FoundersBetaForm closed={isClosed} />
      </section>
      <ValueStack />
      <PreviewTiers />
    </>
  )
}

async function PublicPricing({ isPreview = false }: { isPreview?: boolean }) {
  const innerCircleTaken = await getInnerCircleSeatCount()
  const innerCircleClosed = innerCircleTaken !== null && innerCircleTaken >= INNER_CIRCLE_LIMIT

  return (
    <>
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <p className="mb-5 text-[10px] font-black uppercase tracking-[0.28em] text-gray-600">
          {isPreview ? 'Pricing preview' : 'Locker room access'}
        </p>
        <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
          Ask better questions.
          <span className="block text-gray-500">Get real reps.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-gray-500">
          Public answers stay free. Paid plans are for players who want Elijah to answer their situation.
        </p>
      </section>

      <ValueStack />

      <section className="mx-auto grid max-w-6xl gap-4 px-5 lg:grid-cols-4">
        <PublicTierCard label="Free" price="$0" body="Browse public answers. 1 trial question per month.">
          <Link href="/browse" className="block rounded-full border border-gray-800 px-5 py-4 text-center text-sm font-black text-white hover:border-white">
            Browse free answers
          </Link>
        </PublicTierCard>

        <PublicTierCard
          label="Locker Room"
          price="$14.99/mo"
          body="Unlimited questions. Personal archive. Source citations. Reviewed by Elijah's standard."
          cream
        >
          {/* TODO: connect Stripe checkout for locker_monthly */}
          <button className="block w-full rounded-full bg-black px-5 py-4 text-center text-sm font-black text-white">
            Join monthly
          </button>
          {/* TODO: connect Stripe checkout for locker_annual */}
          <button className="block w-full rounded-full border border-black/20 px-5 py-4 text-center text-sm font-black text-black">
            Or $129/year
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">15% off annual</p>
        </PublicTierCard>

        <PublicTierCard
          label="Inner Circle"
          price="$29/mo"
          body="Everything in Locker Room plus priority routing, deeper answer mode, and profile-aware answers. Founding rate locked for life."
        >
          <SeatCounter count={innerCircleTaken} limit={INNER_CIRCLE_LIMIT} label="seats" />
          {innerCircleClosed ? (
            <div className="rounded-full border border-gray-800 px-5 py-4 text-center text-sm font-black text-gray-500">
              Closed. Waitlist.
            </div>
          ) : (
            <>
              {/* TODO: connect Stripe checkout for inner_circle_monthly */}
              <button className="block w-full rounded-full border border-gray-800 px-5 py-4 text-center text-sm font-black text-white hover:border-white">
                Join monthly
              </button>
              {/* TODO: connect Stripe checkout for inner_circle_annual */}
              <button className="block w-full rounded-full border border-gray-800 px-5 py-4 text-center text-sm font-black text-white hover:border-white">
                Or $290/year
              </button>
            </>
          )}
        </PublicTierCard>

        <PublicTierCard label="Skip the Line" price="$29" body="Single fast-routed question for non-members. One per quarter.">
          {/* TODO: connect Stripe checkout for priority */}
          <button className="block w-full rounded-full border border-gray-800 px-5 py-4 text-center text-sm font-black text-white hover:border-white">
            Ask one question
          </button>
        </PublicTierCard>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-[2rem] bg-[#F7F5F0] p-7 text-black">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-gray-500">Gift Card</p>
          <div className="mt-4 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h2 className="text-4xl font-black">$149</h2>
              <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-gray-600">
                One year of Locker Room as a giftable code.
              </p>
            </div>
            {/* TODO: connect Stripe checkout for gift_card_annual */}
            <button className="rounded-full bg-black px-6 py-4 text-sm font-black text-white">
              Gift one year
            </button>
          </div>
        </div>
        <p className="mt-6 text-center text-sm font-bold text-gray-600">
          Founding 200 members keep $9.99/mo for life.
        </p>
      </section>
    </>
  )
}

export async function PricingPageContent({ phase, isPreview = false }: { phase: PricingPhase; isPreview?: boolean }) {
  return (
    <main className="min-h-[100dvh] bg-black text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <Link href="/browse" className="text-sm text-gray-500 transition-colors hover:text-white">
          Browse answers
        </Link>
      </nav>

      {phase === 'public' ? <PublicPricing isPreview={isPreview} /> : <BetaPricing />}
    </main>
  )
}
