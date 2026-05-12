'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import LoadingDots from '@/components/ui/LoadingDots'

type UserDetail = {
  email: string
  name: string
  position: string | null
  level: string | null
  country: string | null
  redeemed_at: string
  question_count: number
}

type PromoDetail = {
  code: string
  label: string
  trial_days: number
  max_redemptions: number | null
  redeemed_count: number
  active: boolean
  created_at: string
  users: UserDetail[]
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: '16px 20px' }}>
      <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 8px' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 900, color: color || '#fff', margin: 0 }}>{value}</p>
    </div>
  )
}

export default function PromoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const codeParam = (params?.code as string || '').toUpperCase()

  const [data, setData] = useState<PromoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!codeParam) return
    fetch(`/api/admin/promo-codes/detail?code=${encodeURIComponent(codeParam)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Could not load promo code details'))
      .finally(() => setLoading(false))
  }, [codeParam])

  const totalQuestions = data?.users.reduce((sum, u) => sum + u.question_count, 0) ?? 0
  const usedPct = data?.max_redemptions ? Math.round((data.redeemed_count / data.max_redemptions) * 100) : 0

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: 'clamp(20px, 5vw, 56px)', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Back */}
        <button onClick={() => router.push('/admin/promo-codes')} style={{ background: 'none', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 28, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Back to Promo Codes
        </button>

        {loading && <div style={{ color: '#555' }}><LoadingDots label="Loading" /></div>}
        {error && <p style={{ color: '#f87171' }}>{error}</p>}

        {data && (
          <>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 11, color: '#555', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 8px' }}>{data.label}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: '0.06em', margin: 0 }}>{data.code}</h1>
                <span style={{ fontSize: 12, fontWeight: 800, color: data.active ? '#34d399' : '#777', background: data.active ? '#0a1a12' : '#111', border: `1px solid ${data.active ? '#1a3d28' : '#222'}`, borderRadius: 999, padding: '4px 12px' }}>
                  {data.active ? 'Active' : 'Paused'}
                </span>
              </div>
              <p style={{ color: '#444', fontSize: 13, margin: '8px 0 0' }}>Created {fmt(data.created_at)} · {data.trial_days}-day trial</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
              <Stat label="Redemptions" value={`${data.redeemed_count} / ${data.max_redemptions ?? '∞'}`} />
              <Stat label="Total questions asked" value={totalQuestions} color="#a3e635" />
              <Stat label="Avg questions / user" value={data.users.length > 0 ? (totalQuestions / data.users.length).toFixed(1) : '0'} />
              <Stat label="Slots remaining" value={data.max_redemptions ? Math.max(0, data.max_redemptions - data.redeemed_count) : '∞'} />
            </div>

            {/* Usage bar */}
            {data.max_redemptions && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Usage</span>
                  <span style={{ fontSize: 11, color: '#555' }}>{usedPct}%</span>
                </div>
                <div style={{ height: 8, background: '#111', borderRadius: 999 }}>
                  <div style={{ height: 8, width: `${Math.min(usedPct, 100)}%`, background: usedPct >= 100 ? '#f87171' : '#34d399', borderRadius: 999, transition: 'width 0.4s' }} />
                </div>
              </div>
            )}

            {/* Users table */}
            <div>
              <p style={{ fontSize: 11, color: '#555', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 14px' }}>
                Users who redeemed · {data.users.length}
              </p>

              {data.users.length === 0 ? (
                <div style={{ border: '1px solid #1a1a1a', borderRadius: 14, padding: '32px 24px', textAlign: 'center' }}>
                  <p style={{ color: '#333', fontSize: 15, margin: 0 }}>No one has used this code yet.</p>
                </div>
              ) : (
                <div style={{ border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
                  {/* Table header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '10px 18px', borderBottom: '1px solid #1a1a1a', background: '#080808' }}>
                    {['Name', 'Email', 'Position', 'Level', 'Questions', 'Redeemed'].map(h => (
                      <p key={h} style={{ fontSize: 10, color: '#444', letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0, fontWeight: 900 }}>{h}</p>
                    ))}
                  </div>
                  {data.users.map((u, i) => (
                    <div key={u.email} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '14px 18px', borderBottom: i < data.users.length - 1 ? '1px solid #0f0f0f' : 'none', alignItems: 'center' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>{u.name || <span style={{ color: '#333' }}>—</span>}</p>
                      <p style={{ fontSize: 12, color: '#666', margin: 0, wordBreak: 'break-all' }}>{u.email}</p>
                      <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{u.position || <span style={{ color: '#333' }}>—</span>}</p>
                      <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{u.level || <span style={{ color: '#333' }}>—</span>}</p>
                      <p style={{ fontSize: 14, fontWeight: 800, color: u.question_count > 0 ? '#a3e635' : '#333', margin: 0 }}>{u.question_count}</p>
                      <p style={{ fontSize: 11, color: '#444', margin: 0 }}>{fmt(u.redeemed_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
