'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * Admin-only preview of the student experience. Shows what /history,
 * /browse, and /ask look like with dummy data — so Elijah can check
 * the mobile UX without creating a test student account.
 *
 * This page is gated by the admin layout (requires admin_token cookie).
 */

type DummyQuestion = {
  id: string
  question: string
  answer: string
  status: 'approved' | 'pending'
  created_at: string
}

const DUMMY_QUESTIONS: DummyQuestion[] = [
  {
    id: '1',
    question: 'How do I stay confident after a bad game?',
    answer: "For me, that feeling is knowing you played bad and then the doubt creeps in. Like, am I actually good enough? Here is what I figured out. After a bad game, your brain wants to keep replaying it because it is trying to solve the problem. But if you just keep shooting in the gym, you are not actually resetting. Your brain needs to step away to process what happened. For me that is my family, my kids, time with my wife. Tonight before you sleep, write down one sentence about what that bad game actually was to you. Not a feeling. A fact.",
    status: 'approved',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: '2',
    question: "My coach benched me and won't tell me why. What do I do?",
    answer: "I have been there. Got benched my rookie year overseas and nobody said a word. Here is what most players get wrong. They go ask the coach 'why am I not playing' and the coach hears 'I think I deserve more.' Instead, ask this exact question: 'What do I need to show you in practice this week to earn more minutes?' That changes everything. You are not complaining. You are asking for the assignment. Tomorrow at practice, be the first one on the floor and the last one off. Not to prove a point. To prove you want it.",
    status: 'approved',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: '3',
    question: 'I freeze up in big games. How do I handle the pressure?',
    answer: "The pressure you are feeling is not the game. It is the story you are telling yourself about the game. 'If I miss this, they will think I can not play.' That is what freezes you. Not the moment. Your brain can not tell the difference between a real threat and an imagined one. So when you tell yourself the shot matters, your body locks up like there is danger. Here is what I do. Before tip-off, I pick one thing I am going to do well in the first two minutes. Not score. Not win. Just one task. Box out hard. Talk on defense. Sprint back. That task gives your brain something concrete so it stops spiraling. Try it your next game. Pick the task before you walk on the court.",
    status: 'approved',
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: '4',
    question: "I keep having hot starts then going cold in the second half. What's happening?",
    answer: '',
    status: 'pending',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: '5',
    question: 'How do I deal with teammates who do not take practice seriously?',
    answer: '',
    status: 'pending',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '6',
    question: "I'm a parent. My son lost his love for basketball after AAU. What do I do?",
    answer: "First, the fact that you are asking this means your kid is lucky. Most parents do not even notice. Here is what I have seen play out hundreds of times. AAU burns kids out because the adults make it about results instead of reps. Your son did not lose his love for basketball. He lost his love for performing for other people. The fix is not more basketball. It is less pressure and more play. Let him shoot around with no score, no clock, no audience. When the joy comes back on its own, and it will, that is when you know he is ready. Do not push. Just be there.",
    status: 'approved',
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
]

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000)
  if (diffH < 1) return 'Just now'
  if (diffH < 24) return `${diffH}h ago`
  if (diffH < 48) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AdminPreviewPage() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<'history' | 'browse'>('history')
  const openQ = openId ? DUMMY_QUESTIONS.find((q) => q.id === openId) : null

  return (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col">
      {/* Admin notice */}
      <div className="bg-yellow-900/30 border-b border-yellow-800/50 px-5 py-2 text-center shrink-0">
        <p className="text-xs text-yellow-500">Preview mode — this is what students see on their phone</p>
      </div>

      {/* Tab toggle */}
      <div className="flex border-b border-gray-900 shrink-0">
        {(['history', 'browse'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setOpenId(null) }}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
              tab === t ? 'text-white border-b-2 border-white' : 'text-gray-600'
            }`}
          >
            {t === 'history' ? 'My Questions (/history)' : 'Browse (/browse)'}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <>
          {/* Header */}
          <div className="px-5 py-4 shrink-0">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Your questions</p>
            <h1 className="text-2xl font-bold tracking-tight">
              {DUMMY_QUESTIONS.length} questions
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              {DUMMY_QUESTIONS.filter((q) => q.status === 'approved').length} answered by Elijah
            </p>
          </div>

          {/* Grid */}
          <div className="flex-1 px-5 pb-28">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {DUMMY_QUESTIONS.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setOpenId(q.id)}
                  className="text-left rounded-xl p-4 flex flex-col justify-between transition-colors"
                  style={{
                    aspectRatio: '1',
                    background: q.status === 'approved' ? '#0a1a0a' : '#0a0d1a',
                    border: `1px solid ${q.status === 'approved' ? '#1a3a1a' : '#1a2040'}`,
                  }}
                >
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: q.status === 'approved' ? '#4ade80' : '#6366f1' }}
                      />
                      <span className="text-[9px] uppercase tracking-widest" style={{ color: q.status === 'approved' ? '#4ade80' : '#6366f1' }}>
                        {q.status === 'approved' ? 'Answered' : 'Reviewing'}
                      </span>
                    </div>
                    <p
                      className="text-sm font-semibold leading-snug text-white"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical' as const,
                        overflow: 'hidden',
                      }}
                    >
                      {q.question}
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-2">{formatDate(q.created_at)}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'browse' && (
        <>
          <div className="px-5 py-4 shrink-0">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Community</p>
            <h1 className="text-2xl font-bold tracking-tight mb-1">What players are asking.</h1>
            <p className="text-xs text-gray-500">{DUMMY_QUESTIONS.filter((q) => q.status === 'approved').length} questions · Real answers from Elijah</p>
          </div>

          <div className="chip-row flex gap-2 px-5 pb-4 shrink-0">
            {['All', 'Confidence', 'Pressure', 'Coach'].map((c) => (
              <button key={c} className={`shrink-0 text-sm px-4 py-2 rounded-full border whitespace-nowrap ${c === 'All' ? 'border-white text-black bg-white' : 'border-gray-800 text-gray-400'}`}>
                {c}
              </button>
            ))}
          </div>

          <div className="flex-1 px-5 pb-28">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {DUMMY_QUESTIONS.filter((q) => q.status === 'approved').map((q) => (
                <button
                  key={q.id}
                  onClick={() => setOpenId(q.id)}
                  className="text-left rounded-xl p-4 flex flex-col justify-between border border-gray-900 hover:border-gray-700 transition-colors"
                  style={{ aspectRatio: '1', background: '#0a0a0a' }}
                >
                  <p
                    className="text-sm font-semibold leading-snug text-white"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    }}
                  >
                    {q.question}
                  </p>
                  <p className="text-[10px] text-gray-700 mt-2">Confidence</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom nav preview */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur border-t border-gray-900 flex pb-safe" style={{ WebkitBackdropFilter: 'blur(8px)' }}>
        {[
          { label: 'Ask', active: false },
          { label: 'Library', active: false },
          { label: 'Browse', active: tab === 'browse' },
          { label: 'Me', active: tab === 'history' },
        ].map((t) => (
          <button
            key={t.label}
            onClick={() => {
              if (t.label === 'Browse') setTab('browse')
              if (t.label === 'Me') setTab('history')
            }}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5"
            style={{ minHeight: 56 }}
          >
            <span className={`text-[10px] tracking-wide ${t.active ? 'text-white font-semibold' : 'text-gray-600'}`}>
              {t.label}
            </span>
          </button>
        ))}
      </nav>

      {/* Detail overlay */}
      {openQ && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-gray-900">
            <button onClick={() => setOpenId(null)} className="text-gray-400 hover:text-white text-sm min-h-[44px] flex items-center">
              ← Back
            </button>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: openQ.status === 'approved' ? '#4ade80' : '#6366f1' }} />
              <span className="text-[10px] uppercase tracking-widest" style={{ color: openQ.status === 'approved' ? '#4ade80' : '#6366f1' }}>
                {openQ.status === 'approved' ? 'Elijah answered' : 'Reviewing'}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6 pb-safe-plus-16">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">You asked</p>
            <h2 className="text-xl font-bold leading-snug mb-8">{openQ.question}</h2>

            {openQ.status === 'approved' && openQ.answer ? (
              <>
                <div className="border-l-2 border-white pl-5 mb-8">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">Elijah&apos;s answer</p>
                  <p className="text-base leading-relaxed text-gray-200 whitespace-pre-wrap">{openQ.answer}</p>
                </div>

                <Link
                  href="/ask"
                  className="block w-full bg-white text-black text-center py-4 text-sm font-bold rounded-full"
                >
                  Ask a follow-up →
                </Link>
              </>
            ) : (
              <div className="border border-gray-800 rounded-xl p-6 text-center">
                <p className="text-gray-400 text-sm mb-2">Elijah is reviewing your question.</p>
                <p className="text-gray-600 text-xs">You will see his answer here when it is ready.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
