'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'

/**
 * Student-view simulator. Iframes the real student routes inside a phone-shaped
 * frame so the admin can see exactly what a student sees without leaving the
 * admin surface. Iframe src is same-origin, so navigation inside the frame
 * works like a normal browser session — click around as if you were a student.
 *
 * NOTE: cookies are shared with the parent, so if the admin is also signed in
 * as a regular user, the iframe will reflect that auth state. For a truly
 * logged-out preview, use the "Logged out" tab (opens in a private iframe via
 * a URL param that tells the page to ignore stored user state).
 */

type RouteDef = { key: string; label: string; href: string; note?: string }

const ROUTES: RouteDef[] = [
  { key: 'signin', label: 'Sign in', href: '/sign-in', note: 'Fake login screen — what a new student lands on' },
  { key: 'signup', label: 'Sign up', href: '/sign-up', note: 'Account creation flow' },
  { key: 'home', label: 'Home', href: '/', note: 'Landing page' },
  { key: 'ask', label: 'Ask', href: '/ask', note: 'Main ask-a-question screen' },
  { key: 'browse', label: 'Browse', href: '/browse', note: 'Public Q&A gallery — shows the ✓ Elijah badges' },
  { key: 'history', label: 'History', href: '/history', note: "Student's own question history (needs login)" },
  { key: 'library', label: 'Library', href: '/library', note: 'Saved content' },
  { key: 'profile', label: 'Profile', href: '/profile', note: 'Account settings' },
  { key: 'pricing', label: 'Pricing', href: '/pricing', note: 'Paywall / subscription view' },
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
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0) // bumping this remounts the iframe

  const route = useMemo(() => ROUTES.find((r) => r.key === routeKey) || ROUTES[0], [routeKey])

  // When the route changes we just set the src directly, but when the admin
  // hits "Reset" we force a remount so the iframe goes back to the starting
  // URL even if they've navigated deeper inside it.
  const src = `${route.href}?simulated=1`

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Student Simulator</h1>
        <Link href="/admin/questions" style={{ fontSize: 12, color: '#555' }}>
          ← Back to queue
        </Link>
        <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>
          Same-origin iframe. Click around inside the frame like a real student.
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
        {/* Route picker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Screen
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 700 }}>
            {ROUTES.map((r) => (
              <button
                key={r.key}
                onClick={() => {
                  setRouteKey(r.key)
                  setIframeKey((k) => k + 1)
                }}
                style={{
                  fontSize: 11,
                  padding: '5px 10px',
                  background: route.key === r.key ? '#ffffff' : 'transparent',
                  color: route.key === r.key ? '#000000' : '#aaaaaa',
                  border: `1px solid ${route.key === r.key ? '#ffffff' : '#333333'}`,
                  borderRadius: 999,
                  cursor: 'pointer',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Device toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Device
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {DEVICES.map((d) => (
              <button
                key={d.key}
                onClick={() => setDevice(d)}
                style={{
                  fontSize: 11,
                  padding: '5px 10px',
                  background: device.key === d.key ? '#ffffff' : 'transparent',
                  color: device.key === d.key ? '#000000' : '#aaaaaa',
                  border: `1px solid ${device.key === d.key ? '#ffffff' : '#333333'}`,
                  borderRadius: 999,
                  cursor: 'pointer',
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reset + open in new tab */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Actions
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setIframeKey((k) => k + 1)}
              style={{
                fontSize: 11,
                padding: '5px 10px',
                background: 'transparent',
                color: '#aaaaaa',
                border: '1px solid #333333',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              ↻ Reset
            </button>
            <a
              href={route.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 11,
                padding: '5px 10px',
                background: 'transparent',
                color: '#aaaaaa',
                border: '1px solid #333333',
                borderRadius: 4,
                textDecoration: 'none',
              }}
            >
              Open in new tab ↗
            </a>
          </div>
        </div>
      </div>

      {/* Route context note */}
      {route.note && (
        <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px 0' }}>
          <strong style={{ color: '#bbb' }}>{route.label}:</strong> {route.note}
        </p>
      )}

      {/* Device frame */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            width: device.width,
            maxWidth: '100%',
            padding: device.key === 'phone' ? 14 : 10,
            background: '#111111',
            border: '1px solid #222',
            borderRadius: device.key === 'phone' ? 36 : 12,
            boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          }}
        >
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={src}
            title={`Student view — ${route.label}`}
            style={{
              width: '100%',
              height: device.height,
              border: 'none',
              borderRadius: device.key === 'phone' ? 24 : 6,
              background: '#000',
              display: 'block',
            }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      </div>

      {/* Footer disclaimer */}
      <p style={{ fontSize: 11, color: '#555', marginTop: 16, textAlign: 'center' }}>
        You share cookies with the iframe. If you&apos;re signed in as a regular user in this browser,
        the iframe will show that logged-in state. For a truly-logged-out preview, use an incognito window.
      </p>
    </div>
  )
}
