'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

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

// Journey dots — each dot is a moment (question or answer), connected by lines
// Shows that every answer opens a new question — an ongoing journey
function JourneyDots() {
  const nodes = [
    { label: 'Q', note: 'How do I recover faster?' },
    { label: 'A', note: 'Elijah answers' },
    { label: 'Q', note: 'What about nutrition?' },
    { label: 'A', note: 'Elijah answers' },
    { label: 'Q', note: 'Night before games?' },
    { label: 'A', note: 'Elijah answers' },
    { label: '...', note: 'Your journey continues' },
  ]

  return (
    <div className="w-full overflow-x-auto pb-2 -mx-2 px-2">
      <div className="flex items-center gap-0 min-w-max mx-auto" style={{ width: 'fit-content' }}>
        {nodes.map((node, i) => (
          <div key={i} className="flex items-center">
            {/* Node */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex items-center justify-center rounded-full text-xs font-bold transition-all
                  ${node.label === 'Q'
                    ? 'w-8 h-8 bg-white text-black'
                    : node.label === 'A'
                    ? 'w-8 h-8 border border-gray-600 text-gray-400'
                    : 'w-8 h-8 text-gray-600 text-base'}
                `}
                style={{
                  animationDelay: `${i * 0.15}s`,
                }}
              >
                {node.label}
              </div>
              <span className="text-gray-700 text-xs whitespace-nowrap max-w-[80px] text-center leading-tight hidden md:block">
                {node.note}
              </span>
            </div>
            {/* Connector line */}
            {i < nodes.length - 1 && (
              <div className="w-8 md:w-12 h-px bg-gray-800 mx-1 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  "Night before a big game",
  "When I lose confidence mid-game",
  "Recovery after back-to-backs",
]

export default function HomePage() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = () => {
    if (!question.trim() || loading) return
    setLoading(true)
    sessionStorage.setItem('pending_question', question.trim())
    router.push('/ask')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  return (
    <div className="flex flex-col min-h-screen">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 bg-black">
        <Link href="/"><Logo dark /></Link>
        <div className="flex items-center gap-6">
          <Link href="/sign-in" className="text-sm text-gray-400 hover:text-white transition-colors">Sign in</Link>
          <Link href="/ask" className="text-sm font-semibold px-4 py-2 bg-white text-black hover:opacity-80 transition-opacity">
            Try free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-black text-white flex flex-col items-center px-6 pt-16 pb-28 text-center">
        {/* Identity — who is The Pro */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden flex items-center justify-center flex-shrink-0">
            {/* Placeholder avatar — replace with Elijah's photo */}
            <span className="text-white font-bold text-sm">EB</span>
          </div>
          <div className="text-left">
            <p className="text-white text-sm font-semibold leading-tight">Elijah Bryant</p>
            <p className="text-gray-500 text-xs leading-tight">NBA Champion · EuroLeague Champion</p>
          </div>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none mb-6">
          <span className="font-normal text-gray-400">Get answers from</span>
          <br />
          an NBA Champion.
        </h1>
        <p className="text-gray-400 text-lg md:text-xl mb-12 max-w-xl leading-relaxed">
          Elijah Bryant — NBA champion, EuroLeague champion — has spent 8+ years figuring out what actually works. Ask him anything about your game.
        </p>

        {/* Journey dots — the visual metaphor */}
        <div className="w-full max-w-2xl mb-12">
          <JourneyDots />
          <p className="text-xs text-gray-700 mt-4 text-center tracking-wide">Every answer opens a new question. That&apos;s how growth works.</p>
        </div>

        {/* Ask box */}
        <div className="w-full max-w-xl">
          <div className="border border-gray-700 focus-within:border-white transition-colors">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKey}
              placeholder="What do you want to know about your game?"
              rows={3}
              className="w-full px-4 pt-4 pb-2 text-white placeholder-gray-600 text-lg leading-relaxed resize-none outline-none bg-transparent"
              style={{ minHeight: '80px' }}
            />
            <div className="flex items-center justify-between px-4 pb-3">
              {question.length >= 140 && (
                <span className="text-xs text-gray-600">{question.length}</span>
              )}
              <button
                onClick={handleSubmit}
                disabled={!question.trim() || loading}
                className="ml-auto bg-white text-black px-6 py-2 text-sm font-semibold tracking-tight disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
              >
                {loading ? 'Getting your answer...' : "Ask Elijah — It's Free"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQuestion(s)}
                className="text-sm border border-gray-700 px-3 py-1.5 text-gray-400 hover:border-gray-400 hover:text-white transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-700 mt-5">No account needed · First answer is free</p>
        </div>
      </section>

      {/* Social proof */}
      <section className="bg-white px-6 py-20">
        {/* Who is Elijah */}
        <div className="max-w-3xl mx-auto mb-16 text-center">
          <p className="text-xs text-gray-400 tracking-widest uppercase mb-6">Who you&apos;re asking</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-black mb-4">
            Elijah Bryant. NBA Champion. EuroLeague Champion.<br />Not a chatbot. Not a coach. A pro who&apos;s been there.
          </h2>
          <p className="text-gray-500 text-base leading-relaxed max-w-xl mx-auto">
            8+ years as a professional basketball player. NBA champion. EuroLeague champion. Currently playing in Europe. Ask Elijah is his knowledge — what actually worked under real professional pressure.
          </p>
        </div>

        <blockquote className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-2xl md:text-3xl font-semibold italic tracking-tight text-black leading-snug mb-4">
            &ldquo;First time I felt like I was getting real advice, not just content.&rdquo;
          </p>
          <cite className="text-sm text-gray-400 not-italic">— CC Newsletter subscriber, age 17</cite>
        </blockquote>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {[
            { title: "From Elijah's vault", sub: "His real protocols — not the internet's average answer" },
            { title: "Ask anything", sub: "Recovery, mental game, shooting, nutrition, explosiveness" },
            { title: "Personal review", sub: "Elijah watches your film and responds directly" },
          ].map(({ title, sub }) => (
            <div key={title} className="bg-black text-white p-8">
              <p className="font-bold text-base tracking-tight mb-2">{title}</p>
              <p className="text-sm text-gray-400">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Objection destroyer */}
      <section className="bg-black text-white px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
            &ldquo;You can use ChatGPT for free.&rdquo;
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed mb-10">
            Yes. ChatGPT gives you the internet&apos;s best average answer. Ask Elijah gives you Elijah&apos;s answer — what he actually did, under real professional stakes. That&apos;s the difference.
          </p>
          <Link href="/ask" className="text-white underline underline-offset-4 hover:text-gray-300 transition-colors text-sm">
            Ask your first question →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-gray-900 px-6 py-10 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-3">
            <Logo dark />
            <p className="text-xs text-gray-600">Built by Elijah Bryant. Consistency Club.</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-gray-600 hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="text-xs text-gray-600 hover:text-white transition-colors">Terms</Link>
            <Link href="mailto:hello@consistencyclub.com" className="text-xs text-gray-600 hover:text-white transition-colors">Contact</Link>
          </div>
          <p className="text-xs text-gray-700">© Consistency Club</p>
        </div>
      </footer>
    </div>
  )
}
