'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  thumbnail_url: string | null
  id_prefix: string | null
  published_at: string | null
}

interface KbSourcesResponse {
  sources: KbSource[]
  totals: Record<string, { sources: number; chunks: number }>
  totalSources: number
  totalChunks: number
}

type QueryResult = {
  id: string
  score: number
  wouldUse: boolean
  title: string
  type: string
  url: string | null
  topic: string | null
  level: string | null
  text: string
}

function youtubeIdFromUrl(url: string | null): string | null {
  if (!url) return null
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

function thumbnailFor(s: KbSource): string | null {
  const yt = youtubeIdFromUrl(s.source_url)
  if (yt) return `https://i.ytimg.com/vi/${yt}/mqdefault.jpg`
  return s.thumbnail_url
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminKbSourcesPage() {
  const [data, setData] = useState<KbSourcesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [backfilling, setBackfilling] = useState(false)
  const [refreshingTitles, setRefreshingTitles] = useState(false)
  const [ingestingNewsletters, setIngestingNewsletters] = useState(false)
  const [backfillingDates, setBackfillingDates] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const fetchedThumbsRef = useRef<Set<string>>(new Set())

  // Test query panel state
  const [testOpen, setTestOpen] = useState(false)
  const [testQuery, setTestQuery] = useState('')
  const [testResults, setTestResults] = useState<QueryResult[] | null>(null)
  const [testMinScore, setTestMinScore] = useState(0.35)
  const [testRunning, setTestRunning] = useState(false)

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

  // Lazy-fetch og:image for non-YouTube sources missing a thumbnail.
  // Fires once per page load per source, capped to prevent thundering-herd.
  useEffect(() => {
    if (!data?.sources) return
    const toFetch = data.sources
      .filter(
        (s) =>
          !s.thumbnail_url &&
          !youtubeIdFromUrl(s.source_url) &&
          s.source_url &&
          !fetchedThumbsRef.current.has(s.id),
      )
      .slice(0, 10) // cap per tick

    toFetch.forEach((s) => {
      fetchedThumbsRef.current.add(s.id)
      fetch('/api/admin/kb-sources/fetch-thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id }),
      })
        .then((r) => r.ok && r.json())
        .then((r) => {
          if (r?.thumbnail_url) {
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    sources: prev.sources.map((x) =>
                      x.id === s.id ? { ...x, thumbnail_url: r.thumbnail_url } : x,
                    ),
                  }
                : prev,
            )
          }
        })
        .catch(() => {})
    })
  }, [data])

  async function backfillPublishDates() {
    if (backfillingDates) return
    setBackfillingDates(true)
    try {
      const totals = { updated: 0, failed: 0 }
      let after: string | null = null
      for (let iter = 0; iter < 20; iter++) {
        setToast(
          `Backfilling publish dates — so far: ${totals.updated} fixed, ${totals.failed} skipped...`,
        )
        const url =
          '/api/admin/kb-sources/backfill-published-at' +
          (after ? `?after=${encodeURIComponent(after)}` : '')
        const res = await fetch(url, { method: 'POST' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || `${res.status}`)
        totals.updated += json.updated || 0
        totals.failed += json.failed || 0
        if (!json.partial) {
          setToast(`Publish dates done: ${totals.updated} fixed, ${totals.failed} couldn't be resolved.`)
          break
        }
        after = json.nextAfter
      }
      await load()
    } catch (e) {
      setToast(`Publish date backfill failed: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally {
      setBackfillingDates(false)
      setTimeout(() => setToast(null), 10000)
    }
  }

  async function ingestAllNewsletters() {
    if (ingestingNewsletters) return
    setIngestingNewsletters(true)
    try {
      let page = 1
      const totals = { ingested: 0, skipped: 0, errors: 0, totalSeen: 0 }
      for (let iter = 0; iter < 20; iter++) {
        setToast(
          `Pulling newsletters from Beehiiv (page ${page}) — so far: ${totals.ingested} new, ${totals.skipped} already had, ${totals.errors} errors.`,
        )
        const res = await fetch(
          `/api/admin/kb-sources/ingest-all-newsletters?page=${page}`,
          { method: 'POST' },
        )
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || `${res.status}`)
        totals.ingested += json.ingested || 0
        totals.skipped += json.skipped || 0
        totals.errors += json.errors || 0
        totals.totalSeen += json.totalSeen || 0
        if (!json.partial) {
          setToast(
            `Done: ${totals.ingested} new newsletters, ${totals.skipped} already ingested, ${totals.errors} errors (${totals.totalSeen} total scanned).`,
          )
          break
        }
        page = json.nextPage
      }
      await load()
    } catch (e) {
      setToast(`Newsletter ingest failed: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally {
      setIngestingNewsletters(false)
      setTimeout(() => setToast(null), 10000)
    }
  }

  async function refreshYoutubeTitles() {
    if (refreshingTitles) return
    setRefreshingTitles(true)
    setToast('Fetching real YouTube titles from oEmbed...')
    try {
      const res = await fetch('/api/admin/kb-sources/refresh-youtube-titles', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `${res.status}`)
      setToast(
        `Titles refreshed: ${json.updated} fixed, ${json.failed} failed (${json.checked} checked).`,
      )
      await load()
    } catch (e) {
      setToast(`Refresh failed: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally {
      setRefreshingTitles(false)
      setTimeout(() => setToast(null), 6000)
    }
  }

  async function runBackfill() {
    if (backfilling) return
    setBackfilling(true)
    setToast('Backfilling from Pinecone — this can take a minute...')
    try {
      const res = await fetch('/api/admin/kb-sources/backfill', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `${res.status}`)
      setToast(`Backfill done: ${json.inserted} inserted, ${json.updated} updated, ${json.skipped} skipped.`)
      await load()
    } catch (e) {
      setToast(`Backfill failed: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally {
      setBackfilling(false)
      setTimeout(() => setToast(null), 6000)
    }
  }

  async function deleteSource(s: KbSource) {
    if (busyId) return
    const ok = window.confirm(
      `Delete "${s.source_title}"?\n\nRemoves ${s.chunk_count} vector${s.chunk_count === 1 ? '' : 's'} from Pinecone AND the metadata row. Can't be undone.`,
    )
    if (!ok) return

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

  async function runTestQuery() {
    if (testRunning || !testQuery.trim()) return
    setTestRunning(true)
    setTestResults(null)
    try {
      const res = await fetch('/api/admin/kb-sources/test-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: testQuery }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'query failed')
      setTestResults(json.results)
      setTestMinScore(json.minScore ?? 0.35)
    } catch (e) {
      setToast(`Test query failed: ${e instanceof Error ? e.message : 'unknown'}`)
      setTimeout(() => setToast(null), 5000)
    } finally {
      setTestRunning(false)
    }
  }

  const rows = data?.sources || []
  const typeList = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of rows) counts[r.source_type] = (counts[r.source_type] || 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (tab !== 'all' && r.source_type !== tab) return false
      if (q && !r.source_title.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, tab, search])

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Knowledge Base</h1>
        <Link href="/admin/questions" style={{ fontSize: '12px', color: '#555555', textDecoration: 'none' }}>
          ← Queue
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setTestOpen((v) => !v)}
            style={{
              fontSize: '12px',
              padding: '6px 12px',
              background: testOpen ? '#ffffff' : '#1a1a1a',
              color: testOpen ? '#000000' : '#ffffff',
              border: '1px solid #333333',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {testOpen ? 'Hide test query' : 'Test query'}
          </button>
          <button
            onClick={backfillPublishDates}
            disabled={backfillingDates}
            title="Fill in publish dates for rows missing them (Beehiiv for newsletters, YouTube page scrape for videos)"
            style={{
              fontSize: '12px',
              padding: '6px 12px',
              background: '#1a1a1a',
              color: backfillingDates ? '#555555' : '#ffffff',
              border: '1px solid #333333',
              borderRadius: '4px',
              cursor: backfillingDates ? 'wait' : 'pointer',
            }}
          >
            {backfillingDates ? 'Fixing dates...' : 'Backfill publish dates'}
          </button>
          <button
            onClick={ingestAllNewsletters}
            disabled={ingestingNewsletters}
            title="Paginate through every Beehiiv post and embed any not yet in Pinecone"
            style={{
              fontSize: '12px',
              padding: '6px 12px',
              background: '#1a1a1a',
              color: ingestingNewsletters ? '#555555' : '#ffffff',
              border: '1px solid #333333',
              borderRadius: '4px',
              cursor: ingestingNewsletters ? 'wait' : 'pointer',
            }}
          >
            {ingestingNewsletters ? 'Pulling...' : 'Pull all newsletters'}
          </button>
          <button
            onClick={refreshYoutubeTitles}
            disabled={refreshingTitles}
            title="Fix YouTube rows whose title is 'Video <id>'"
            style={{
              fontSize: '12px',
              padding: '6px 12px',
              background: '#1a1a1a',
              color: refreshingTitles ? '#555555' : '#ffffff',
              border: '1px solid #333333',
              borderRadius: '4px',
              cursor: refreshingTitles ? 'wait' : 'pointer',
            }}
          >
            {refreshingTitles ? 'Refreshing...' : 'Refresh YouTube titles'}
          </button>
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

      {testOpen && (
        <div
          style={{
            marginBottom: '16px',
            padding: '16px',
            background: '#0a0a0a',
            border: '1px solid #1a1a1a',
            borderRadius: '6px',
          }}
        >
          <p style={{ fontSize: '11px', color: '#888888', marginBottom: '8px', margin: 0 }}>
            Type a student question. See which KB chunks Elijah&apos;s retrieval would pull (top 10, unfiltered).
          </p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runTestQuery()}
              placeholder="e.g. how do I stay confident after a bad game?"
              style={{
                flex: 1,
                fontSize: '13px',
                padding: '8px 12px',
                background: '#0a0a0a',
                color: '#ffffff',
                border: '1px solid #333333',
                borderRadius: '4px',
              }}
            />
            <button
              onClick={runTestQuery}
              disabled={testRunning || !testQuery.trim()}
              style={{
                fontSize: '12px',
                padding: '8px 16px',
                background: '#ffffff',
                color: '#000000',
                border: 'none',
                borderRadius: '4px',
                cursor: testRunning ? 'wait' : 'pointer',
                opacity: !testQuery.trim() ? 0.3 : 1,
              }}
            >
              {testRunning ? 'Searching...' : 'Search'}
            </button>
          </div>

          {testResults && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '11px', color: '#888888', marginBottom: '8px' }}>
                {testResults.filter((r) => r.wouldUse).length} / {testResults.length} would be cited
                (min score: {testMinScore})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {testResults.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: '10px 12px',
                      background: r.wouldUse ? '#0a1a0a' : '#0a0a0a',
                      border: `1px solid ${r.wouldUse ? '#1a3a1a' : '#1a1a1a'}`,
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500 }}>
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: '#ffffff', textDecoration: 'none' }}>
                            {r.title}
                          </a>
                        ) : (
                          r.title
                        )}
                      </span>
                      <span style={{ color: r.wouldUse ? '#4ade80' : '#888888', fontFamily: 'monospace' }}>
                        {r.score.toFixed(3)}
                      </span>
                    </div>
                    <div style={{ color: '#666666', fontSize: '10px', marginBottom: '6px' }}>
                      {r.type}
                      {r.topic ? ` · ${r.topic}` : ''}
                      {r.level ? ` · ${r.level}` : ''}
                    </div>
                    <div style={{ color: '#aaaaaa', fontSize: '11px', lineHeight: '1.5' }}>
                      {r.text}
                      {r.text.length >= 300 ? '…' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <TabChip label={`All (${rows.length})`} active={tab === 'all'} onClick={() => setTab('all')} />
        {typeList.map(([type, count]) => (
          <TabChip
            key={type}
            label={`${type} (${count})`}
            active={tab === type}
            onClick={() => setTab(type)}
          />
        ))}
      </div>

      <input
        type="text"
        placeholder="Search titles..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          fontSize: '13px',
          padding: '8px 12px',
          background: '#0a0a0a',
          color: '#ffffff',
          border: '1px solid #1a1a1a',
          borderRadius: '4px',
          marginBottom: '16px',
        }}
      />

      {loading && <div style={{ color: '#555555', fontSize: '13px' }}>Loading...</div>}
      {error && <div style={{ color: '#ff6666', fontSize: '13px' }}>Error: {error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ color: '#555555', fontSize: '13px', padding: '24px 0' }}>
          No sources match this filter.
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ border: '1px solid #1a1a1a', borderRadius: '6px', overflow: 'hidden' }}>
          {filtered.map((s, i) => {
            const thumb = thumbnailFor(s)
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
                {thumb ? (
                  <a
                    href={s.source_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flexShrink: 0,
                      width: '120px',
                      height: '68px',
                      background: `url(${thumb}) center/cover`,
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
                    {s.published_at
                      ? `Published ${formatDate(s.published_at)}`
                      : `Ingested ${formatDate(s.created_at)}`}
                    {' · '}
                    {s.chunk_count} chunk{s.chunk_count === 1 ? '' : 's'}
                  </div>
                </div>

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
        textTransform: 'lowercase',
      }}
    >
      {label}
    </button>
  )
}
