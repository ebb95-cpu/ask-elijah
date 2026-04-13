import Link from 'next/link'

function Logo({ dark = false }: { dark?: boolean }) {
  const c = dark ? '#fff' : '#000'
  return (
    <svg width="52" height="8" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill={c} />
      <line x1="8" y1="4" x2="20" y2="4" stroke={c} strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill={c} />
      <line x1="28" y1="4" x2="40" y2="4" stroke={c} strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill={c} />
    </svg>
  )
}

const VALUE_STACK = [
  { label: 'Access to Elijah\'s full answer library', value: 'Priceless' },
  { label: 'Unlimited personal questions — answered in 24hrs', value: '$300/session' },
  { label: 'Action steps tailored to your exact situation', value: '$200/session' },
  { label: '48-hour accountability follow-up', value: '$150/session' },
  { label: 'Answers personalized to your position, level & goal', value: '$100/session' },
  { label: 'Full question history — your private playbook', value: '$50/mo' },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <nav className="flex items-center justify-between px-6 py-5">
        <Link href="/"><Logo dark /></Link>
        <Link href="/ask" className="text-sm text-gray-400 hover:text-white transition-colors">
          Try free →
        </Link>
      </nav>

      <main className="flex-1 px-6 py-16 max-w-2xl mx-auto w-full">

        {/* Header */}
        <div className="mb-16">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-5">Ask Elijah</p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight mb-6">
            Most players never ask for help.<br />
            <span className="text-gray-400">This is for the ones who do.</span>
          </h1>
          <p className="text-gray-500 text-base leading-relaxed max-w-lg">
            A private session with a pro player runs $300–$500 an hour. One real answer from Elijah could change how you train for the next six months.
          </p>
        </div>

        {/* Value stack */}
        <div className="mb-12">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-6">What you&apos;re actually getting</p>
          <div className="border border-gray-800 divide-y divide-gray-900">
            {VALUE_STACK.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-white text-xs">✓</span>
                  <span className="text-gray-300 text-sm">{label}</span>
                </div>
                <span className="text-gray-600 text-xs tabular-nums shrink-0 ml-4">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing — two options */}
        <div className="mb-10">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-6">Choose your plan</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Monthly */}
            <div className="border border-gray-800 p-8 flex flex-col">
              <p className="text-xs text-gray-500 tracking-widest uppercase mb-4">Monthly</p>
              <p className="text-5xl font-bold mb-1">$29</p>
              <p className="text-gray-500 text-sm mb-8">per month, cancel anytime</p>
              <p className="text-gray-400 text-sm leading-relaxed mb-10 flex-1">
                Full access. Every answer. Cancel whenever you want.
              </p>
              <Link
                href="/sign-up?plan=monthly"
                className="border border-gray-600 text-white px-6 py-3 text-sm font-semibold text-center hover:border-white transition-colors"
              >
                Get started →
              </Link>
            </div>

            {/* Annual — featured */}
            <div className="border border-white p-8 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-white text-black text-xs font-bold px-3 py-1 tracking-widest uppercase">Best value</span>
              </div>
              <p className="text-xs text-gray-400 tracking-widest uppercase mb-4">Annual</p>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-5xl font-bold">$199</p>
                <p className="text-gray-500 text-sm line-through">$348</p>
              </div>
              <p className="text-gray-400 text-sm mb-2">per year — $16.58/mo</p>
              <p className="text-white text-xs font-semibold mb-8">You save $149</p>
              <p className="text-gray-300 text-sm leading-relaxed mb-10 flex-1">
                Everything in monthly, locked in for a year. The players who get better aren&apos;t thinking month to month.
              </p>
              <Link
                href="/sign-up?plan=annual"
                className="bg-white text-black px-6 py-3 text-sm font-bold text-center hover:opacity-80 transition-opacity"
              >
                Get the year →
              </Link>
            </div>
          </div>
        </div>

        {/* Guarantee */}
        <div className="border border-gray-800 px-6 py-6 mb-12">
          <p className="text-white font-bold mb-2">7-day guarantee.</p>
          <p className="text-gray-500 text-sm leading-relaxed">
            If you don&apos;t get value in your first 7 days, reply to any email and I&apos;ll refund you. No questions asked. I only want players in here who are serious about using it.
          </p>
        </div>

        {/* Who it's not for */}
        <div className="mb-16">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-5">Who this is not for</p>
          <ul className="space-y-3">
            {[
              "Players looking for hype, not honesty",
              "Players who want the answer but won't do the work",
              "Players who already have everything figured out",
            ].map(line => (
              <li key={line} className="flex items-start gap-3 text-gray-600 text-sm">
                <span className="text-gray-700 mt-0.5">✕</span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        {/* Free CTA at bottom */}
        <div className="text-center">
          <p className="text-gray-600 text-sm mb-4">Not ready to commit? Ask your first question free.</p>
          <Link href="/ask" className="text-white text-sm underline underline-offset-4 hover:text-gray-300 transition-colors">
            Try it first →
          </Link>
        </div>

      </main>
    </div>
  )
}
