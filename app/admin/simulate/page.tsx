'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

/**
 * Student-view simulator. Iframes the real student routes inside a
 * phone/tablet/desktop frame with simulated browser chrome (URL bar,
 * back/forward/reload). Navigation inside the iframe stays inside the
 * iframe — the outer page shows where the student currently is via a
 * polled readback of iframe.contentWindow.location (safe because the
 * iframe is same-origin).
 *
 * NOTE on auth: cookies are shared with the parent admin session. The
 * banner at the top tells you exactly what auth state the student sees.
 * For a clean "new user" preview, open /admin/simulate in an incognito
 * window — same page, no stored auth.
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

type Device = { key: 'phone' | 'tablet' | 'desktop'; label: string; width: number; height: number }
const DEVICES: Device[] = [
  { key: 'phone', label: 'Phone', width: 390, height: 844 },
  { key: 'tablet', label: 'Tablet', width: 768, height: 1024 },
  { key: 'desktop', label: 'Desktop', width: 1280, height: 800 },
]

export default function AdminSimulatePage() {
  const [routeKey, setRouteKey] = useState<string>('signin')
  const [device, setDevice] = useState<Device>(DEVICES[0])
  const [landscape, setLandscape] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0) // bumping remounts the iframe
  // Container width that the device frame must fit inside. Drives the scale
  // factor so the chosen device size never overflows the viewport.
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageWidth, setStageWidth] = useState(0)
  // Current URL inside the iframe (read via same-origin contentWindow polling).
  const [currentUrl, setCurrentUrl] = useState<string>('')
  // Supabase auth + stored email — tells the admin what state the student sees.
  const [authInfo, setAuthInfo] = useState<{ email: string | null; hasStoredEmail: boolean }>({
    email: null,
    hasStoredEmail: false,
  })

  const route = useMemo(() => ROUTES.find((r) => r.key === routeKey) || ROUTES[0], [routeKey])

  // Phone in landscape swaps dimensions. Other devices ignore landscape toggle.
  const dims = useMemo(() => {
    if (device.key === 'phone' && landscape) return { width: device.height, height: device.width }
    return { width: device.width, height: device.height }
  }, [device, landscape])

  // Track the available stage width so we can compute a scale factor that
  // keeps the device frame inside the viewport without clipping.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const apply = () => setStageWidth(el.clientWidth)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Padding around the device chrome (~28px each side for phone, ~20 otherwise)
  // plus a small safety margin so the frame border isn't flush with the edge.
  const framePadding = (device.key === 'phone' ? 14 : 10) * 2 + 8
  const scale = stageWidth > 0
    ? Math.min(1, stageWidth / (dims.width + framePadding))
    : 1
  // Reserve scaled height in layout flow so the page doesn't have a giant
  // empty gap below the shrunk frame.
  const scaledHeight = (dims.height + 36 /* browser chrome */ + framePadding) * scale

  // Poll iframe URL 3×/sec so the address bar reflects in-frame navigation.
  useEffect(() => {
    const tick = () => {
      try {
        const frame = iframeRef.current
        if (!frame) return
        const href = frame.contentWindow?.location?.href
        if (href && href !== 'about:blank') setCurrentUrl(href)
      } catch {
        // Cross-origin error would land here — shouldn't happen since src is same-origin.
      }
    }
    tick()
    const id = setInterval(tick, 300)
    return () => clearInterval(id)
  }, [iframeKey])

  // Read the signed-in user once so the auth banner shows who the iframe
  // will think is logged in.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { getSupabaseClient } = await import('@/lib/supabase-client')
        const sb = getSupabaseClient()
        const { data } = await sb.auth.getUser()
        const email = data.user?.email || null
        const { getLocal } = await import('@/lib/safe-storage')
        const storedEmail = getLocal('ask_elijah_email')
        if (!cancelled) setAuthInfo({ email, hasStoredEmail: Boolean(storedEmail) })
      } catch {
        /* ignore — banner just says "unknown" */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [iframeKey])

  const goBack = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.back()
    } catch {
      /* no-op */
    }
  }, [])

  const goForward = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.forward()
    } catch {
      /* no-op */
    }
  }, [])

  const reload = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.location.reload()
    } catch {
      setIframeKey((k) => k + 1)
    }
  }, [])

  const src = `${route.href}?simulated=1`

  // Strip the origin so the URL bar shows a clean path like /ask?x=1.
  const displayUrl = useMemo(() => {
    if (!currentUrl) return src
    try {
      const u = new URL(currentUrl)
      return u.pathname + u.search + u.hash
    } catch {
      return currentUrl
    }
  }, [currentUrl, src])

  const authLabel = authInfo.email
    ? `Signed in as ${authInfo.email}`
    : authInfo.hasStoredEmail
      ? 'Email remembered, no active Supabase session'
      : 'Logged out'

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Student Simulator</h1>
        <Link href="/admin/questions" style={{ fontSize: 12, color: '#555' }}>
          ← Back to queue
        </Link>
        <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>
          Click through inside the frame like a real student.
        </span>
      </div>

      {/* Auth state banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          marginBottom: 14,
          background: authInfo.email ? '#0a1f15' : '#1f1505',
          border: `1px solid ${authInfo.email ? '#1f4030' : '#3a2a10'}`,
          borderRadius: 6,
          fontSize: 12,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: authInfo.email ? '#34d399' : '#f59e0b',
            flexShrink: 0,
          }}
        />
        <span style={{ color: '#ddd' }}>
          Viewing as: <strong>{authLabel}</strong>
        </span>
        <span style={{ color: '#666', fontSize: 11, marginLeft: 'auto' }}>
          {authInfo.email
            ? 'For a clean "new user" preview, open this page in an incognito window.'
            : 'This matches what a new visitor would see.'}
        </span>
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
          padding: '12px 14px',
          background: '#0a0a0a',
          border: '1px solid #1a1a1a',
          borderRadius: 6,
        }}
      >
        <Control label="Screen">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 700 }}>
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
          </div>
        </Control>

        <Control label="Device">
          <div style={{ display: 'flex', gap: 6 }}>
            {DEVICES.map((d) => (
              <Chip key={d.key} active={device.key === d.key} onClick={() => setDevice(d)}>
                {d.label}
              </Chip>
            ))}
          </div>
        </Control>

        {device.key === 'phone' && (
          <Control label="Orientation">
            <div style={{ display: 'flex', gap: 6 }}>
              <Chip active={!landscape} onClick={() => setLandscape(false)}>
                Portrait
              </Chip>
              <Chip active={landscape} onClick={() => setLandscape(true)}>
                Landscape
              </Chip>
            </div>
          </Control>
        )}

        <Control label="Actions">
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setIframeKey((k) => k + 1)}
              title="Reset to starting URL"
              style={buttonStyle}
            >
              ↻ Reset
            </button>
            <a href={route.href} target="_blank" rel="noopener noreferrer" style={buttonStyle}>
              New tab ↗
            </a>
          </div>
        </Control>
      </div>

      {/* Route note */}
      {route.note && (
        <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px 0' }}>
          <strong style={{ color: '#bbb' }}>{route.label}:</strong> {route.note}
        </p>
      )}

      {/* Device frame with browser chrome — scaled to fit the stage so the
          chosen device dimensions never overflow horizontally. The outer
          stageRef div drives the scale calc; the inner div is the fixed-size
          frame that gets visually shrunk via CSS transform. */}
      <div
        ref={stageRef}
        style={{
          width: '100%',
          height: scaledHeight,
          display: 'flex',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: dims.width,
            padding: device.key === 'phone' ? 14 : 10,
            background: '#111',
            border: '1px solid #222',
            borderRadius: device.key === 'phone' ? 36 : 12,
            boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              borderRadius: device.key === 'phone' ? 24 : 6,
              background: '#000',
              overflow: 'hidden',
              border: '1px solid #1a1a1a',
            }}
          >
            {/* Browser chrome */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px',
                background: '#0d0d0d',
                borderBottom: '1px solid #1a1a1a',
              }}
            >
              <button onClick={goBack} title="Back" style={chromeBtnStyle}>
                ◀
              </button>
              <button onClick={goForward} title="Forward" style={chromeBtnStyle}>
                ▶
              </button>
              <button onClick={reload} title="Reload" style={chromeBtnStyle}>
                ↻
              </button>
              <div
                style={{
                  flex: 1,
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
                title={displayUrl}
              >
                {displayUrl}
              </div>
            </div>

            {/* Iframe */}
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={src}
              title={`Student view — ${route.label}`}
              style={{
                width: '100%',
                height: dims.height,
                border: 'none',
                background: '#000',
                display: 'block',
              }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#555', marginTop: 16, textAlign: 'center' }}>
        The simulator shares cookies with your admin session — the banner above tells you what auth
        state the student sees.
      </p>
    </div>
  )
}

// ── UI primitives ───────────────────────────────────────────────────────────

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      {children}
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
        padding: '5px 10px',
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

const buttonStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '5px 10px',
  background: 'transparent',
  color: '#aaa',
  border: '1px solid #333',
  borderRadius: 4,
  cursor: 'pointer',
  textDecoration: 'none',
  fontFamily: '-apple-system, sans-serif',
}

const chromeBtnStyle: React.CSSProperties = {
  fontSize: 10,
  width: 24,
  height: 24,
  color: '#888',
  background: '#141414',
  border: '1px solid #222',
  borderRadius: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}
