'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function Logo() {
  return (
    <svg width="52" height="8" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill="#fff" />
      <line x1="8" y1="4" x2="20" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill="#fff" />
      <line x1="28" y1="4" x2="40" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill="#fff" />
    </svg>
  )
}

const TOPICS = [
  {
    title: "Mental game",
    sub: "Confidence, pressure, focus, mindset under fire",
    questions: [
      "How do I stay confident after a bad shooting night?",
      "What do you do when you lose confidence mid-game?",
      "How do you handle crowd pressure in a hostile arena?",
    ],
  },
  {
    title: "Recovery",
    sub: "Sleep, soreness, back-to-backs, in-season maintenance",
    questions: [
      "How do you recover after a back-to-back in Euroleague?",
      "What's your night-before-game recovery routine?",
      "How do you manage soreness during a long season?",
    ],
  },
  {
    title: "Shooting",
    sub: "Form, rhythm, free throws, shot creation",
    questions: [
      "How do I fix my form when I'm in a shooting slump?",
      "What do you do to warm up your shot before a game?",
      "How do I shoot better under real game pressure?",
    ],
  },
  {
    title: "Nutrition",
    sub: "Fueling, hydration, game-day eating, travel diet",
    questions: [
      "What do you eat on game day?",
      "How do you stay disciplined with food while traveling?",
      "What's the one thing you cut out of your diet that made a difference?",
    ],
  },
  {
    title: "Explosiveness",
    sub: "Jumping, speed, agility, in-season athleticism",
    questions: [
      "How do I maintain my athleticism during a long season?",
      "What's the best way to improve my first step?",
      "How do pro players train for explosiveness without burning out?",
    ],
  },
  {
    title: "Pre-game prep",
    sub: "Routines, warm-up, focus rituals, game-day mindset",
    questions: [
      "What's your full pre-game routine on game day?",
      "How early do you start preparing mentally before a game?",
      "What do you do the night before a big game?",
    ],
  },
]

export default function BrowsePage() {
  const [selected, setSelected] = useState<string | null>(null)
  const router = useRouter()

  const topic = TOPICS.find(t => t.title === selected)

  const handleQuestion = (q: string) => {
    sessionStorage.setItem('pending_question', q)
    router.push('/ask')
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <nav className="flex items-center justify-between px-6 py-5">
        <Link href="/"><Logo /></Link>
        <Link href="/ask" className="text-sm font-semibold bg-white text-black px-4 py-2 hover:opacity-80 transition-opacity">
          Ask now
        </Link>
      </nav>

      <main className="flex-1 px-6 py-12 max-w-5xl mx-auto w-full">
        {!selected ? (
          <>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-12">Topics.</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TOPICS.map((t) => (
                <button
                  key={t.title}
                  onClick={() => setSelected(t.title)}
                  className="border border-gray-800 p-8 text-left hover:bg-white hover:text-black hover:border-white group transition-all"
                >
                  <p className="font-bold text-lg tracking-tight mb-2 group-hover:text-black">{t.title}</p>
                  <p className="text-sm text-gray-400 group-hover:text-gray-600">{t.sub}</p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-white transition-colors text-sm mb-8 block"
            >
              ← All topics
            </button>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">{topic?.title}.</h1>
            <p className="text-gray-400 mb-10">{topic?.sub}</p>
            <div className="space-y-3">
              {topic?.questions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuestion(q)}
                  className="w-full border border-gray-800 p-6 text-left hover:border-white hover:bg-white hover:text-black group transition-all"
                >
                  <p className="font-semibold tracking-tight group-hover:text-black">{q}</p>
                  <p className="text-xs text-gray-600 mt-2 group-hover:text-gray-500">Tap to ask →</p>
                </button>
              ))}
            </div>
            <div className="mt-10">
              <p className="text-gray-600 text-sm mb-3">Don&apos;t see your question?</p>
              <button
                onClick={() => router.push('/ask')}
                className="bg-white text-black px-6 py-3 text-sm font-semibold hover:opacity-80 transition-opacity"
              >
                Ask your own →
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
