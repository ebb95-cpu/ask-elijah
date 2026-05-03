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
  invite_sent_at: string | null
  access_expires_at: string | null
  archived_at: string | null
  archived: boolean
  access_expired: boolean
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
  last_email_provider: 'beehiiv' | 'resend' | null
  last_email_action: string | null
  last_email_status: 'sent' | 'failed' | null
  last_email_subject: string | null
  last_email_at: string | null
  has_profile: boolean
  is_founding_member: boolean
}

type EmailAction = 'player_invite' | 'player_check_in' | 'parent_sequence' | 'consistency_club'

const EMAIL_ACTIONS: Record<EmailAction, { label: string; provider: 'beehiiv' | 'resend' }> = {
  player_invite: { label: 'Player invite', provider: 'resend' },
  player_check_in: { label: 'Check in', provider: 'resend' },
  parent_sequence: { label: 'Parent sequence', provider: 'beehiiv' },
  consistency_club: { label: 'Consistency Club', provider: 'beehiiv' },
}

export default function AdminAccessPage() {
  const [entries, setEntries] = useState<AccessEntry[]>([])
  const [filter, setFilter] = useState<'applied' | 'approved' | 'founders' | 'waiting' | 'expired' | 'archived'>('applied')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sendInviteOnAdd, setSendInviteOnAdd] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingNoteEmail, setSavingNoteEmail] = useState<string | null>(null)
  const [sendingInviteEmail, setSendingInviteEmail] = useState<string | null>(null)
  const [sendingEmailAction, setSendingEmailAction] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const activeEntries = useMemo(() => entries.filter((e) => !e.archived), [entries])
  const archivedEntries = useMemo(() => entries.filter((e) => e.archived), [entries])
  const approvedCount = useMemo(() => activeEntries.filter((e) => e.approved).length, [activeEntries])
  const foundingCount = useMemo(() => activeEntries.filter((e) => e.is_founding_member).length, [activeEntries])
  const foundingSeatsLeft = Math.max(0, 200 - foundingCount)
  const waitingCount = useMemo(() => activeEntries.filter((e) => !e.approved && !e.access_expired).length, [activeEntries])
  const expiredCount = useMemo(() => activeEntries.filter((e) => e.access_expired).length, [activeEntries])
  const totalQuestions = useMemo(() => activeEntries.reduce((sum, entry) => sum + entry.question_count, 0), [activeEntries])
  const pendingQuestions = useMemo(() => activeEntries.reduce((sum, entry) => sum + entry.pending_count, 0), [activeEntries])
  const heldSpots = useMemo(
    () => activeEntries.filter((entry) => getInviteStatus(entry).tone === 'countdown').length,
    [activeEntries]
  )
  const filteredEntries = useMemo(() => {
    if (filter === 'archived') return archivedEntries
    if (filter === 'approved') return activeEntries.filter((e) => e.approved && !e.access_expired)
    if (filter === 'founders') return activeEntries.filter((e) => e.is_founding_member)
    if (filter === 'waiting') return activeEntries.filter((e) => !e.approved && !e.access_expired)
    if (filter === 'expired') return activeEntries.filter((e) => e.access_expired)
    return activeEntries
  }, [activeEntries, archivedEntries, filter])

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
    setNotice('')
    try {
      const res = await fetch('/api/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, sendInvite: sendInviteOnAdd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to approve email')
      setEntries((prev) => [data.entry, ...prev.filter((entry) => entry.id !== data.entry.id)])
      setNotice(data.invite_error || data.message || (data.invite_sent ? `Invite sent to ${data.entry.email}.` : `${data.entry.email} approved.`))
      setEmail('')
      setName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve email')
    } finally {
      setSaving(false)
    }
  }

  async function setApproved(entry: AccessEntry, approved: boolean, sendInvite = false) {
    setEntries((prev) => prev.map((item) => (item.id === entry.id ? { ...item, approved, archived: false, archived_at: null } : item)))
    if (sendInvite) setSendingInviteEmail(entry.email)
    setNotice('')
    try {
      const res = entry.waitlist_id
        ? await fetch('/api/admin/access', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ waitlist_id: entry.waitlist_id, approved, sendInvite }),
          })
        : await fetch('/api/admin/access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: entry.email, name: entry.name || '', sendInvite }),
          })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update access')
      setEntries((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                ...data.entry,
                question_count: item.question_count,
                pending_count: item.pending_count,
                approved_count: item.approved_count,
                skipped_count: item.skipped_count,
                feedback_up_count: item.feedback_up_count,
                feedback_down_count: item.feedback_down_count,
                last_question_at: item.last_question_at,
                last_answered_at: item.last_answered_at,
                reflection_count: item.reflection_count,
                positive_reflection_count: item.positive_reflection_count,
                negative_reflection_count: item.negative_reflection_count,
                last_reflection_at: item.last_reflection_at,
                admin_note: item.admin_note,
                high_value: item.high_value,
                admin_note_updated_at: item.admin_note_updated_at,
                last_email_provider: item.last_email_provider,
                last_email_action: item.last_email_action,
                last_email_status: item.last_email_status,
                last_email_subject: item.last_email_subject,
                last_email_at: item.last_email_at,
              }
            : item
        )
      )
      if (data.invite_error) setNotice(data.invite_error)
      else if (data.invite_sent) setNotice(`Invite sent to ${entry.email}.`)
    } catch (e) {
      setEntries((prev) => prev.map((item) => (item.id === entry.id ? entry : item)))
      setError(e instanceof Error ? e.message : 'Failed to update access')
    } finally {
      if (sendInvite) setSendingInviteEmail(null)
    }
  }

  async function sendInvite(entry: AccessEntry) {
    if (!entry.waitlist_id) return
    await setApproved(entry, true, true)
  }

  function actionLabel(entry: AccessEntry) {
    if (sendingInviteEmail === entry.email) return 'Sending...'
    if (entry.archived) return 'Restore'
    if (entry.has_profile && !entry.waitlist_id) return 'Existing'
    if (entry.access_expired) return 'Re-invite'
    if (!entry.approved) return 'Approve & invite'
    if (!entry.notified) return 'Send invite'
    return 'Remove'
  }

  async function handleAction(entry: AccessEntry) {
    if (entry.archived) {
      await setApproved(entry, false, false)
      return
    }
    if (entry.has_profile && !entry.waitlist_id) return
    if (entry.access_expired) {
      await setApproved(entry, true, true)
      return
    }
    if (!entry.approved) {
      await setApproved(entry, true, true)
      return
    }
    if (!entry.notified) {
      await sendInvite(entry)
      return
    }
    await archiveEntry(entry)
  }

  async function archiveEntry(entry: AccessEntry) {
    if (!entry.waitlist_id) return
    const previous = entry
    setEntries((prev) => prev.map((item) => (item.id === entry.id ? { ...item, approved: false, archived: true, archived_at: new Date().toISOString() } : item)))
    setNotice('')
    try {
      const res = await fetch('/api/admin/access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitlist_id: entry.waitlist_id, archive: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to archive player')
      setEntries((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                ...data.entry,
                question_count: item.question_count,
                pending_count: item.pending_count,
                approved_count: item.approved_count,
                skipped_count: item.skipped_count,
                feedback_up_count: item.feedback_up_count,
                feedback_down_count: item.feedback_down_count,
                last_question_at: item.last_question_at,
                last_answered_at: item.last_answered_at,
                reflection_count: item.reflection_count,
                positive_reflection_count: item.positive_reflection_count,
                negative_reflection_count: item.negative_reflection_count,
                last_reflection_at: item.last_reflection_at,
                admin_note: item.admin_note,
                high_value: item.high_value,
                admin_note_updated_at: item.admin_note_updated_at,
                last_email_provider: item.last_email_provider,
                last_email_action: item.last_email_action,
                last_email_status: item.last_email_status,
                last_email_subject: item.last_email_subject,
                last_email_at: item.last_email_at,
              }
            : item
        )
      )
      setNotice(`${entry.email} removed from active access. Their history is still saved.`)
    } catch (e) {
      setEntries((prev) => prev.map((item) => (item.id === previous.id ? previous : item)))
      setError(e instanceof Error ? e.message : 'Failed to archive player')
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

  async function sendEmailAction(entry: AccessEntry, action: EmailAction) {
    const config = EMAIL_ACTIONS[action]
    const key = `${entry.email}:${action}`
    setSendingEmailAction(key)
    setError('')
    setNotice('')

    try {
      const res = await fetch('/api/admin/email-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: entry.email,
          name: entry.name,
          challenge: entry.challenge,
          action,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed to send with ${providerLabel(config.provider)}`)

      setEntries((prev) =>
        prev.map((item) =>
          item.email === entry.email
            ? {
                ...item,
                last_email_provider: config.provider,
                last_email_action: action,
                last_email_status: 'sent',
                last_email_subject: data.subject || null,
                last_email_at: data.sent_at || new Date().toISOString(),
              }
            : item
        )
      )
      setNotice(data.message || `${config.label} sent with ${providerLabel(config.provider)}.`)
    } catch (e) {
      setEntries((prev) =>
        prev.map((item) =>
          item.email === entry.email
            ? {
                ...item,
                last_email_provider: config.provider,
                last_email_action: action,
                last_email_status: 'failed',
                last_email_subject: null,
                last_email_at: new Date().toISOString(),
              }
            : item
        )
      )
      setError(e instanceof Error ? e.message : `Failed to send with ${providerLabel(config.provider)}`)
    } finally {
      setSendingEmailAction(null)
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
              Approve up to 200 Founding players who can create accounts and send questions while the launch stays controlled.
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Stat label="Founders" value={foundingCount} />
            <Stat label="Seats left" value={foundingSeatsLeft} />
            <Stat label="Waiting" value={waitingCount} />
            <Stat label="Held spots" value={heldSpots} />
            <Stat label="Questions" value={totalQuestions} />
            <Stat label="Pending" value={pendingQuestions} />
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <AccessFilter active={filter === 'applied'} label="Applied" count={activeEntries.length} onClick={() => setFilter('applied')} />
          <AccessFilter active={filter === 'approved'} label="Approved" count={approvedCount} onClick={() => setFilter('approved')} />
          <AccessFilter active={filter === 'founders'} label="Founders" count={foundingCount} onClick={() => setFilter('founders')} />
          <AccessFilter active={filter === 'waiting'} label="Waiting" count={waitingCount} onClick={() => setFilter('waiting')} />
          <AccessFilter active={filter === 'expired'} label="Expired" count={expiredCount} onClick={() => setFilter('expired')} />
          <AccessFilter active={filter === 'archived'} label="Archived" count={archivedEntries.length} onClick={() => setFilter('archived')} />
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
            {saving ? <LoadingDots label={sendInviteOnAdd ? 'Sending' : 'Adding'} /> : sendInviteOnAdd ? 'Approve & invite' : 'Approve email'}
          </button>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 sm:col-span-3">
            <input
              type="checkbox"
              checked={sendInviteOnAdd}
              onChange={(e) => setSendInviteOnAdd(e.target.checked)}
              className="h-4 w-4 accent-white"
            />
            Send welcome invite email now
          </label>
        </form>

        {notice && (
          <p className="mb-6 rounded-xl border border-green-900/60 bg-green-950/20 px-4 py-3 text-sm text-green-300">
            {notice}
          </p>
        )}

        {error && (
          <p className="mb-6 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="overflow-hidden rounded-2xl border border-gray-900">
          <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-gray-900 bg-[#050505] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600 sm:grid-cols-[1.3fr_0.55fr_0.65fr_0.6fr_0.65fr_auto]">
            <span>Player</span>
            <span className="hidden sm:block">Questions</span>
            <span className="hidden sm:block">Application</span>
            <span className="hidden sm:block">Invite</span>
            <span className="hidden sm:block">Status</span>
            <span>Action</span>
          </div>

          {loading ? (
            <div className="flex justify-center px-4 py-14 text-gray-500">
              <LoadingDots label="Loading access list" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <p className="px-4 py-14 text-center text-sm text-gray-600">
              {filter === 'archived'
                ? 'No archived players yet.'
                : 'No players match this view yet.'}
            </p>
          ) : (
            filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className={`grid grid-cols-[1fr_auto] items-center gap-4 border-b border-gray-900 px-4 py-4 last:border-b-0 sm:grid-cols-[1.3fr_0.55fr_0.65fr_0.6fr_0.65fr_auto] ${entry.archived ? 'bg-red-950/5 opacity-70' : ''}`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">{entry.name || entry.email}</p>
                    {entry.is_founding_member && (
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-300">
                        Founder
                      </span>
                    )}
                    {entry.high_value && (
                      <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-yellow-300">
                        High value
                      </span>
                    )}
                    {entry.archived && (
                      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-red-300">
                        Archived
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
                  <div className="mt-3 grid gap-1 text-xs text-gray-700 sm:hidden">
                    <p>
                      {entry.question_count} questions · {entry.pending_count} pending · {entry.approved_count} answered
                    </p>
                    <p>
                      {entry.reflection_count} reflected · {entry.feedback_up_count} yes · {entry.feedback_down_count} no
                    </p>
                    <p className={getInviteStatus(entry).className}>
                      {getInviteStatus(entry).label}
                    </p>
                  </div>
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
                  <div className="mt-3 rounded-xl border border-gray-900 bg-[#050505] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-700">
                        Email touch
                      </p>
                      <p className={`text-[11px] ${entry.last_email_status === 'failed' ? 'text-red-300' : 'text-gray-600'}`}>
                        {formatEmailTouch(entry)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(Object.keys(EMAIL_ACTIONS) as EmailAction[]).map((action) => {
                        const config = EMAIL_ACTIONS[action]
                        const isSending = sendingEmailAction === `${entry.email}:${action}`
                        const isLastAction = entry.last_email_action === action && entry.last_email_provider === config.provider
                        const sentText = entry.last_email_status === 'failed'
                          ? `Failed with ${providerLabel(config.provider)}`
                          : `Sent with ${providerLabel(config.provider)}`
                        return (
                          <button
                            key={action}
                            type="button"
                            onClick={() => sendEmailAction(entry, action)}
                            disabled={!!sendingEmailAction}
                            className="rounded-full border border-gray-800 px-3 py-1.5 text-[11px] font-bold text-gray-500 transition-colors hover:border-gray-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isSending
                              ? `Sending with ${providerLabel(config.provider)}...`
                              : isLastAction
                                ? sentText
                                : `${config.label} · send with ${providerLabel(config.provider)}`}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => updatePlayerNote(entry, { high_value: !entry.high_value })}
                    className={`mt-3 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors sm:hidden ${
                      entry.high_value
                        ? 'border-yellow-500/40 text-yellow-300 hover:border-gray-800 hover:text-gray-500'
                        : 'border-gray-800 text-gray-500 hover:border-yellow-500/40 hover:text-yellow-300'
                    }`}
                  >
                    {entry.high_value ? 'Marked valuable' : 'Mark high-value'}
                  </button>
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
                  {(() => {
                    const inviteStatus = getInviteStatus(entry)
                    return (
                      <p className={`text-sm font-bold ${inviteStatus.className}`}>
                        {inviteStatus.label}
                      </p>
                    )
                  })()}
                  <p className="mt-1 text-xs text-gray-700">
                    {entry.access_expires_at ? `Spot opens ${formatDate(entry.access_expires_at)}` : 'No invite clock'}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <p className={`text-sm font-semibold ${
                    entry.archived ? 'text-red-300' : entry.access_expired ? 'text-red-300' : entry.approved ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {entry.archived ? 'Archived' : entry.access_expired ? 'Expired' : entry.approved ? 'Approved' : 'Waiting'}
                  </p>
                  <p className="mt-1 text-xs text-gray-700">
                    {entry.has_profile ? 'Has profile' : entry.confirmed ? 'Confirmed' : 'No profile yet'}
                  </p>
                  <p className="mt-1 text-xs text-gray-700">
                    {entry.access_expired
                      ? 'No question in 7 days'
                      : entry.archived
                        ? `Removed ${formatDate(entry.archived_at)}`
                      : entry.access_expires_at
                        ? `Invite expires ${formatDate(entry.access_expires_at)}`
                        : entry.notified
                          ? 'Invite sent'
                          : 'Not invited yet'}
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
                  onClick={() => handleAction(entry)}
                  disabled={(entry.has_profile && !entry.waitlist_id) || sendingInviteEmail === entry.email}
                  className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                    entry.has_profile && !entry.waitlist_id
                      ? 'cursor-not-allowed border-gray-900 text-gray-700'
                      : entry.archived
                      ? 'border-white bg-white text-black hover:opacity-80'
                      : !entry.approved || !entry.notified || entry.access_expired
                      ? 'border-white bg-white text-black hover:opacity-80'
                      : entry.approved
                      ? 'border-gray-800 text-gray-400 hover:border-red-900 hover:text-red-300'
                      : 'border-white bg-white text-black hover:opacity-80'
                  }`}
                >
                  {actionLabel(entry)}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}

function AccessFilter({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
        active
          ? 'border-white bg-white text-black'
          : 'border-gray-800 text-gray-500 hover:border-gray-600 hover:text-white'
      }`}
    >
      {label} <span className={active ? 'text-black/60' : 'text-gray-700'}>{count}</span>
    </button>
  )
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function providerLabel(provider: 'beehiiv' | 'resend') {
  return provider === 'beehiiv' ? 'Beehiiv' : 'Resend'
}

function emailActionLabel(action: string | null) {
  if (!action) return ''
  return EMAIL_ACTIONS[action as EmailAction]?.label || action.replaceAll('_', ' ')
}

function formatEmailTouch(entry: AccessEntry) {
  if (!entry.last_email_provider || !entry.last_email_at) return 'No email sent yet'
  const verb = entry.last_email_status === 'failed' ? 'Failed with' : 'Sent with'
  return `${verb} ${providerLabel(entry.last_email_provider)} · ${emailActionLabel(entry.last_email_action)} · ${formatDate(entry.last_email_at)}`
}

function getInviteStatus(entry: AccessEntry): {
  label: string
  className: string
  tone: 'countdown' | 'active' | 'expired' | 'none'
} {
  if (entry.question_count > 0 && entry.access_expires_at) {
    return { label: 'Activated', className: 'text-green-400', tone: 'active' }
  }

  if (entry.access_expired) {
    return { label: 'Expired', className: 'text-red-300', tone: 'expired' }
  }

  if (!entry.access_expires_at) {
    return { label: entry.notified ? 'Invite sent' : 'No clock', className: 'text-gray-600', tone: 'none' }
  }

  const now = Date.now()
  const expires = new Date(entry.access_expires_at).getTime()
  const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24))

  if (daysLeft <= 0) return { label: 'Expires today', className: 'text-yellow-300', tone: 'countdown' }
  if (daysLeft === 1) return { label: '1 day left', className: 'text-yellow-300', tone: 'countdown' }
  return { label: `${daysLeft} days left`, className: daysLeft <= 2 ? 'text-yellow-300' : 'text-white', tone: 'countdown' }
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-900 px-4 py-3 text-right">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600">{label}</p>
    </div>
  )
}
