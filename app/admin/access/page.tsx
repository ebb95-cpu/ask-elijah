'use client'

import { useEffect, useMemo, useState } from 'react'
import LoadingDots from '@/components/ui/LoadingDots'

type AccessEntry = {
  id: string
  waitlist_id: string | null
  email: string
  name: string | null
  challenge: string | null
  confirmed: boolean
  approved: boolean
  notified: boolean
  created_at: string
  profile_created_at: string | null
  position: string | null
  level: string | null
  question_count: number
  pending_count: number
  approved_count: number
  skipped_count: number
  feedback_up_count: number
  feedback_down_count: number
  last_question_at: string | null
  last_answered_at: string | null
  reflection_count: number
  positive_reflection_count: number
  negative_reflection_count: number
  last_reflection_at: string | null
  admin_note: string | null
  high_value: boolean
  admin_note_updated_at: string | null
  has_profile: boolean
}

export default function AdminAccessPage() {
  const [entries, setEntries] = useState<AccessEntry[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingNoteEmail, setSavingNoteEmail] = useState<string | null>(null)
  const [error, setError] = useState('')

  const approvedCount = useMemo(() => entries.filter((e) => e.approved).length, [entries])
  const waitingCount = entries.length - approvedCount
  const totalQuestions = useMemo(() => entries.reduce((sum, entry) => sum + entry.question_count, 0), [entries])
  const pendingQuestions = useMemo(() => entries.reduce((sum, entry) => sum + entry.pending_count, 0), [entries])

  async function loadEntries() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/access')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load access list')
      setEntries(data.entries || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load access list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEntries()
  }, [])

  async function addEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to approve email')
      setEntries((prev) => [data.entry, ...prev.filter((entry) => entry.id !== data.entry.id)])
      setEmail('')
      setName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve email')
    } finally {
      setSaving(false)
    }
  }

  async function setApproved(entry: AccessEntry, approved: boolean) {
    setEntries((prev) => prev.map((item) => (item.id === entry.id ? { ...item, approved } : item)))
    try {
      const res = entry.waitlist_id
        ? await fetch('/api/admin/access', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ waitlist_id: entry.waitlist_id, approved }),
          })
        : await fetch('/api/admin/access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: entry.email, name: entry.name || '' }),
          })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update access')
      setEntries((prev) => prev.map((item) => (item.id === entry.id ? { ...item, ...data.entry } : item)))
    } catch (e) {
      setEntries((prev) => prev.map((item) => (item.id === entry.id ? entry : item)))
      setError(e instanceof Error ? e.message : 'Failed to update access')
    }
  }

  async function updatePlayerNote(entry: AccessEntry, updates: { admin_note?: string; high_value?: boolean }) {
    const previous = entry
    setSavingNoteEmail(entry.email)
    setEntries((prev) =>
      prev.map((item) =>
        item.email === entry.email
          ? {
              ...item,
              admin_note: updates.admin_note ?? item.admin_note,
              high_value: updates.high_value ?? item.high_value,
            }
          : item
      )
    )

    try {
      const res = await fetch('/api/admin/access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: entry.email,
          admin_note: updates.admin_note ?? entry.admin_note ?? '',
          high_value: updates.high_value ?? entry.high_value,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update player note')
      setEntries((prev) =>
        prev.map((item) =>
          item.email === entry.email
            ? {
                ...item,
                admin_note: data.entry.admin_note,
                high_value: data.entry.high_value,
                admin_note_updated_at: data.entry.admin_note_updated_at,
              }
            : item
        )
      )
    } catch (e) {
      setEntries((prev) => prev.map((item) => (item.email === previous.email ? previous : item)))
      setError(e instanceof Error ? e.message : 'Failed to update player note')
    } finally {
      setSavingNoteEmail(null)
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-gray-600">
              Launch gate
            </p>
            <h1 className="text-4xl font-bold tracking-tight">Access List</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-500">
              Approve the players who can create accounts and send questions while the launch stays controlled.
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Stat label="Approved" value={approvedCount} />
            <Stat label="Waiting" value={waitingCount} />
            <Stat label="Questions" value={totalQuestions} />
            <Stat label="Pending" value={pendingQuestions} />
          </div>
        </div>

        <form onSubmit={addEmail} className="mb-8 grid gap-3 rounded-2xl border border-gray-900 bg-[#070707] p-4 sm:grid-cols-[1fr_1fr_auto]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="player@email.com"
            className="rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-gray-500"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, optional"
            className="rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-gray-500"
          />
          <button
            disabled={saving || !email.trim()}
            className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {saving ? <LoadingDots label="Adding" /> : 'Approve email'}
          </button>
        </form>

        {error && (
          <p className="mb-6 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="overflow-hidden rounded-2xl border border-gray-900">
          <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-gray-900 bg-[#050505] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600 sm:grid-cols-[1.35fr_0.6fr_0.7fr_0.8fr_auto]">
            <span>Player</span>
            <span className="hidden sm:block">Questions</span>
            <span className="hidden sm:block">Application</span>
            <span className="hidden sm:block">Status</span>
            <span>Action</span>
          </div>

          {loading ? (
            <div className="flex justify-center px-4 py-14 text-gray-500">
              <LoadingDots label="Loading access list" />
            </div>
          ) : entries.length === 0 ? (
            <p className="px-4 py-14 text-center text-sm text-gray-600">
              No one is on the list yet. Add the first approved email above.
            </p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-gray-900 px-4 py-4 last:border-b-0 sm:grid-cols-[1.35fr_0.6fr_0.7fr_0.8fr_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">{entry.name || entry.email}</p>
                    {entry.high_value && (
                      <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-yellow-300">
                        High value
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-600">{entry.email}</p>
                  {(entry.position || entry.level) && (
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-gray-700">
                      {[entry.position, entry.level].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {entry.challenge && (
                    <p className="mt-1 line-clamp-1 text-xs text-gray-600">{entry.challenge}</p>
                  )}
                  <textarea
                    value={entry.admin_note || ''}
                    onChange={(e) => {
                      const note = e.target.value
                      setEntries((prev) =>
                        prev.map((item) => (item.email === entry.email ? { ...item, admin_note: note } : item))
                      )
                    }}
                    onBlur={(e) => {
                      updatePlayerNote(entry, { admin_note: e.target.value })
                    }}
                    placeholder="Private note: serious parent, follow up, invite to beta..."
                    rows={2}
                    className="mt-3 w-full rounded-xl border border-gray-900 bg-black px-3 py-2 text-xs text-gray-300 outline-none placeholder:text-gray-800 focus:border-gray-700"
                  />
                  {savingNoteEmail === entry.email && (
                    <p className="mt-1 text-[11px] text-gray-700">Saving note...</p>
                  )}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-bold text-white">{entry.question_count}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    {entry.pending_count} pending · {entry.approved_count} answered
                  </p>
                  <p className="mt-1 text-xs text-gray-700">
                    Last: {formatDate(entry.last_question_at)}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-bold text-white">
                    {entry.feedback_up_count} yes · {entry.feedback_down_count} no
                  </p>
                  <p className="mt-1 text-xs text-gray-700">
                    {entry.reflection_count} reflected · {entry.positive_reflection_count} positive
                  </p>
                  <p className="mt-1 text-xs text-gray-700">
                    Last reflection: {formatDate(entry.last_reflection_at)}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <p className={`text-sm font-semibold ${entry.approved ? 'text-green-400' : 'text-yellow-400'}`}>
                    {entry.approved ? 'Approved' : 'Waiting'}
                  </p>
                  <p className="mt-1 text-xs text-gray-700">
                    {entry.has_profile ? 'Has profile' : entry.confirmed ? 'Confirmed' : 'No profile yet'}
                  </p>
                  <button
                    onClick={() => updatePlayerNote(entry, { high_value: !entry.high_value })}
                    className={`mt-3 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                      entry.high_value
                        ? 'border-yellow-500/40 text-yellow-300 hover:border-gray-800 hover:text-gray-500'
                        : 'border-gray-800 text-gray-500 hover:border-yellow-500/40 hover:text-yellow-300'
                    }`}
                  >
                    {entry.high_value ? 'Marked valuable' : 'Mark high-value'}
                  </button>
                </div>
                <button
                  onClick={() => setApproved(entry, !entry.approved)}
                  disabled={entry.has_profile && !entry.waitlist_id}
                  className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                    entry.has_profile && !entry.waitlist_id
                      ? 'cursor-not-allowed border-gray-900 text-gray-700'
                      : entry.approved
                      ? 'border-gray-800 text-gray-400 hover:border-red-900 hover:text-red-300'
                      : 'border-white bg-white text-black hover:opacity-80'
                  }`}
                >
                  {entry.has_profile && !entry.waitlist_id ? 'Existing' : entry.approved ? 'Remove' : 'Approve'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-900 px-4 py-3 text-right">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600">{label}</p>
    </div>
  )
}
