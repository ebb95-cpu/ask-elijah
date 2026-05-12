'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LoadingDots from '@/components/ui/LoadingDots'

type Redemption = {
  email: string
  name: string
  redeemed_at: string
}

type PromoCode = {
  id: string
  code: string
  label: string
  trial_days: number
  max_redemptions: number | null
  redeemed_count: number
  active: boolean
  expires_at: string | null
  created_at: string
  redemptions: Redemption[]
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function PromoModal({ code, onClose, onToggle, onEdit }: {
  code: PromoCode
  onClose: () => void
  onToggle: (code: PromoCode) => void
  onEdit: (code: PromoCode, days: string, uses: string) => Promise<void>
}) {
  const [editDays, setEditDays] = useState(String(code.trial_days))
  const [editUses, setEditUses] = useState(String(code.max_redemptions ?? ''))
  const [editSaving, setEditSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  const usedPct = code.max_redemptions ? Math.round((code.redeemed_count / code.max_redemptions) * 100) : 0

  async function save() {
    setEditSaving(true)
    await onEdit(code, editDays, editUses)
    setEditSaving(false)
    setEditing(false)
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 680, maxHeight: '85vh', overflowY: 'auto', padding: '32px 28px 40px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 11, color: '#555', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 6px' }}>{code.label}</p>
            <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '0.06em', margin: 0 }}>{code.code}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #222', color: '#777', borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>✕ Close</button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Status', value: code.active ? 'Active' : 'Paused', color: code.active ? '#34d399' : '#777' },
            { label: 'Trial length', value: `${code.trial_days} days`, color: '#fff' },
            { label: 'Redemptions', value: `${code.redeemed_count} / ${code.max_redemptions ?? '∞'}`, color: '#fff' },
          ].map((s) => (
            <div key={s.label} style={{ background: '#111', borderRadius: 12, padding: '14px 16px' }}>
              <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 6px' }}>{s.label}</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Usage bar */}
        {code.max_redemptions && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Usage</span>
              <span style={{ fontSize: 11, color: '#555' }}>{usedPct}%</span>
            </div>
            <div style={{ height: 6, background: '#1a1a1a', borderRadius: 999 }}>
              <div style={{ height: 6, width: `${usedPct}%`, background: usedPct >= 100 ? '#f87171' : '#34d399', borderRadius: 999, transition: 'width 0.4s' }} />
            </div>
          </div>
        )}

        {/* Who used it */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' }}>
            Who used it {code.redemptions.length > 0 ? `· ${code.redemptions.length}` : ''}
          </p>
          {code.redemptions.length === 0 ? (
            <p style={{ color: '#333', fontSize: 14 }}>No one has used this code yet.</p>
          ) : (
            <div style={{ border: '1px solid #1a1a1a', borderRadius: 12, overflow: 'hidden' }}>
              {code.redemptions.map((r, i) => (
                <div key={r.email} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '12px 16px', borderBottom: i < code.redemptions.length - 1 ? '1px solid #111' : 'none', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 3px' }}>{r.name || 'No name yet'}</p>
                    <p style={{ fontSize: 12, color: '#555', margin: 0 }}>{r.email}</p>
                  </div>
                  <p style={{ fontSize: 11, color: '#444', margin: 0, textAlign: 'right' }}>{fmt(r.redeemed_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit section */}
        <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 20 }}>
          {!editing ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditing(true)} style={{ flex: 1, minHeight: 42, borderRadius: 8, border: '1px solid #252525', background: '#080808', color: '#ccc', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                Edit days &amp; uses
              </button>
              <button onClick={() => onToggle(code)} style={{ flex: 1, minHeight: 42, borderRadius: 8, border: '1px solid #252525', background: '#080808', color: '#ccc', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                {code.active ? 'Pause code' : 'Reactivate code'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <label style={{ display: 'grid', gap: 6, color: '#555', fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Days
                <input value={editDays} onChange={(e) => setEditDays(e.target.value)} style={{ width: 80, minHeight: 38, borderRadius: 8, border: '1px solid #222', background: '#000', color: '#fff', padding: '0 10px', fontSize: 14, fontWeight: 700 }} />
              </label>
              <label style={{ display: 'grid', gap: 6, color: '#555', fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Max Uses
                <input value={editUses} onChange={(e) => setEditUses(e.target.value)} style={{ width: 80, minHeight: 38, borderRadius: 8, border: '1px solid #222', background: '#000', color: '#fff', padding: '0 10px', fontSize: 14, fontWeight: 700 }} />
              </label>
              <button onClick={save} disabled={editSaving} style={{ minHeight: 38, borderRadius: 8, border: '1px solid #34d399', background: '#0a1a12', color: '#34d399', fontSize: 13, fontWeight: 900, padding: '0 16px', cursor: editSaving ? 'wait' : 'pointer' }}>
                {editSaving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} style={{ minHeight: 38, borderRadius: 8, border: '1px solid #1a1a1a', background: 'none', color: '#555', fontSize: 13, fontWeight: 800, padding: '0 14px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PromoCodesPage() {
  const router = useRouter()
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [label, setLabel] = useState('Tester trial')
  const [customCode, setCustomCode] = useState('')
  const [maxRedemptions, setMaxRedemptions] = useState('1')
  const [trialDays, setTrialDays] = useState('30')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingCode, setDeletingCode] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [selectedCode, setSelectedCode] = useState<PromoCode | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/promo-codes')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load promo codes')
      setCodes(data.codes || [])
      if (data.error) setError(data.error)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load promo codes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function createCode(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, maxRedemptions, trialDays, code: customCode.trim().toUpperCase() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create code')
      setCodes((prev) => [data.code, ...prev])
      setNotice(`Created ${data.code.code}`)
      setCustomCode('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create code')
    } finally {
      setSaving(false)
    }
  }

  async function toggleCode(code: PromoCode) {
    const updated = { ...code, active: !code.active }
    setCodes((prev) => prev.map((item) => item.code === code.code ? updated : item))
    if (selectedCode?.code === code.code) setSelectedCode(updated)
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.code, active: !code.active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not update code')
      const updated = { redemptions: code.redemptions, ...data.code }
      setCodes((prev) => prev.map((item) => item.code === code.code ? updated : item))
      if (selectedCode?.code === code.code) setSelectedCode(updated)
    } catch (e) {
      setCodes((prev) => prev.map((item) => item.code === code.code ? code : item))
      if (selectedCode?.code === code.code) setSelectedCode(code)
      setError(e instanceof Error ? e.message : 'Could not update code')
    }
  }

  async function saveEdit(code: PromoCode, days: string, uses: string) {
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.code, trial_days: days, max_redemptions: uses }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not update code')
      const updated = { redemptions: code.redemptions, ...data.code }
      setCodes((prev) => prev.map((item) => item.code === code.code ? updated : item))
      if (selectedCode?.code === code.code) setSelectedCode(updated)
      setNotice(`Updated ${code.code}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update code')
    }
  }

  async function deleteCode(code: PromoCode) {
    if (code.redeemed_count > 0) {
      setError('This code has been used. Pause it instead.')
      return
    }
    if (!window.confirm(`Delete ${code.code}? This cannot be undone.`)) return
    setDeletingCode(code.code)
    setCodes((prev) => prev.filter((item) => item.code !== code.code))
    try {
      const res = await fetch(`/api/admin/promo-codes?code=${encodeURIComponent(code.code)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not delete code')
      setNotice(`Deleted ${code.code}`)
    } catch (e) {
      setCodes((prev) => [code, ...prev])
      setError(e instanceof Error ? e.message : 'Could not delete code')
    } finally {
      setDeletingCode(null)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: 'clamp(20px, 5vw, 56px)', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', marginBottom: 28 }}>
          <div>
            <p style={{ color: '#555', fontSize: 10, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 10px' }}>Access</p>
            <h1 style={{ fontSize: 36, lineHeight: 1, margin: 0 }}>Promo Codes</h1>
          </div>
          <a href="/admin/questions" style={{ color: '#777', fontSize: 13, textDecoration: 'none' }}>Queue</a>
        </div>

        <form onSubmit={createCode} style={{ border: '1px solid #1c1c1c', borderRadius: 14, padding: 18, background: '#050505', marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, alignItems: 'end' }}>
            <Field label="Label" value={label} onChange={setLabel} />
            <Field label="Code (optional)" value={customCode} onChange={(v) => setCustomCode(v.toUpperCase())} placeholder="e.g. ELIJAH30" />
            <Field label="Days" value={trialDays} onChange={setTrialDays} />
            <Field label="Uses" value={maxRedemptions} onChange={setMaxRedemptions} />
            <button disabled={saving} style={{ minHeight: 44, borderRadius: 8, border: '1px solid #fff', background: '#fff', color: '#000', fontSize: 13, fontWeight: 900, padding: '0 16px', cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? <LoadingDots label="Creating" /> : 'Create'}
            </button>
          </div>
        </form>

        {notice && <p style={{ color: '#34d399', fontSize: 13, margin: '0 0 12px' }}>{notice}</p>}
        {error && <p style={{ color: '#f87171', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

        <section style={{ border: '1px solid #171717', borderRadius: 14, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 24, color: '#777' }}><LoadingDots label="Loading" /></div>
          ) : codes.length === 0 ? (
            <p style={{ padding: 24, color: '#666', margin: 0 }}>No promo codes yet.</p>
          ) : codes.map((code) => (
            <div key={code.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'center', borderBottom: '1px solid #111', padding: '14px 16px' }}>
              <button
                onClick={() => router.push(`/admin/promo-codes/${encodeURIComponent(code.code)}`)}
                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
              >
                <p style={{ fontSize: 17, fontWeight: 900, letterSpacing: '0.08em', margin: 0, color: '#fff' }}>{code.code}</p>
                <p style={{ color: '#555', fontSize: 12, margin: '5px 0 0' }}>
                  {code.label} · {code.trial_days} days · {code.redeemed_count}/{code.max_redemptions ?? '∞'} used
                  {code.redemptions.length > 0 && <span style={{ color: '#34d399', marginLeft: 6 }}>· {code.redemptions.length} {code.redemptions.length === 1 ? 'user' : 'users'} →</span>}
                </p>
              </button>
              <span style={{ color: code.active ? '#34d399' : '#777', fontSize: 12, fontWeight: 800 }}>
                {code.active ? 'Active' : 'Paused'}
              </span>
              <button onClick={() => toggleCode(code)} style={{ border: '1px solid #252525', background: '#080808', color: '#ccc', borderRadius: 999, padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>
                {code.active ? 'Pause' : 'Reactivate'}
              </button>
              <button
                onClick={() => deleteCode(code)}
                disabled={deletingCode === code.code || code.redeemed_count > 0}
                title={code.redeemed_count > 0 ? 'Pause used codes instead.' : 'Delete'}
                style={{ border: '1px solid #2a1616', background: '#0a0505', color: code.redeemed_count > 0 ? '#333' : '#f87171', borderRadius: 999, padding: '8px 12px', cursor: code.redeemed_count > 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 800 }}
              >
                {deletingCode === code.code ? '...' : 'Delete'}
              </button>
            </div>
          ))}
        </section>
      </div>

      {selectedCode && (
        <PromoModal
          code={selectedCode}
          onClose={() => setSelectedCode(null)}
          onToggle={toggleCode}
          onEdit={saveEdit}
        />
      )}
    </main>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label style={{ display: 'grid', gap: 7, color: '#666', fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ minHeight: 42, borderRadius: 8, border: '1px solid #222', background: '#000', color: '#fff', padding: '0 12px', fontSize: 14, fontWeight: 700 }} />
    </label>
  )
}
