import Link from 'next/link'
import FoundersBetaForm from './founders-beta-form'
import { FOUNDING_SEAT_LIMIT, getFoundingSeatCount, getFoundingSeatsLeft } from '@/lib/founding-seats'
import type { PricingPhase } from '@/lib/pricing-phase'
import { MathReveal, PRICING_VALUE_ITEMS, RiskReversal, ValueStack } from '@/components/marketing/ValueStack'

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
    <p className="mt-6 inline-flex rounded-full border border-gray-900 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#F7F5F0]">
      {remaining === null ? `Only ${FOUNDING_SEAT_LIMIT} founding seats` : `${remaining} founding seats left`}
    </p>
  )
}

function ComparisonStack() {
  const rows = [
    ['AAU and team fees', '$500-$3,000+ / season', 'Gets him games. It does not explain why he freezes, why he is losing minutes, or why he stopped talking on the ride home.'],
    ['Private basketball trainer', '$75-$200+ / session', 'Great for skill work. Most trainers are not answering the confidence, role, pressure, and coach problems that follow him home.'],
    ['Camps and showcases', '$150-$500+ / event', 'Useful exposure. Exposure does not help much if he gets tight the moment coaches are watching.'],
    ['Sport psychologist', '$100-$250+ / session', 'Helpful for mental skills. Ask Elijah is different because the answer comes through someone who has lived the bench, pressure, slump, and locker room.'],
    ['Sports physio', '$100-$300 / visit', 'Important when the body needs help. This is for the part nobody can stretch out: fear, doubt, playing time, identity, and what to do next.'],
    ['Recruiting advice', '$100-$300+ / call', 'Helpful for decisions. Players still need help with the pressure, comparison, and what to actually do this week.'],
    ['Pro locker-room perspective', 'Usually not available', 'NBA and EuroLeague champion context. Coach problems. Role problems. Confidence problems. The stuff players do not always say out loud.'],
  ]

  return (
    <section className="mx-auto max-w-6xl px-5 py-14">
      <div className="rounded-[2rem] border border-gray-900 bg-[#050505] p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-gray-600">
          You already pay for the outside work
        </p>
        <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-[#F7F5F0] sm:text-5xl">
          This is the part most families miss.
        </h2>
        <p className="mt-4 max-w-3xl text-base font-semibold leading-relaxed text-gray-500">
          Skill work matters. Exposure matters. Recovery matters. But none of those always answer the question sitting in his head.
        </p>
        <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rows.map(([label, cost, body]) => (
            <div key={label} className="rounded-[1.5rem] border border-gray-900 bg-black p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">{label}</p>
              <p className="mt-4 text-2xl font-black text-[#F7F5F0]">{cost}</p>
              <p className="mt-4 text-sm font-semibold leading-relaxed text-gray-500">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-[1.5rem] bg-[#F7F5F0] p-5 text-black">
          <p className="text-2xl font-black">Ask Elijah fills the gap.</p>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-black/60">
            It does not replace a trainer, therapist, doctor, or physio. It gives players the conversation they usually cannot get:
            a pro who has lived the bench, the pressure, the role changes, the slumps, the injuries, the locker room, and the next rep.
          </p>
        </div>
      </div>
    </section>
  )
}

function PricingTiers({ seatsTaken }: { seatsTaken: number | null }) {
  const seatsLeft = getFoundingSeatsLeft(seatsTaken) ?? 196

  return (
    <section className="mx-auto max-w-6xl px-5 pb-16" id="locker-room">
      <p className="mb-6 text-xs font-black uppercase tracking-[0.24em] text-gray-600">
        WHAT YOU GET WHEN THE DOOR OPENS
      </p>
      <h2 className="text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
        Two doors.
        <span className="block text-[#555]">That&apos;s it.</span>
      </h2>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-gray-500">
        The Founders 200 closes when it fills. Everyone after walks through the Locker Room.
      </p>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[2rem] bg-[#F7F5F0] p-7 text-black">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-gray-500">FOUNDERS 200</p>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-black/50">{seatsLeft} SEATS LEFT · CLOSES AT 200</p>
          <p className="mt-6 text-5xl font-black">$9.99/mo</p>
          <p className="mt-3 text-sm font-black text-black/60">Locked for life. Cancel and lose the rate forever.</p>
          <p className="mt-6 text-sm font-semibold leading-relaxed text-black/65">
            The original class. Their questions trained the brain. They keep the rate as long as the membership stays active.
          </p>
          <p className="mt-6 text-sm font-black leading-relaxed text-black">
            Everything in the Locker Room is included. Plus the badge. Plus the rate. Forever.
          </p>
          <Link href="#founders-application" className="mt-8 inline-flex rounded-full bg-black px-6 py-4 text-sm font-black text-white">
            Apply for a founding seat →
          </Link>
        </div>

        <div className="rounded-[2rem] border border-[#111] bg-[#050505] p-7 text-white">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-gray-600">LOCKER ROOM · OPENS DAY 90</p>
          <p className="mt-6 text-5xl font-black">$14.99/mo</p>
          <p className="mt-3 text-sm font-black text-[#555]">or $129/year</p>
          <p className="mt-8 text-2xl font-black leading-tight">Less than one trainer session. Every month. Forever.</p>
          <div className="mt-8">
            <ValueStack items={PRICING_VALUE_ITEMS} />
          </div>
          <MathReveal dark />
          <Link href="#founders-application" className="mt-8 inline-flex rounded-full bg-white px-6 py-4 text-sm font-black text-black">
            Join the waitlist →
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <RiskReversal />
      </div>

      <div className="mt-6 rounded-[2rem] bg-[#F7F5F0] p-7 text-black">
        <h3 className="text-3xl font-black leading-tight">The Founders 200 closes at 200 seats.</h3>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-black/65">
          After that, public pricing only. The Founders rate is gone the day the cap fills. If you are in, you keep $9.99/mo locked for life. Cancel and you lose the rate forever.
        </p>
        <p className="mt-8 text-4xl font-black tabular-nums">{seatsLeft} / 200 SEATS LEFT</p>
        <Link href="#founders-application" className="mt-8 inline-flex rounded-full bg-black px-6 py-4 text-sm font-black text-white">
          Apply for a founding seat →
        </Link>
      </div>
    </section>
  )
}

async function PricingBody() {
  const seatsTaken = await getFoundingSeatCount()
  const isClosed = seatsTaken !== null && seatsTaken >= FOUNDING_SEAT_LIMIT

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-start" id="founders-application">
        <div>
          <p className="mb-5 text-[10px] font-black uppercase tracking-[0.28em] text-gray-600">
            Founders beta
          </p>
          <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
            Only 200 players.
            <span className="block text-gray-500">Free while it is being built.</span>
          </h1>
          <p className="mt-5 text-2xl font-black leading-tight text-[#F7F5F0]">
            Get in now. Keep $9.99/mo for life after launch.
          </p>
          <FoundingSeatCounter count={seatsTaken} />
          <p className="mt-8 max-w-2xl text-base leading-relaxed text-gray-500">
            This is the build phase. Founding members ask for free while Elijah shapes the brain.
            When the 200 seats are gone, the next group waits and pays public pricing. If you are accepted now,
            you keep the founding rate as long as your membership stays active.
          </p>
        </div>
        <FoundersBetaForm closed={isClosed} />
      </section>
      <ComparisonStack />
      <PricingTiers seatsTaken={seatsTaken} />
    </>
  )
}

export async function PricingPageContent({ phase: _phase, isPreview: _isPreview = false }: { phase: PricingPhase; isPreview?: boolean }) {
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

      <PricingBody />
    </main>
  )
}
