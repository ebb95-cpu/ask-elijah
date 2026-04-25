'use client'

import { useEffect, useMemo, useState } from 'react'
import LoadingDots from '@/components/ui/LoadingDots'

type AccessEntry = {
  id: string
  email: string
  name: string | null
  challenge: string | null
  confirmed: boolean
  approved: boolean
  notified: boolean
  created_at: string
}

export default function AdminAccessPage() {
  const [entries, setEntries] = useState<AccessEntry[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const approvedCount = useMemo(() => entries.filter((e) => e.approved).length, [entries])
  const waitingCount = entries.length - approvedCount

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
      const res = await fetch('/api/admin/access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, approved }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update access')
      setEntries((prev) => prev.map((item) => (item.id === entry.id ? data.entry : item)))
    } catch (e) {
      setEntries((prev) => prev.map((item) => (item.id === entry.id ? entry : item)))
      setError(e instanceof Error ? e.message : 'Failed to update access')
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
          <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-gray-900 bg-[#050505] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600 sm:grid-cols-[1.2fr_0.7fr_0.6fr_auto]">
            <span>Email</span>
            <span className="hidden sm:block">Name</span>
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
                className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-gray-900 px-4 py-4 last:border-b-0 sm:grid-cols-[1.2fr_0.7fr_0.6fr_auto]"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{entry.email}</p>
                  {entry.challenge && (
                    <p className="mt-1 line-clamp-1 text-xs text-gray-600">{entry.challenge}</p>
                  )}
                </div>
                <p className="hidden text-sm text-gray-500 sm:block">{entry.name || '-'}</p>
                <p className={`hidden text-sm font-semibold sm:block ${entry.approved ? 'text-green-400' : 'text-yellow-400'}`}>
                  {entry.approved ? 'Approved' : 'Waiting'}
                </p>
                <button
                  onClick={() => setApproved(entry, !entry.approved)}
                  className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                    entry.approved
                      ? 'border-gray-800 text-gray-400 hover:border-red-900 hover:text-red-300'
                      : 'border-white bg-white text-black hover:opacity-80'
                  }`}
                >
                  {entry.approved ? 'Remove' : 'Approve'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-900 px-4 py-3 text-right">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600">{label}</p>
    </div>
  )
}
