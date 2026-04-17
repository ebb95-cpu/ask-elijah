'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

/**
 * Student-view simulator.
 *
 * Renders the real student site inside one or two device frames so the admin
 * can preview phone and desktop UX without leaving admin chrome. Each frame
 * is CSS-transform scaled to fit its slot's WIDTH and HEIGHT — no scroll,
 * no clipping, regardless of monitor size.
 *
 * Three view modes:
 *   - phone : single phone frame, fills available space
 *   - web   : single desktop frame, fills available space
 *   - both  : phone (left) + desktop (right), each scaled to its half
 */

type RouteDef = { key: string; label: string; href: string; note?: string }

const ROUTES: RouteDef[] = [
  { key: 'signin', label: 'Sign in', href: '/sign-in', note: 'What a new student lands on.' },
  { key: 'signup', label: 'Sign up', href: '/sign-up', note: 'Account creation flow.' },
  { key: 'home', label: 'Home', href: '/', note: 'Landing page.' },
  { key: 'ask', label: 'Ask', href: '/ask', note: 'Main ask-a-question screen.' },
  { key: 'browse', label: 'Browse', href: '/browse', note: 'Public Q&A gallery — ✓ Elijah badges visible here.' },
  { key: 'history', label: 'History', href: '/history', note: "Student's own question history (needs login)." },
  { key: 'library', label: 'Library', href: '/library', note: 'Saved content.' },
  { key: 'profile', label: 'Profile', href: '/profile', note: 'Account settings.' },
  { key: 'pricing', label: 'Pricing', href: '/pricing', note: 'Paywall / subscription view.' },
]

type ViewMode = 'phone' | 'web' | 'both'
const PHONE = { width: 390, height: 844 }
const WEB = { width: 1280, height: 800 }
// Browser chrome row sits above the iframe inside the device frame.
const CHROME_HEIGHT = 36

export default function AdminSimulatePage() {
  const [routeKey, setRouteKey] = useState<string>('signin')
  const [view, setView] = useState<ViewMode>('both')
  const [iframeKey, setIframeKey] = useState(0)
  const [authInfo, setAuthInfo] = useState<{ email: string | null }>({ email: null })

  const route = useMemo(() => ROUTES.find((r) => r.key === routeKey) || ROUTES[0], [routeKey])
  const src = `${route.href}?simulated=1`

  // Read the signed-in user once so the auth banner shows what state the
  // iframes will inherit.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { getSupabaseClient } = await import('@/lib/supabase-client')
        const sb = getSupabaseClient()
        const { data } = await sb.auth.getUser()
        if (!cancelled) setAuthInfo({ email: data.user?.email || null })
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [iframeKey])

  return (
    <div
      style={{
        height: 'calc(100vh - 50px)', // admin chrome top bar is ~50px
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 16px',
        boxSizing: 'border-box',
        gap: 10,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Student Simulator</h1>
        <Link href="/admin/questions" style={{ fontSize: 11, color: '#555' }}>
          ← Queue
        </Link>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: authInfo.email ? '#34d399' : '#f59e0b',
            }}
          />
          {authInfo.email ? `as ${authInfo.email}` : 'logged out'}
        </span>
      </div>

      {/* Controls — single compact row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '8px 10px',
          background: '#0a0a0a',
          border: '1px solid #1a1a1a',
          borderRadius: 6,
        }}
      >
        <Group label="View">
          {(['phone', 'web', 'both'] as ViewMode[]).map((v) => (
            <Chip key={v} active={view === v} onClick={() => setView(v)}>
              {v === 'both' ? 'Phone + Web' : v === 'phone' ? 'Phone' : 'Web'}
            </Chip>
          ))}
        </Group>

        <Group label="Screen">
          {ROUTES.map((r) => (
            <Chip
              key={r.key}
              active={route.key === r.key}
              onClick={() => {
                setRouteKey(r.key)
                setIframeKey((k) => k + 1)
              }}
            >
              {r.label}
            </Chip>
          ))}
        </Group>

        <button
          onClick={() => setIframeKey((k) => k + 1)}
          title="Reload all frames"
          style={btn}
        >
          ↻
        </button>
      </div>

      {/* Stage — fills remaining vertical space, holds one or two device frames */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          gap: 16,
          justifyContent: 'center',
          alignItems: 'stretch',
        }}
      >
        {(view === 'phone' || view === 'both') && (
          <DeviceSlot
            kind="phone"
            width={PHONE.width}
            height={PHONE.height}
            src={src}
            iframeKey={iframeKey}
            label={`Phone — ${route.label}`}
          />
        )}
        {(view === 'web' || view === 'both') && (
          <DeviceSlot
            kind="web"
            width={WEB.width}
            height={WEB.height}
            src={src}
            iframeKey={iframeKey}
            label={`Web — ${route.label}`}
          />
        )}
      </div>
    </div>
  )
}

// ── Device slot — measures its container, scales to fit width AND height ──

function DeviceSlot({
  kind,
  width,
  height,
  src,
  iframeKey,
  label,
}: {
  kind: 'phone' | 'web'
  width: number
  height: number
  src: string
  iframeKey: number
  label: string
}) {
  const slotRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [currentPath, setCurrentPath] = useState('')

  // Watch slot size so we can rescale on viewport changes.
  useEffect(() => {
    const el = slotRef.current
    if (!el) return
    const apply = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Poll iframe URL so the URL bar reflects in-frame navigation.
  useEffect(() => {
    const tick = () => {
      try {
        const href = iframeRef.current?.contentWindow?.location?.href
        if (!href || href === 'about:blank') return
        const u = new URL(href)
        setCurrentPath(u.pathname + u.search + u.hash)
      } catch {
        /* cross-origin would land here; should not happen for same-origin */
      }
    }
    tick()
    const id = setInterval(tick, 300)
    return () => clearInterval(id)
  }, [iframeKey])

  // Scale = min(widthFit, heightFit) so the frame fits inside the slot
  // both horizontally and vertically. Capped at 1 — never upscale.
  const padding = kind === 'phone' ? 14 : 10
  const frameW = width + padding * 2
  const frameH = height + CHROME_HEIGHT + padding * 2
  const scale =
    size.w > 0 && size.h > 0 ? Math.min(1, size.w / frameW, size.h / frameH) : 0

  const goBack = useCallback(() => {
    try { iframeRef.current?.contentWindow?.history.back() } catch { /* */ }
  }, [])
  const goForward = useCallback(() => {
    try { iframeRef.current?.contentWindow?.history.forward() } catch { /* */ }
  }, [])
  const reload = useCallback(() => {
    try { iframeRef.current?.contentWindow?.location.reload() } catch { /* */ }
  }, [])

  return (
    <div
      ref={slotRef}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: frameW,
            height: frameH,
            padding,
            background: '#111',
            border: '1px solid #222',
            borderRadius: kind === 'phone' ? 36 : 12,
            boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
            transform: `scale(${scale || 0.01})`,
            transformOrigin: 'top center',
            flexShrink: 0,
            visibility: scale > 0 ? 'visible' : 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              borderRadius: kind === 'phone' ? 24 : 6,
              background: '#000',
              overflow: 'hidden',
              border: '1px solid #1a1a1a',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px',
                background: '#0d0d0d',
                borderBottom: '1px solid #1a1a1a',
                flexShrink: 0,
              }}
            >
              <button onClick={goBack} title="Back" style={chromeBtn}>◀</button>
              <button onClick={goForward} title="Forward" style={chromeBtn}>▶</button>
              <button onClick={reload} title="Reload" style={chromeBtn}>↻</button>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: '#1a1a1a',
                  color: '#aaa',
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  border: '1px solid #222',
                }}
                title={currentPath || src}
              >
                {currentPath || src}
              </div>
            </div>
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={src}
              title={label}
              style={{
                flex: 1,
                width: '100%',
                border: 'none',
                background: '#000',
                display: 'block',
              }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── UI primitives ───────────────────────────────────────────────────────────

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        padding: '4px 9px',
        background: active ? '#fff' : 'transparent',
        color: active ? '#000' : '#aaa',
        border: `1px solid ${active ? '#fff' : '#333'}`,
        borderRadius: 999,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

const btn: React.CSSProperties = {
  fontSize: 12,
  width: 28,
  height: 28,
  background: 'transparent',
  color: '#aaa',
  border: '1px solid #333',
  borderRadius: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: 'auto',
}

const chromeBtn: React.CSSProperties = {
  fontSize: 10,
  width: 22,
  height: 22,
  color: '#888',
  background: '#141414',
  border: '1px solid #222',
  borderRadius: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  flexShrink: 0,
}
