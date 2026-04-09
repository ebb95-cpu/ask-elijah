'use client'

import { useState } from 'react'
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

const FAQS = [
  { q: "How long does it take?", a: "Elijah responds within 48 hours, usually faster. You'll get an email when it's ready." },
  { q: "What format do I get the response in?", a: "Voice reviews come back as an audio message. Film reviews come back as a recorded breakdown with timestamps." },
  { q: "How do I send my question or film?", a: "After checkout you'll get a private upload link. Voice notes can be recorded directly in the browser." },
]

export default function AskDirectlyPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <Link href="/"><Logo /></Link>
        <div className="flex items-center gap-6">
          <Link href="/sign-in" className="text-sm text-gray-400 hover:text-black transition-colors">Sign in</Link>
          <Link href="/ask" className="text-sm font-semibold bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity">
            Ask free
          </Link>
        </div>
      </nav>

      <main className="flex-1 px-6 py-16 max-w-3xl mx-auto w-full">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-3">Ask Directly.</h1>
        <p className="text-gray-400 text-lg mb-4">Elijah personally reviews your question. Voice or video.</p>

        {/* Slot counter */}
        <div className="inline-block border border-gray-200 px-4 py-2 mb-16">
          <p className="text-sm">
            <span className="font-semibold">8 of 10 slots available this week.</span>
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-20">
          {/* Voice */}
          <div className="border border-black p-8 flex flex-col">
            <p className="text-xs text-gray-400 tracking-widest uppercase mb-6">Voice Review</p>
            <p className="text-4xl font-bold mb-2">$25</p>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              Record a voice note. Elijah listens and responds with a personal audio message — not a script, not a template.
            </p>
            <ul className="space-y-2 text-sm text-gray-500 mb-10 flex-1">
              <li>Up to 3 min voice note</li>
              <li>Personal audio response</li>
              <li>Delivered within 48h</li>
            </ul>
            <button className="bg-black text-white px-6 py-3 text-sm font-semibold text-center hover:opacity-80 transition-opacity">
              Book voice review — $25
            </button>
          </div>

          {/* Video */}
          <div className="border border-gray-200 p-8 flex flex-col">
            <p className="text-xs text-gray-400 tracking-widest uppercase mb-6">Video / Film Review</p>
            <p className="text-4xl font-bold mb-2">$50</p>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              Upload your film. Elijah watches it and breaks it down — shot selection, positioning, decision-making. Real feedback.
            </p>
            <ul className="space-y-2 text-sm text-gray-500 mb-10 flex-1">
              <li>Up to 10 min of film</li>
              <li>Timestamped breakdown</li>
              <li>Delivered within 48h</li>
            </ul>
            <button className="bg-black text-white px-6 py-3 text-sm font-semibold text-center hover:opacity-80 transition-opacity">
              Book film review — $50
            </button>
          </div>
        </div>

        {/* FAQ */}
        <div className="border-t border-gray-100">
          {FAQS.map((faq, i) => (
            <div key={i} className="border-b border-gray-100">
              <button
                className="w-full flex items-center justify-between py-5 text-left"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="font-semibold text-sm tracking-tight">{faq.q}</span>
                <span className="text-gray-400 text-lg">{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && (
                <p className="text-gray-400 text-sm leading-relaxed pb-5">{faq.a}</p>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
