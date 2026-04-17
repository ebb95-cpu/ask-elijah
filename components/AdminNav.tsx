'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The "ADMIN" label in the top-left of every admin page is an interactive
 * dropdown. Click it to see all admin screens and a "Switch to student view"
 * option that takes you to the simulator (sign-in page → full student flow
 * in an iframe with back-to-admin always visible).
 *
 * Kept as a separate client component so the admin layout can stay a
 * server component and keep its cookie-based auth gating logic.
 */

type LinkGroup = {
  label: string
  items: Array<{ href: string; label: string; external?: boolean; primary?: boolean }>
}

const GROUPS: LinkGroup[] = [
  {
    label: 'Admin',
    items: [
      { href: '/admin/questions', label: 'Question Queue' },
      { href: '/admin/kb-sources', label: 'Knowledge Base' },
      { href: '/admin/signals', label: 'Signals' },
    ],
  },
  {
    label: 'Student View',
    items: [
      { href: '/admin/simulate', label: 'Open Student Simulator', primary: true },
      { href: '/admin/preview', label: 'Mock Preview (dummy data)' },
    ],
  },
  {
    label: 'Open live (new tab)',
    items: [
      { href: '/', label: 'Home', external: true },
      { href: '/ask', label: 'Ask', external: true },
      { href: '/browse', label: 'Browse', external: true },
      { href: '/history', label: 'History', external: true },
      { href: '/library', label: 'Library', external: true },
      { href: '/profile', label: 'Profile', external: true },
      { href: '/pricing', label: 'Pricing', external: true },
    ],
  },
]

export default function AdminNav() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on click outside + Escape so it feels like a real menu.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: open ? '#ffffff' : '#888888',
          background: 'transparent',
          border: 'none',
          padding: '4px 8px',
          cursor: 'pointer',
          fontFamily: '-apple-system, sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Admin
        <span style={{ fontSize: 9, opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}>▼</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 240,
            background: '#0a0a0a',
            border: '1px solid #1f1f1f',
            borderRadius: 8,
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
            padding: 6,
            zIndex: 50,
          }}
        >
          {GROUPS.map((g, gi) => (
            <div
              key={g.label}
              style={{
                padding: '6px 0',
                borderTop: gi === 0 ? 'none' : '1px solid #1a1a1a',
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: '#555',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '4px 10px 6px',
                }}
              >
                {g.label}
              </div>
              {g.items.map((item) => (
                <a
                  key={item.href + item.label}
                  href={item.href}
                  target={item.external ? '_blank' : '_self'}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 4,
                    textDecoration: 'none',
                    fontSize: 13,
                    color: item.primary ? '#ffffff' : '#cccccc',
                    background: item.primary ? '#1a1a1a' : 'transparent',
                    fontWeight: item.primary ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLAnchorElement).style.background = '#1a1a1a'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLAnchorElement).style.background = item.primary ? '#1a1a1a' : 'transparent'
                  }}
                >
                  <span>{item.label}</span>
                  {item.external && <span style={{ fontSize: 10, color: '#555' }}>↗</span>}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
