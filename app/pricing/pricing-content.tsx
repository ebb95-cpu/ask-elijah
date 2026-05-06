import Link from 'next/link'
import FoundersBetaForm from './founders-beta-form'
import CheckoutButton from './checkout-button'
import { FOUNDING_SEAT_LIMIT, getFoundingSeatCount, getFoundingSeatsLeft } from '@/lib/founding-seats'
import type { PricingPhase } from '@/lib/pricing-phase'
import { RiskReversal } from '@/components/marketing/ValueStack'

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

function FoundingSeatCounter({ count }: { count: number | null }) {
  const remaining = getFoundingSeatsLeft(count)
  const closed = remaining !== null && remaining <= 0
  return (
    <p className="inline-flex rounded-full border border-gray-900 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#F7F5F0]">
      {closed ? 'Founders 200 closed' : remaining === null ? `${FOUNDING_SEAT_LIMIT} founding seats` : `${remaining} seats left`}
    </p>
  )
}

function SimpleRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t border-gray-900 py-5">
      <p className="text-lg font-black leading-tight text-white">{title}</p>
      <p className="mt-2 max-w-xl text-sm font-semibold leading-relaxed text-gray-500">{body}</p>
    </div>
  )
}

function PromiseSection() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-14">
      <p className="mb-5 text-[10px] font-black uppercase tracking-[0.28em] text-gray-600">
        The missing layer
      </p>
      <h2 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
        Skill is built in the gym. Access is controlled by the nervous system.
      </h2>
      <p className="mt-6 max-w-2xl text-base font-semibold leading-relaxed text-gray-500">
        You can pay for training, teams, camps, and exposure. But when pressure hits, the brain decides how much of that work the player can actually use.
      </p>
      <div className="mt-8 rounded-[2rem] border border-gray-900 bg-[#050505] p-6">
        <p className="text-2xl font-black leading-tight text-[#F7F5F0]">
          Train the skill. Then train the state.
        </p>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-relaxed text-gray-500">
          Under stress, attention narrows, breathing changes, muscles tighten, and working memory drops. That is why a player can look ready in practice and frozen in the game.
        </p>
      </div>
      <div className="mt-10 border-b border-gray-900">
        <SimpleRow
          title="Ask real questions."
          body="Confidence after mistakes, coach pressure, playing time, slumps, fear, parents, recruiting, or whatever is changing the state behind the skill."
        />
        <SimpleRow
          title="Get a reviewed answer."
          body="Elijah reviews the answer before it reaches you. The goal is to help the player understand what is happening and what to do next."
        />
        <SimpleRow
          title="Apply it and report back."
          body="The room is built around follow-through. The most engaged players are the ones showing how they used the answer in real life."
        />
        <SimpleRow
          title="Help build the room."
          body="Founders shape what comes next. Clip reviews, deeper breakdowns, and bonus drops get added around what players are actually applying."
        />
      </div>
    </section>
  )
}

const COST_CARDS = [
  {
    tag: 'AAU AND TEAM FEES',
    price: '$500 to $3,000+ / season',
    body: 'Gets him games. But games alone do not explain why he freezes, why he is losing minutes, or why he stopped talking on the ride home.',
  },
  {
    tag: 'PRIVATE BASKETBALL TRAINER',
    price: '$75 to $200+ / session',
    body: 'Great for skill work. Most trainers are not answering the confidence, role, pressure, and coach problems that follow you home.',
  },
  {
    tag: 'CAMPS AND SHOWCASES',
    price: '$150 to $500+ / event',
    body: 'Useful exposure. Exposure does not help much if he gets tight the moment coaches are watching.',
  },
  {
    tag: 'SPORT PSYCHOLOGIST',
    price: '$100 to $250+ / session',
    body: 'Helpful for mental skills. Ask Elijah is different because the answer comes through someone who has lived the bench, the pressure, the slump, and the locker room.',
  },
  {
    tag: 'SPORTS PHYSIO',
    price: '$100 to $300 / visit',
    body: 'Important when his body needs help. This is for the part nobody can stretch out: fear, doubt, playing time, identity, and what to do next.',
  },
  {
    tag: 'RECRUITING ADVICE',
    price: '$100 to $300+ / call',
    body: 'Helpful for decisions. Players still need help with the pressure, the comparison, and what to actually do this week.',
  },
  {
    tag: 'PRO LOCKER-ROOM PERSPECTIVE',
    price: 'Usually not available',
    body: 'NBA and EuroLeague champion context. Coach problems. Role problems. Confidence problems. The stuff players do not always say out loud.',
  },
]

function CostComparisonSection() {
  return (
    <section className="mx-auto max-w-5xl px-5 pb-14">
      <p className="mb-5 text-[10px] font-black uppercase tracking-[0.28em] text-gray-600">
        The things you are already paying for
      </p>
      <h2 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
        This is the part most families miss.
      </h2>
      <p className="mt-6 max-w-2xl text-base font-semibold leading-relaxed text-gray-500">
        Skill, exposure, and recovery matter. None of them answer the question sitting in his head.
      </p>

      <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {COST_CARDS.map((card) => (
          <div key={card.tag} className="rounded-[2rem] border border-gray-900 bg-[#050505] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-600">{card.tag}</p>
            <p className="mt-6 text-3xl font-black leading-tight text-white">{card.price}</p>
            <p className="mt-5 text-sm font-semibold leading-relaxed text-gray-500">{card.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[2rem] bg-[#F7F5F0] p-7 text-black">
        <h3 className="text-3xl font-black leading-tight">Ask Elijah fills the gap.</h3>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-black/60">
          It does not replace a trainer, therapist, doctor, or physio. It gives players the conversation they usually cannot get: a pro who has lived the bench, the pressure, the role changes, the slumps, the injuries, the locker room, and the next rep.
        </p>
      </div>
    </section>
  )
}

function PriceSection({ seatsTaken }: { seatsTaken: number | null }) {
  const seatsLeft = getFoundingSeatsLeft(seatsTaken) ?? 196
  const closed = seatsLeft <= 0

  return (
    <section className="mx-auto max-w-5xl px-5 pb-16" id="locker-room">
      <div className="grid items-start gap-4 md:grid-cols-2">
        <div className="rounded-[2rem] bg-[#F7F5F0] p-7 text-black">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/50">Founders 200</p>
          <p className="mt-5 text-5xl font-black">$9.99/mo</p>
          <p className="mt-3 text-sm font-black text-black/60">Locked while your membership stays active.</p>
          <p className="mt-8 text-3xl font-black tabular-nums">{closed ? 'Founders 200 closed' : `${seatsLeft} / 200 seats left`}</p>
          <Link href="#founders-application" className="mt-8 inline-flex rounded-full bg-black px-6 py-4 text-sm font-black text-white">
            {closed ? 'Join Locker Room waitlist →' : 'Apply for a founding seat →'}
          </Link>
          <CheckoutButton
            plan="founders_monthly"
            isFoundingMember
            className="mt-3 text-left text-xs font-black text-black/45 transition-colors hover:text-black disabled:opacity-40"
          >
            Accepted already? Activate $9.99 checkout →
          </CheckoutButton>
        </div>

        <div className="rounded-[2rem] border border-gray-900 bg-[#050505] p-7 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-600">Locker Room</p>
          <p className="mt-5 text-5xl font-black">$14.99/mo</p>
          <p className="mt-3 text-sm font-black text-gray-500">or $129/year after the Founders window.</p>
          <p className="mt-8 text-base font-semibold leading-relaxed text-gray-500">
            Same room. Public price. No founding rate.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CheckoutButton
              plan="locker_monthly"
              showPromoCode
              className="w-full rounded-full bg-white px-6 py-4 text-sm font-black text-black disabled:opacity-40"
            >
              Start monthly →
            </CheckoutButton>
            <CheckoutButton
              plan="locker_annual"
              className="w-full rounded-full border border-gray-800 px-6 py-4 text-sm font-black text-white transition-colors hover:border-gray-600 disabled:opacity-40"
            >
              Start annual →
            </CheckoutButton>
          </div>
          <Link href="#founders-application" className="mt-4 inline-flex text-xs font-black text-gray-600 transition-colors hover:text-white">
            Not ready? Join the waitlist →
          </Link>
        </div>
      </div>

      <RiskReversal />
    </section>
  )
}

function PricingBody({ seatsTaken }: { seatsTaken: number | null }) {
  const isClosed = seatsTaken !== null && seatsTaken >= FOUNDING_SEAT_LIMIT

  return (
    <>
      <section className="mx-auto grid max-w-5xl gap-10 px-5 pb-12 pt-14 sm:pt-20 lg:grid-cols-[1fr_0.9fr] lg:items-start" id="founders-application">
        <div>
          <p className="mb-5 text-[10px] font-black uppercase tracking-[0.28em] text-gray-600">
            Founders beta
          </p>
          <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
            Build it with me.
            <span className="block text-gray-500">Keep the early rate.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-semibold leading-relaxed text-gray-500">
            Founders ask for free while the room is being built. The work is simple: ask, apply, report back. If accepted, you keep $9.99/mo for life as long as your membership stays active.
          </p>
          <div className="mt-7">
            <FoundingSeatCounter count={seatsTaken} />
          </div>
        </div>
        <FoundersBetaForm closed={isClosed} />
      </section>
      <PromiseSection />
      <CostComparisonSection />
      <PriceSection seatsTaken={seatsTaken} />
    </>
  )
}

export async function PricingPageContent({ phase: _phase, isPreview: _isPreview = false }: { phase: PricingPhase; isPreview?: boolean }) {
  const seatsTaken = await getFoundingSeatCount()
  return (
    <main className="min-h-[100dvh] bg-black text-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">
            <FoundingSeatCounter count={seatsTaken} />
          </span>
          <Link href="/browse" className="text-sm text-gray-500 transition-colors hover:text-white">
            Browse answers
          </Link>
        </div>
      </nav>

      <PricingBody seatsTaken={seatsTaken} />
    </main>
  )
}
