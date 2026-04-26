'use client'

import { useEffect, useState } from 'react'
import LoadingDots from '@/components/ui/LoadingDots'

type Status = 'ready' | 'watch' | 'blocker'
type Check = {
  label: string
  status: Status
  detail: string
}
type Readiness = {
  status: Status
  summary: { blockers: number; watch: number; ready: number }
  checks: Check[]
}

const statusColor: Record<Status, string> = {
  ready: '#34d399',
  watch: '#f59e0b',
  blocker: '#ef4444',
}

export default function LaunchReadinessPage() {
  const [data, setData] = useState<Readiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [backupStatus, setBackupStatus] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/launch-readiness')
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  async function runBackup() {
    setBackupStatus('Backing up...')
    try {
      const res = await fetch('/api/admin/backup-data', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `${res.status}`)
      setBackupStatus(`Backup saved: ${json.path}`)
    } catch (err) {
      setBackupStatus(err instanceof Error ? err.message : 'Backup failed')
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: 'clamp(24px, 5vw, 48px)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 28 }}>
        <div>
          <p style={{ margin: '0 0 12px', color: '#4b5563', fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            Launch control
          </p>
          <h1 style={{ margin: 0, fontSize: 'clamp(40px, 7vw, 72px)', lineHeight: 0.95, letterSpacing: '-0.06em' }}>
            Ready to let players in?
          </h1>
          <p style={{ color: '#6b7280', maxWidth: 620, lineHeight: 1.6, marginTop: 18, fontSize: 16 }}>
            One page for the stuff that matters before launch: errors, email, knowledge base, access, backups, and the learning loop.
          </p>
        </div>
        <button
          onClick={load}
          style={{
            background: 'transparent',
            color: '#888',
            border: '1px solid #262626',
            borderRadius: 8,
            padding: '10px 14px',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#777', padding: '40px 0' }}><LoadingDots label="Checking launch readiness" /></div>
      ) : data ? (
        <>
          <section style={{
            border: `1px solid ${statusColor[data.status]}`,
            borderRadius: 18,
            padding: 24,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))',
            marginBottom: 18,
          }}>
            <p style={{ margin: '0 0 8px', color: statusColor[data.status], textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 11, fontWeight: 900 }}>
              {data.status === 'ready' ? 'Launch ready' : data.status === 'watch' ? 'Launch with eyes open' : 'Do not launch yet'}
            </p>
            <p style={{ margin: 0, color: '#d1d5db', fontSize: 18, lineHeight: 1.5 }}>
              {data.summary.ready} ready · {data.summary.watch} watch · {data.summary.blockers} blockers
            </p>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {data.checks.map((check) => (
              <article
                key={check.label}
                style={{
                  border: '1px solid #181818',
                  borderRadius: 14,
                  padding: 18,
                  background: '#050505',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 16 }}>{check.label}</h2>
                  <span style={{ color: statusColor[check.status], fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {check.status}
                  </span>
                </div>
                <p style={{ margin: 0, color: '#777', lineHeight: 1.5, fontSize: 13 }}>{check.detail}</p>
              </article>
            ))}
          </div>

          <section style={{ border: '1px solid #181818', borderRadius: 14, padding: 18, marginTop: 18, background: '#050505' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Second-brain backup</h2>
            <p style={{ margin: '0 0 14px', color: '#777', fontSize: 13, lineHeight: 1.5 }}>
              Backs up questions, answers, sources, memories, reflections, feedback, profiles, preferences, and access rows to private Supabase Storage.
            </p>
            <button
              onClick={runBackup}
              style={{ background: '#fff', color: '#000', border: 0, borderRadius: 999, padding: '11px 16px', fontWeight: 800, cursor: 'pointer' }}
            >
              Run backup now
            </button>
            {backupStatus && <p style={{ color: '#888', margin: '12px 0 0', fontSize: 12 }}>{backupStatus}</p>}
          </section>
        </>
      ) : (
        <p style={{ color: '#ef4444' }}>Could not load launch readiness.</p>
      )}
    </main>
  )
}
