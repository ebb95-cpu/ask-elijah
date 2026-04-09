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

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <nav className="flex items-center justify-between px-6 py-5">
        <Link href="/"><Logo dark /></Link>
        <Link href="/ask" className="text-sm font-semibold bg-white text-black px-4 py-2 hover:opacity-80 transition-opacity">
          Try free
        </Link>
      </nav>

      <main className="flex-1 px-6 py-16 max-w-5xl mx-auto w-full">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 text-center">Get the pro experience.</h1>
        <p className="text-gray-400 text-center mb-16">Pick what works for where you are right now.</p>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20">
          {/* Free */}
          <div className="border border-gray-800 p-8 flex flex-col">
            <p className="text-xs text-gray-500 tracking-widest uppercase mb-4">Free</p>
            <p className="text-4xl font-bold mb-1">$0</p>
            <p className="text-gray-400 text-sm mb-8">3 questions/week</p>
            <ul className="space-y-3 text-sm text-gray-400 mb-10 flex-1">
              <li>3 questions per week</li>
              <li>No account required for first question</li>
              <li>Access to topic browser</li>
            </ul>
            <Link href="/ask" className="border border-gray-600 text-gray-400 px-6 py-3 text-sm font-semibold text-center hover:border-white hover:text-white transition-colors">
              Start free
            </Link>
          </div>

          {/* Solo — featured */}
          <div className="border border-white p-8 flex flex-col">
            <p className="text-xs text-gray-400 tracking-widest uppercase mb-4">Solo</p>
            <p className="text-4xl font-bold mb-1">$29<span className="text-lg font-normal text-gray-400">/mo</span></p>
            <p className="text-gray-400 text-sm mb-8">Unlimited questions + full library</p>
            <ul className="space-y-3 text-sm text-gray-300 mb-10 flex-1">
              <li>Unlimited questions</li>
              <li>Save answers to your playbook</li>
              <li>Full answer history</li>
              <li>Weekly pro tip from Elijah</li>
              <li>Streak tracking</li>
              <li>Focus area personalization</li>
            </ul>
            <Link href="/sign-up?plan=solo" className="bg-white text-black px-6 py-3 text-sm font-semibold text-center hover:opacity-80 transition-opacity">
              Get started
            </Link>
          </div>

          {/* Ask Directly */}
          <div className="border border-gray-800 p-8 flex flex-col">
            <p className="text-xs text-gray-500 tracking-widest uppercase mb-4">Ask Directly</p>
            <p className="text-4xl font-bold mb-1">$25<span className="text-lg font-normal text-gray-400">–$50</span></p>
            <p className="text-gray-400 text-sm mb-8">Pay per personal review</p>
            <ul className="space-y-3 text-sm text-gray-400 mb-10 flex-1">
              <li>Voice review — $25</li>
              <li>Video/film review — $50</li>
              <li>Elijah personally responds</li>
              <li>10 slots available per week</li>
              <li>Delivered within 48 hours</li>
            </ul>
            <Link href="/ask-directly" className="border border-gray-600 text-gray-400 px-6 py-3 text-sm font-semibold text-center hover:border-white hover:text-white transition-colors">
              Book a slot
            </Link>
          </div>
        </div>

        {/* What's included table */}
        <div className="mb-16">
          <h2 className="text-xl font-bold tracking-tight mb-8 text-center">What you get vs. what it costs elsewhere.</h2>
          <div className="border border-gray-800 divide-y divide-gray-800">
            {[
              { item: "Pro basketball player with 10+ years experience", elsewhere: "$500/hr", here: "Included" },
              { item: "EuroLeague champion knowledge base", elsewhere: "Not available", here: "Included" },
              { item: "Recovery & nutrition protocols", elsewhere: "$150/session", here: "Included" },
              { item: "Mental game coaching", elsewhere: "$200/session", here: "Included" },
              { item: "Film breakdown", elsewhere: "$300/session", here: "$50 one-time" },
            ].map(({ item, elsewhere, here }) => (
              <div key={item} className="grid grid-cols-3 px-6 py-4 text-sm">
                <span className="text-gray-300">{item}</span>
                <span className="text-gray-600 text-center">{elsewhere}</span>
                <span className="text-white font-semibold text-right">{here}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-gray-600 italic text-center text-sm">
          &ldquo;If you don&apos;t want the pro experience, just use ChatGPT.&rdquo;
        </p>
      </main>
    </div>
  )
}
