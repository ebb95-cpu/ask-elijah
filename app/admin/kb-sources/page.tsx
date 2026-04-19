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
  is_about_elijah: boolean
  id_prefix: string | null
}

interface KbSourcesResponse {
  sources: KbSource[]
  totals: Record<string, { sources: number; chunks: number }>
  totalSources: number
  totalChunks: number
}

type Tab = 'about' | 'other' | 'all'

function youtubeIdFromUrl(url: string | null): string | null {
  if (!url) return null
  // youtube.com/watch?v=XXX, youtu.be/XXX, youtube.com/embed/XXX, youtube.com/shorts/XXX
  const patterns = [
    /[?&]v=([^&]{11})/,
    /youtu\.be\/([^?&/]{11})/,
    /youtube\.com\/(?:embed|shorts|v)\/([^?&/]{11})/,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return m[1]
  }
  return null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminKbSourcesPage() {
  const [data, setData] = useState<KbSourcesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [backfilling, setBackfilling] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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
        `Backfill done: ${json.inserted} inserted, ${json.updated} updated, ${json.skipped} skipped.`,
      )
      await load()
    } catch (e) {
      setToast(`Backfill failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setBackfilling(false)
      setTimeout(() => setToast(null), 6000)
    }
  }

  async function toggleClassification(s: KbSource) {
    if (busyId) return
    setBusyId(s.id)
    const next = !s.is_about_elijah
    try {
      const res = await fetch('/api/admin/kb-sources/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, is_about_elijah: next }),
      })
      if (!res.ok) throw new Error('classify failed')
      // Optimistic update
      setData((prev) =>
        prev
          ? {
              ...prev,
              sources: prev.sources.map((r) =>
                r.id === s.id ? { ...r, is_about_elijah: next } : r,
              ),
            }
          : prev,
      )
    } catch {
      setToast('Could not update classification.')
      setTimeout(() => setToast(null), 4000)
    } finally {
      setBusyId(null)
    }
  }

  async function deleteSource(s: KbSource) {
    if (busyId) return
    const confirmed = window.confirm(
      `Delete "${s.source_title}" from the knowledge base?\n\nThis removes ${s.chunk_count} vector${s.chunk_count === 1 ? '' : 's'} from Pinecone AND the metadata row. Elijah's answers will no longer pull from this source.\n\nThis can't be undone.`,
    )
    if (!confirmed) return

    setBusyId(s.id)
    try {
      const res = await fetch('/api/admin/kb-sources/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'delete failed')
      setToast(`Deleted "${s.source_title}" (${json.vectorsDeleted} vectors).`)
      setTimeout(() => setToast(null), 5000)
      setData((prev) =>
        prev
          ? {
              ...prev,
              sources: prev.sources.filter((r) => r.id !== s.id),
              totalSources: prev.totalSources - 1,
              totalChunks: prev.totalChunks - s.chunk_count,
            }
          : prev,
      )
    } catch (e) {
      setToast(`Delete failed: ${e instanceof Error ? e.message : 'unknown'}`)
      setTimeout(() => setToast(null), 6000)
    } finally {
      setBusyId(null)
    }
  }

  const rows = data?.sources || []
  const aboutCount = rows.filter((r) => r.is_about_elijah).length
  const otherCount = rows.length - aboutCount
  const filtered =
    tab === 'all' ? rows : tab === 'about' ? rows.filter((r) => r.is_about_elijah) : rows.filter((r) => !r.is_about_elijah)

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
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <TabChip
          label={`About Elijah (${aboutCount})`}
          active={tab === 'about'}
          onClick={() => setTab('about')}
        />
        <TabChip
          label={`Other (${otherCount})`}
          active={tab === 'other'}
          onClick={() => setTab('other')}
        />
        <TabChip label={`All (${rows.length})`} active={tab === 'all'} onClick={() => setTab('all')} />
      </div>

      {loading && <div style={{ color: '#555555', fontSize: '13px' }}>Loading...</div>}
      {error && <div style={{ color: '#ff6666', fontSize: '13px' }}>Error: {error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ color: '#555555', fontSize: '13px', padding: '24px 0' }}>
          No sources in this view yet.
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ border: '1px solid #1a1a1a', borderRadius: '6px', overflow: 'hidden' }}>
          {filtered.map((s, i) => {
            const ytId = youtubeIdFromUrl(s.source_url)
            const isBusy = busyId === s.id
            return (
              <div
                key={s.id}
                style={{
                  padding: '12px 16px',
                  borderTop: i === 0 ? 'none' : '1px solid #1a1a1a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  opacity: isBusy ? 0.5 : 1,
                }}
              >
                {ytId ? (
                  <a
                    href={s.source_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flexShrink: 0,
                      width: '120px',
                      height: '68px',
                      background: `url(https://i.ytimg.com/vi/${ytId}/mqdefault.jpg) center/cover`,
                      borderRadius: '4px',
                      border: '1px solid #1a1a1a',
                    }}
                    aria-label={s.source_title}
                  />
                ) : (
                  <div
                    style={{
                      flexShrink: 0,
                      width: '120px',
                      height: '68px',
                      background: '#0a0a0a',
                      border: '1px solid #1a1a1a',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      color: '#444444',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {s.source_type}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
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
                  <div style={{ fontSize: '11px', color: '#555555', marginTop: '3px' }}>
                    {s.source_type}
                    {s.topic ? ` · ${s.topic}` : ''}
                    {s.level ? ` · ${s.level}` : ''}
                    {' · '}
                    Uploaded {formatDate(s.created_at)}
                    {' · '}
                    {s.chunk_count} chunk{s.chunk_count === 1 ? '' : 's'}
                  </div>
                </div>

                <button
                  onClick={() => toggleClassification(s)}
                  disabled={isBusy}
                  title={s.is_about_elijah ? 'Mark as NOT about Elijah' : 'Mark as about Elijah'}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    background: s.is_about_elijah ? '#4ade80' : 'transparent',
                    color: s.is_about_elijah ? '#000000' : '#888888',
                    border: `1px solid ${s.is_about_elijah ? '#4ade80' : '#333333'}`,
                    borderRadius: '999px',
                    cursor: isBusy ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.is_about_elijah ? '✓ About Elijah' : 'Mark about Elijah'}
                </button>

                <button
                  onClick={() => deleteSource(s)}
                  disabled={isBusy}
                  title="Delete from knowledge base + Pinecone"
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    background: 'transparent',
                    color: '#ff6666',
                    border: '1px solid #4a1a1a',
                    borderRadius: '999px',
                    cursor: isBusy ? 'wait' : 'pointer',
                  }}
                >
                  {isBusy ? '...' : 'Delete'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TabChip({
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
      }}
    >
      {label}
    </button>
  )
}
