'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface KbSource {
  id: string
  source_title: string
  source_type: string
  source_url: string | null
  topic: string | null
  level: string | null
  chunk_count: number
  created_at: string
}

interface KbSourcesResponse {
  sources: KbSource[]
  totals: Record<string, { sources: number; chunks: number }>
  totalSources: number
  totalChunks: number
}

export default function AdminKbSourcesPage() {
  const [data, setData] = useState<KbSourcesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [backfilling, setBackfilling] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/kb-sources')
      if (!res.ok) throw new Error(`${res.status}`)
      const json = (await res.json()) as KbSourcesResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function runBackfill() {
    if (backfilling) return
    setBackfilling(true)
    setToast('Backfilling from Pinecone — this can take a minute...')
    try {
      const res = await fetch('/api/admin/kb-sources/backfill', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `${res.status}`)
      setToast(
        `Backfill done: ${json.inserted} inserted, ${json.updated} updated, ${json.skipped} skipped.`
      )
      await load()
    } catch (e) {
      setToast(`Backfill failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setBackfilling(false)
      setTimeout(() => setToast(null), 6000)
    }
  }

  const rows = data?.sources || []
  const filtered = filter === 'all' ? rows : rows.filter((r) => r.source_type === filter)
  const types = Array.from(new Set(rows.map((r) => r.source_type))).sort()

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Knowledge Base</h1>
        <Link
          href="/admin/questions"
          style={{ fontSize: '12px', color: '#555555', textDecoration: 'none' }}
        >
          ← Queue
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
          <button
            onClick={runBackfill}
            disabled={backfilling}
            style={{
              fontSize: '12px',
              padding: '6px 12px',
              background: '#1a1a1a',
              color: backfilling ? '#555555' : '#ffffff',
              border: '1px solid #333333',
              borderRadius: '4px',
              cursor: backfilling ? 'wait' : 'pointer',
            }}
          >
            {backfilling ? 'Backfilling...' : 'Backfill from Pinecone'}
          </button>
          <button
            onClick={load}
            style={{
              fontSize: '12px',
              padding: '6px 12px',
              background: 'transparent',
              color: '#ffffff',
              border: '1px solid #333333',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {toast && (
        <div
          style={{
            fontSize: '12px',
            color: '#cccccc',
            background: '#1a1a1a',
            padding: '10px 14px',
            borderRadius: '4px',
            marginBottom: '16px',
          }}
        >
          {toast}
        </div>
      )}

      {data && (
        <div
          style={{
            display: 'flex',
            gap: '24px',
            padding: '12px 16px',
            background: '#0a0a0a',
            border: '1px solid #1a1a1a',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '12px',
          }}
        >
          <div>
            <span style={{ color: '#555555' }}>Total sources: </span>
            <span style={{ fontWeight: 600 }}>{data.totalSources}</span>
          </div>
          <div>
            <span style={{ color: '#555555' }}>Total chunks: </span>
            <span style={{ fontWeight: 600 }}>{data.totalChunks}</span>
          </div>
          {Object.entries(data.totals).map(([t, v]) => (
            <div key={t}>
              <span style={{ color: '#555555' }}>{t}: </span>
              <span style={{ fontWeight: 600 }}>
                {v.sources} ({v.chunks} chunks)
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <FilterChip label={`all (${rows.length})`} active={filter === 'all'} onClick={() => setFilter('all')} />
        {types.map((t) => (
          <FilterChip
            key={t}
            label={`${t} (${rows.filter((r) => r.source_type === t).length})`}
            active={filter === t}
            onClick={() => setFilter(t)}
          />
        ))}
      </div>

      {loading && <div style={{ color: '#555555', fontSize: '13px' }}>Loading...</div>}
      {error && <div style={{ color: '#ff6666', fontSize: '13px' }}>Error: {error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ color: '#555555', fontSize: '13px', padding: '24px 0' }}>
          No sources yet. Upload something via{' '}
          <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: '3px' }}>
            POST /api/admin/ingest
          </code>{' '}
          or run Backfill if you&apos;ve already populated Pinecone.
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ border: '1px solid #1a1a1a', borderRadius: '6px', overflow: 'hidden' }}>
          {filtered.map((s, i) => (
            <div
              key={s.id}
              style={{
                padding: '12px 16px',
                borderTop: i === 0 ? 'none' : '1px solid #1a1a1a',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.source_url ? (
                    <a
                      href={s.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#ffffff', textDecoration: 'none' }}
                    >
                      {s.source_title}
                    </a>
                  ) : (
                    s.source_title
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#555555', marginTop: '2px' }}>
                  {s.source_type}
                  {s.topic ? ` · ${s.topic}` : ''}
                  {s.level ? ` · ${s.level}` : ''}
                  {' · '}
                  {new Date(s.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#888888', whiteSpace: 'nowrap' }}>
                {s.chunk_count} chunk{s.chunk_count === 1 ? '' : 's'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: '11px',
        padding: '4px 10px',
        background: active ? '#ffffff' : 'transparent',
        color: active ? '#000000' : '#888888',
        border: `1px solid ${active ? '#ffffff' : '#333333'}`,
        borderRadius: '999px',
        cursor: 'pointer',
        textTransform: 'lowercase',
      }}
    >
      {label}
    </button>
  )
}
