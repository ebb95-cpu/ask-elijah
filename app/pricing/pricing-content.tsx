import Link from 'next/link'
import FoundersBetaForm from './founders-beta-form'
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
  return (
    <p className="inline-flex rounded-full border border-gray-900 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#F7F5F0]">
      {remaining === null ? `${FOUNDING_SEAT_LIMIT} founding seats` : `${remaining} seats left`}
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

function PriceSection({ seatsTaken }: { seatsTaken: number | null }) {
  const seatsLeft = getFoundingSeatsLeft(seatsTaken) ?? 196

  return (
    <section className="mx-auto max-w-5xl px-5 pb-16" id="locker-room">
      <div className="grid items-start gap-4 md:grid-cols-2">
        <div className="rounded-[2rem] bg-[#F7F5F0] p-7 text-black">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/50">Founders 200</p>
          <p className="mt-5 text-5xl font-black">$9.99/mo</p>
          <p className="mt-3 text-sm font-black text-black/60">Locked while your membership stays active.</p>
          <p className="mt-8 text-3xl font-black tabular-nums">{seatsLeft} / 200 seats left</p>
          <Link href="#founders-application" className="mt-8 inline-flex rounded-full bg-black px-6 py-4 text-sm font-black text-white">
            Apply for a founding seat →
          </Link>
        </div>

        <div className="rounded-[2rem] border border-gray-900 bg-[#050505] p-7 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-600">Locker Room</p>
          <p className="mt-5 text-5xl font-black">$14.99/mo</p>
          <p className="mt-3 text-sm font-black text-gray-500">Opens after the Founders window.</p>
          <p className="mt-8 text-base font-semibold leading-relaxed text-gray-500">
            Same room. Public price. No founding rate.
          </p>
          <Link href="#founders-application" className="mt-8 inline-flex rounded-full bg-white px-6 py-4 text-sm font-black text-black">
            Join the waitlist →
          </Link>
        </div>
      </div>

      <RiskReversal />
    </section>
  )
}

async function PricingBody() {
  const seatsTaken = await getFoundingSeatCount()
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
      <PriceSection seatsTaken={seatsTaken} />
    </>
  )
}

export async function PricingPageContent({ phase: _phase, isPreview: _isPreview = false }: { phase: PricingPhase; isPreview?: boolean }) {
  return (
    <main className="min-h-[100dvh] bg-black text-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <Link href="/browse" className="text-sm text-gray-500 transition-colors hover:text-white">
          Browse answers
        </Link>
      </nav>

      <PricingBody />
    </main>
  )
}
