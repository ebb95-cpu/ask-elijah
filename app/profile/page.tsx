'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LoadingDots from '@/components/ui/LoadingDots'
import { getLocal, setLocal } from '@/lib/safe-storage'
import { simFetch } from '@/lib/simulator'

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C', 'Coach']
const LEVELS = ['Youth', 'High School', 'College', 'Pro']
const CHALLENGES = ['Confidence', 'Pressure', 'Consistency', 'Leadership', 'Slumps', 'Focus']
const AGE_RANGES = ['Under 18', '18-24', '25+']

type JournalEntry = {
  id: string
  question: string
  answer: string
  action_steps: string | null
  answered_at: string
  reflection: { text: string; created_at: string } | null
}

type SavePhase = 'idle' | 'saving' | 'dots' | 'reveal'

export default function ProfilePage() {
  const [email, setEmail] = useState('')
  const [position, setPosition] = useState('')
  const [level, setLevel] = useState('')
  const [country, setCountry] = useState('')
  const [challenge, setChallenge] = useState('')
  const [ageRange, setAgeRange] = useState('')
  const [teamSchool, setTeamSchool] = useState('')
  const [savePhase, setSavePhase] = useState<SavePhase>('idle')
  const [journal, setJournal] = useState<JournalEntry[]>([])
  const [journalLoading, setJournalLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const isFirstSave = useRef(true)
  const router = useRouter()

  useEffect(() => {
    const stored = getLocal('ask_elijah_email')
    if (stored) {
      isFirstSave.current = false
      setEmail(stored)
      fetch(`/api/profile?email=${encodeURIComponent(stored)}`)
        .then(r => r.json())
        .then(d => {
          if (d.position) setPosition(d.position)
          if (d.level) setLevel(d.level)
          if (d.country) setCountry(d.country)
          if (d.challenge) setChallenge(d.challenge)
          if (d.age_range) setAgeRange(d.age_range)
          if (d.team_school) setTeamSchool(d.team_school)
          setProfileLoaded(true)
        })

      setJournalLoading(true)
      fetch(`/api/journal?email=${encodeURIComponent(stored)}`)
        .then(r => r.json())
        .then(d => setJournal(d.entries || []))
        .finally(() => setJournalLoading(false))
    } else {
      setIsEditing(true)
      setProfileLoaded(true)
    }
  }, [])

  const hasProfile = profileLoaded && !!(position || level || country || challenge)
  const showDashboard = hasProfile && !isEditing

  const save = async () => {
    if (!email.trim()) return
    const firstTime = isFirstSave.current
    setSavePhase('saving')
    await simFetch(
      '/api/profile',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, position, level, country, challenge, age_range: ageRange, team_school: teamSchool }),
      },
      { ok: true }
    )
    setLocal('ask_elijah_email', email)
    isFirstSave.current = false

    if (firstTime) {
      setSavePhase('dots')
      setTimeout(() => setSavePhase('reveal'), 2000)
    } else {
      setSavePhase('idle')
      setIsEditing(false)
    }
  }

  const filled = [position, level, country, challenge].filter(Boolean).length
  const pct = Math.round((filled / 4) * 100)

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const daysActive = journal.length > 0
    ? Math.max(1, Math.ceil((Date.now() - new Date(journal[journal.length - 1].answered_at).getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  const reflectionsCount = journal.filter(j => j.reflection).length

  // ── First-save ceremony ──────────────────────────────────────────────────
  if (savePhase === 'dots' || savePhase === 'reveal') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-8 text-center">
        <div className="flex items-center gap-0 mb-16">
          <div className={`w-4 h-4 rounded-full bg-white transition-opacity duration-500 ${savePhase === 'reveal' ? 'opacity-100' : 'opacity-0 dot-1'}`}
            style={savePhase === 'dots' ? { animation: 'dotPulse 1.8s ease-in-out infinite 0s', opacity: 1 } : {}} />
          <div className={`w-8 h-0.5 bg-white mx-1 transition-opacity duration-500 ${savePhase === 'reveal' ? 'opacity-100' : 'opacity-0'}`}
            style={savePhase === 'dots' ? { animation: 'dotPulse 1.8s ease-in-out infinite 0.18s', opacity: 1 } : {}} />
          <div className={`w-4 h-4 rounded-full bg-white transition-opacity duration-500 ${savePhase === 'reveal' ? 'opacity-100' : 'opacity-0 dot-2'}`}
            style={savePhase === 'dots' ? { animation: 'dotPulse 1.8s ease-in-out infinite 0.35s', opacity: 1 } : {}} />
          <div className={`w-8 h-0.5 bg-white mx-1 transition-opacity duration-500 ${savePhase === 'reveal' ? 'opacity-100' : 'opacity-0'}`}
            style={savePhase === 'dots' ? { animation: 'dotPulse 1.8s ease-in-out infinite 0.52s', opacity: 1 } : {}} />
          <div className={`w-4 h-4 rounded-full bg-white transition-opacity duration-500 ${savePhase === 'reveal' ? 'opacity-100' : 'opacity-0 dot-3'}`}
            style={savePhase === 'dots' ? { animation: 'dotPulse 1.8s ease-in-out infinite 0.7s', opacity: 1 } : {}} />
        </div>
        <div className={`transition-all duration-700 ${savePhase === 'reveal' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
            The gap between where you are<br />and where you want to be<br />is mental.
          </h1>
          <p className="text-gray-500 text-base mb-12 max-w-sm mx-auto leading-relaxed">
            Ask Elijah the question that&apos;s been holding you back.
          </p>
          <button
            onClick={() => router.push('/ask')}
            className="bg-white text-black px-10 py-4 text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity"
          >
            Ask your first question →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-5 py-5 border-b border-gray-900">
        <Link href="/" className="text-xs text-gray-600 hover:text-white transition-colors">← Back</Link>
        <p className="text-xs text-gray-600 tracking-widest uppercase">
          {showDashboard ? 'Your Profile' : isEditing && hasProfile ? 'Edit Profile' : 'Your Profile'}
        </p>
        <div className="w-12" />
      </nav>

      <div className="max-w-lg mx-auto px-5 py-12 pb-28 md:pb-12">

        {/* ── Dashboard view ─────────────────────────────────────────────── */}
        {showDashboard && (
          <>
            {/* Player card */}
            <div className="border border-gray-900 p-6 mb-8">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">Your player profile</p>
                  <p className="text-2xl font-bold text-white leading-tight">
                    {[
                      position === 'PG' ? 'Point Guard' :
                      position === 'SG' ? 'Shooting Guard' :
                      position === 'SF' ? 'Small Forward' :
                      position === 'PF' ? 'Power Forward' :
                      position === 'C' ? 'Center' :
                      position,
                      level ? `${level} Level` : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                  {country && <p className="text-gray-500 text-sm mt-1">Playing in {country}</p>}
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-gray-600 hover:text-white transition-colors shrink-0 ml-4"
                >
                  Edit →
                </button>
              </div>
              {challenge && (
                <div className="border-t border-gray-900 pt-4">
                  <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">Working on</p>
                  <p className="text-white font-semibold mb-3">{challenge}</p>
                  <Link
                    href={`/ask?q=${encodeURIComponent(`I'm struggling with ${challenge.toLowerCase()} in my game.`)}`}
                    className="text-xs text-gray-600 hover:text-white transition-colors"
                  >
                    Ask Elijah about it →
                  </Link>
                </div>
              )}
            </div>

            {/* Stats — only when there's data */}
            {journal.length > 0 && (
              <div className="grid grid-cols-3 border border-gray-900 mb-8">
                <div className="p-5 border-r border-gray-900">
                  <p className="text-3xl font-bold text-white">{journal.length}</p>
                  <p className="text-xs text-gray-600 mt-1 uppercase tracking-widest">Answers from Elijah</p>
                </div>
                <div className="p-5 border-r border-gray-900">
                  <p className="text-3xl font-bold text-white">{daysActive}</p>
                  <p className="text-xs text-gray-600 mt-1 uppercase tracking-widest">Days in</p>
                </div>
                <div className="p-5">
                  <p className="text-3xl font-bold text-white">{reflectionsCount}</p>
                  <p className="text-xs text-gray-600 mt-1 uppercase tracking-widest">Reflected</p>
                </div>
              </div>
            )}

            {/* CTA */}
            <Link
              href="/ask"
              className="block w-full py-3.5 bg-white text-black text-sm font-semibold text-center hover:opacity-80 transition-opacity mb-14"
            >
              Ask Elijah →
            </Link>

            {/* Journal — only show when there are entries */}
            {!journalLoading && journal.length > 0 && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">Your Journal</p>
                <p className="text-xs text-gray-700 mb-8">Every question you asked, what Elijah said, the steps he gave you, and what you reflected on.</p>
                <div className="space-y-0">
                  {journal.map((entry, i) => (
                    <div key={entry.id} className={`py-7 ${i < journal.length - 1 ? 'border-b border-gray-900' : ''}`}>
                      <p className="text-xs text-gray-700 mb-2">{formatDate(entry.answered_at)}</p>
                      <button onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)} className="text-left w-full">
                        <p className="text-white font-semibold text-base leading-snug mb-1">{entry.question}</p>
                        <p className="text-xs text-gray-600">{expandedId === entry.id ? 'Hide ↑' : 'Read answer ↓'}</p>
                      </button>
                      {expandedId === entry.id && (
                        <div className="mt-5 space-y-5">
                          <div>
                            <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">Elijah's answer</p>
                            <p className="text-gray-400 text-sm leading-relaxed">{entry.answer}</p>
                          </div>
                          {entry.action_steps && (
                            <div className="border-l-2 border-white pl-4">
                              <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">Your steps</p>
                              <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{entry.action_steps}</p>
                            </div>
                          )}
                          {entry.reflection ? (
                            <div>
                              <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">Your reflection</p>
                              <p className="text-gray-400 text-sm leading-relaxed italic">"{entry.reflection.text}"</p>
                              <p className="text-xs text-gray-700 mt-1">{formatDate(entry.reflection.created_at)}</p>
                            </div>
                          ) : entry.action_steps ? (
                            <div className="border border-gray-800 p-4">
                              <p className="text-xs text-gray-600 mb-2">No reflection yet.</p>
                              <Link href="/ask" className="text-xs text-white underline">Come back after you try the steps →</Link>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Edit / new profile form ────────────────────────────────────── */}
        {!showDashboard && (
          <>
            {/* Profile completion bar */}
            <div className="mb-10">
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">Profile complete</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-0.5 bg-gray-900">
                  <div className="h-0.5 bg-white transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-500">{pct}%</span>
              </div>
              <p className="text-xs text-gray-700 mt-2">The more you fill in, the more specific Elijah's answers get to your situation.</p>
            </div>

            <div className="space-y-8 mb-16">
              <div>
                <label className="text-xs text-gray-600 uppercase tracking-widest block mb-3">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-transparent border-b border-gray-800 focus:border-gray-500 text-white placeholder-gray-700 text-base outline-none pb-2 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 uppercase tracking-widest block mb-3">Position</label>
                <div className="flex flex-wrap gap-2">
                  {POSITIONS.map(p => (
                    <button key={p} onClick={() => setPosition(p)}
                      className={`px-3 py-1.5 text-xs border transition-colors ${position === p ? 'border-white text-white' : 'border-gray-800 text-gray-600 hover:border-gray-600'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600 uppercase tracking-widest block mb-3">Level</label>
                <div className="flex flex-wrap gap-2">
                  {LEVELS.map(l => (
                    <button key={l} onClick={() => setLevel(l)}
                      className={`px-3 py-1.5 text-xs border transition-colors ${level === l ? 'border-white text-white' : 'border-gray-800 text-gray-600 hover:border-gray-600'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600 uppercase tracking-widest block mb-3">Country / League</label>
                <input
                  type="text"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  placeholder="e.g. Turkey, USA, Spain..."
                  className="w-full bg-transparent border-b border-gray-800 focus:border-gray-500 text-white placeholder-gray-700 text-sm outline-none pb-2 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 uppercase tracking-widest block mb-3">Age range</label>
                <div className="flex flex-wrap gap-2">
                  {AGE_RANGES.map(a => (
                    <button key={a} onClick={() => setAgeRange(a)}
                      className={`px-3 py-1.5 text-xs border transition-colors ${ageRange === a ? 'border-white text-white' : 'border-gray-800 text-gray-600 hover:border-gray-600'}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600 uppercase tracking-widest block mb-3">Team / School</label>
                <input
                  type="text"
                  value={teamSchool}
                  onChange={e => setTeamSchool(e.target.value)}
                  placeholder="e.g. UCLA, Anadolu Efes, AAU..."
                  className="w-full bg-transparent border-b border-gray-800 focus:border-gray-500 text-white placeholder-gray-700 text-sm outline-none pb-2 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 uppercase tracking-widest block mb-3">Biggest mental challenge right now</label>
                <div className="flex flex-wrap gap-2">
                  {CHALLENGES.map(c => (
                    <button key={c} onClick={() => setChallenge(c)}
                      className={`px-3 py-1.5 text-xs border transition-colors ${challenge === c ? 'border-white text-white' : 'border-gray-800 text-gray-600 hover:border-gray-600'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                {isEditing && hasProfile && (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-3 border border-gray-800 text-gray-500 text-sm hover:border-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={save}
                  disabled={!email.trim() || savePhase === 'saving'}
                  className="flex-1 py-3 bg-white text-black text-sm font-semibold disabled:opacity-30 hover:opacity-80 transition-opacity"
                >
                  {savePhase === 'saving' ? <LoadingDots label="Saving" /> : 'Save profile'}
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
