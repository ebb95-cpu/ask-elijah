'use client'

import { useEffect, useState } from 'react'
import LoadingDots from '@/components/ui/LoadingDots'

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
}

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [label, setLabel] = useState('Tester trial')
  const [maxRedemptions, setMaxRedemptions] = useState('1')
  const [trialDays, setTrialDays] = useState('30')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingCode, setDeletingCode] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [editDays, setEditDays] = useState('')
  const [editUses, setEditUses] = useState('')
  const [editSaving, setEditSaving] = useState(false)

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

  useEffect(() => {
    load()
  }, [])

  async function createCode(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, maxRedemptions, trialDays }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create code')
      setCodes((prev) => [data.code, ...prev])
      setNotice(`Created ${data.code.code}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create code')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(code: PromoCode) {
    setEditingCode(code.code)
    setEditDays(String(code.trial_days))
    setEditUses(String(code.max_redemptions ?? ''))
    setNotice('')
    setError('')
  }

  async function saveEdit(code: PromoCode) {
    setEditSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.code, trial_days: editDays, max_redemptions: editUses }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not update code')
      setCodes((prev) => prev.map((item) => item.code === code.code ? data.code : item))
      setNotice(`Updated ${code.code}`)
      setEditingCode(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update code')
    } finally {
      setEditSaving(false)
    }
  }

  async function toggleCode(code: PromoCode) {
    setCodes((prev) => prev.map((item) => item.code === code.code ? { ...item, active: !item.active } : item))
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.code, active: !code.active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not update code')
      setCodes((prev) => prev.map((item) => item.code === code.code ? data.code : item))
    } catch (e) {
      setCodes((prev) => prev.map((item) => item.code === code.code ? code : item))
      setError(e instanceof Error ? e.message : 'Could not update code')
    }
  }

  async function deleteCode(code: PromoCode) {
    if (code.redeemed_count > 0) {
      setError('This code has already been used. Pause it instead so redemption history stays intact.')
      return
    }

    const confirmed = window.confirm(`Delete promo code ${code.code}? This cannot be undone.`)
    if (!confirmed) return

    setDeletingCode(code.code)
    setError('')
    setNotice('')
    setCodes((prev) => prev.filter((item) => item.code !== code.code))
    try {
      const res = await fetch(`/api/admin/promo-codes?code=${encodeURIComponent(code.code)}`, {
        method: 'DELETE',
      })
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
            <p style={{ color: '#555', fontSize: 10, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 10px' }}>
              Access
            </p>
            <h1 style={{ fontSize: 36, lineHeight: 1, margin: 0 }}>Promo Codes</h1>
          </div>
          <a href="/admin/questions" style={{ color: '#777', fontSize: 13, textDecoration: 'none' }}>Queue</a>
        </div>

        <form onSubmit={createCode} style={{ border: '1px solid #1c1c1c', borderRadius: 14, padding: 18, background: '#050505', marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, alignItems: 'end' }}>
            <Field label="Label" value={label} onChange={setLabel} />
            <Field label="Days" value={trialDays} onChange={setTrialDays} />
            <Field label="Uses" value={maxRedemptions} onChange={setMaxRedemptions} />
            <button disabled={saving} style={{ minHeight: 44, borderRadius: 8, border: '1px solid #fff', background: '#fff', color: '#000', fontSize: 13, fontWeight: 900, padding: '0 16px', cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? <LoadingDots label="Creating" /> : 'Create'}
            </button>
          </div>
        </form>

        {notice && <p style={{ color: '#34d399', fontSize: 13 }}>{notice}</p>}
        {error && <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}

        <section style={{ border: '1px solid #171717', borderRadius: 14, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 24, color: '#777' }}><LoadingDots label="Loading" /></div>
          ) : codes.length === 0 ? (
            <p style={{ padding: 24, color: '#666', margin: 0 }}>No admin promo codes yet.</p>
          ) : codes.map((code) => (
            <div key={code.id} style={{ borderBottom: '1px solid #111', padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 10, alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.08em', margin: 0 }}>{code.code}</p>
                  <p style={{ color: '#666', fontSize: 12, margin: '6px 0 0' }}>
                    {code.label} · {code.trial_days} days · {code.redeemed_count}/{code.max_redemptions ?? '∞'} used
                  </p>
                </div>
                <span style={{ color: code.active ? '#34d399' : '#777', fontSize: 12, fontWeight: 800 }}>
                  {code.active ? 'Active' : 'Paused'}
                </span>
                <button onClick={() => editingCode === code.code ? setEditingCode(null) : startEdit(code)} style={{ border: '1px solid #252525', background: '#080808', color: '#ccc', borderRadius: 999, padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>
                  {editingCode === code.code ? 'Cancel' : 'Edit'}
                </button>
                <button onClick={() => toggleCode(code)} style={{ border: '1px solid #252525', background: '#080808', color: '#ccc', borderRadius: 999, padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>
                  {code.active ? 'Pause' : 'Reactivate'}
                </button>
                <button
                  onClick={() => deleteCode(code)}
                  disabled={deletingCode === code.code || code.redeemed_count > 0}
                  title={code.redeemed_count > 0 ? 'Pause used codes instead so redemption history stays intact.' : 'Delete code'}
                  style={{
                    border: '1px solid #2a1616', background: '#0a0505',
                    color: code.redeemed_count > 0 ? '#555' : '#f87171',
                    borderRadius: 999, padding: '8px 12px',
                    cursor: code.redeemed_count > 0 ? 'not-allowed' : 'pointer',
                    fontSize: 12, fontWeight: 800,
                  }}
                >
                  {deletingCode === code.code ? 'Deleting...' : 'Delete'}
                </button>
              </div>
              {editingCode === code.code && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 14, paddingTop: 14, borderTop: '1px solid #1a1a1a' }}>
                  <label style={{ display: 'grid', gap: 6, color: '#555', fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                    Days
                    <input value={editDays} onChange={(e) => setEditDays(e.target.value)} style={{ width: 80, minHeight: 38, borderRadius: 8, border: '1px solid #222', background: '#000', color: '#fff', padding: '0 10px', fontSize: 14, fontWeight: 700 }} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, color: '#555', fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                    Max Uses
                    <input value={editUses} onChange={(e) => setEditUses(e.target.value)} style={{ width: 80, minHeight: 38, borderRadius: 8, border: '1px solid #222', background: '#000', color: '#fff', padding: '0 10px', fontSize: 14, fontWeight: 700 }} />
                  </label>
                  <button onClick={() => saveEdit(code)} disabled={editSaving} style={{ minHeight: 38, borderRadius: 8, border: '1px solid #34d399', background: '#0a1a12', color: '#34d399', fontSize: 12, fontWeight: 900, padding: '0 16px', cursor: editSaving ? 'wait' : 'pointer' }}>
                    {editSaving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: 'grid', gap: 7, color: '#666', fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ minHeight: 42, borderRadius: 8, border: '1px solid #222', background: '#000', color: '#fff', padding: '0 12px', fontSize: 14, fontWeight: 700 }} />
    </label>
  )
}
