'use client'

import { useEffect, useState } from 'react'

type Stage = 1 | 2

type CaptureProfile = {
  position?: string | null
  level?: string | null
  challenge?: string | null
  timeline?: string | null
  system?: string | null
}

const LEVELS = ['Middle school', 'JV', 'Varsity', 'AAU', 'College', 'Pro', 'Rec']
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']
const TIMELINES = ['1 week', '1 month', 'This season', 'Offseason']

interface Props {
  email: string
  /**
   * Per-question context. When provided, dismissing the capture only hides it
   * for that specific question's detail view — the next approved answer will
   * re-show it. Omit for inline usage (e.g. at the top of /history) and pass
   * a stable `dismissScope` instead so skip persists across renders without
   * being tied to a single answer.
   */
  questionId?: string
  /**
   * Override for the session-storage dismissal key. Defaults to the
   * per-question key when questionId is set, otherwise "history-inline".
   */
  dismissScope?: string
}

export default function ProfileCapture({ email, questionId, dismissScope }: Props) {
  const [profile, setProfile] = useState<CaptureProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Stage-1 fields
  const [level, setLevel] = useState('')
  const [position, setPosition] = useState('')
  const [workingOn, setWorkingOn] = useState('')

  // Stage-2 fields
  const [timeline, setTimeline] = useState('')
  const [system, setSystem] = useState('')

  const dismissKey = dismissScope
    ? `kb_capture_dismissed_${dismissScope}`
    : `kb_capture_dismissed_${questionId || 'history-inline'}`

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(dismissKey)) {
      setDismissed(true)
    }
    const load = async () => {
      try {
        const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}`)
        const data = await res.json()
        setProfile(data || {})
        setLevel(data?.level || '')
        setPosition(data?.position || '')
        setWorkingOn(data?.challenge || '')
        setTimeline(data?.timeline || '')
        setSystem(data?.system || '')
      } catch {
        setProfile({})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [email, dismissKey])

  if (loading || dismissed || !profile) return null

  const stage1Done = !!profile.position && !!profile.level && !!profile.challenge
  const stage2Done = !!profile.timeline && !!profile.system
  if (stage1Done && stage2Done) return null

  const stage: Stage = stage1Done ? 2 : 1

  const canSaveStage1 = !!level && !!position && workingOn.trim().length > 0
  const canSaveStage2 = !!timeline && system.trim().length > 0
  const canSave = stage === 1 ? canSaveStage1 : canSaveStage2

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const payload: Record<string, string> = { email }
    if (stage === 1) {
      payload.level = level
      payload.position = position
      payload.challenge = workingOn.trim()
    } else {
      payload.timeline = timeline
      payload.system = system.trim()
    }
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('save failed')
      setProfile((p) => ({ ...(p || {}), ...payload }))
    } catch {
      setSaving(false)
    }
    setSaving(false)
  }

  const handleSkip = () => {
    try {
      sessionStorage.setItem(dismissKey, '1')
    } catch {
      /* sessionStorage blocked — just hide for this render */
    }
    setDismissed(true)
  }

  return (
    <div className="mt-10 mb-4 border border-gray-900 bg-[#0a0a0a] rounded-xl p-5">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
        {stage === 1 ? 'Elijah wants to know you' : 'One more layer'}
      </p>
      <h3 className="text-lg font-bold leading-tight mb-1">
        {stage === 1 ? 'Sharper answers need sharper context.' : 'Name it. Commit. Build the system.'}
      </h3>
      <p className="text-xs text-gray-500 leading-relaxed mb-5">
        {stage === 1
          ? 'Takes 30 seconds. Every answer after this one lands harder.'
          : 'You know the problem. Now put a date on it and a daily on it.'}
      </p>

      {stage === 1 ? (
        <div className="space-y-5">
          <Field label="Your level">
            <ChipRow options={LEVELS} value={level} onChange={setLevel} />
          </Field>

          <Field label="Your position">
            <ChipRow options={POSITIONS} value={position} onChange={setPosition} />
          </Field>

          <Field
            label="What you're working on"
            helper={'"Getting better" is a wish. "Finishing with my left hand" is a thing you can actually work on.'}
          >
            <input
              type="text"
              value={workingOn}
              onChange={(e) => setWorkingOn(e.target.value)}
              placeholder="One sentence."
              maxLength={140}
              className="w-full bg-transparent border border-gray-800 rounded-md px-3 py-2 text-sm text-white placeholder-gray-700 outline-none focus:border-gray-600 transition-colors"
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-5">
          <Field
            label="Your timeline"
            helper="Vague goals are where dreams go to die."
          >
            <ChipRow options={TIMELINES} value={timeline} onChange={setTimeline} />
          </Field>

          <Field
            label="Your system"
            helper={'"Practice hard" is not a system. "30 min of left-hand finishes at 6am" is.'}
          >
            <input
              type="text"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              placeholder="What you'll DO. Daily."
              maxLength={200}
              className="w-full bg-transparent border border-gray-800 rounded-md px-3 py-2 text-sm text-white placeholder-gray-700 outline-none focus:border-gray-600 transition-colors"
            />
          </Field>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="flex-1 bg-white text-black py-3 text-sm font-bold tracking-tight rounded-md disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
        >
          {saving ? 'Saving...' : stage === 1 ? 'Save →' : 'Lock it in →'}
        </button>
        <button
          onClick={handleSkip}
          className="text-xs text-gray-600 hover:text-white transition-colors px-2"
        >
          Skip
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  helper,
  children,
}: {
  label: string
  helper?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      {children}
      {helper && <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">{helper}</p>}
    </div>
  )
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              active
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-gray-400 border-gray-800 hover:border-gray-600'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
