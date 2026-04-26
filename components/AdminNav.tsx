'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The "ADMIN" label in the top-left of every admin page is an interactive
 * dropdown. Click it to jump between the three surfaces that matter:
 * Question Queue, Knowledge Base, and the Student Simulator.
 */

const ITEMS: Array<{ href: string; label: string }> = [
  { href: '/admin/questions', label: 'Question Queue' },
  { href: '/admin/access', label: 'Access List' },
  { href: '/admin/brain', label: 'Elijah Brain' },
  { href: '/admin/launch', label: 'Launch Readiness' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/kb-sources', label: 'Knowledge Base' },
  { href: '/admin/pain-research', label: 'Pain Research' },
  { href: '/admin/simulate', label: 'Student Simulator' },
]

export default function AdminNav() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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
        <span
          style={{
            fontSize: 9,
            opacity: 0.7,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 120ms',
          }}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 200,
            background: '#0a0a0a',
            border: '1px solid #1f1f1f',
            borderRadius: 8,
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
            padding: 4,
            zIndex: 50,
          }}
        >
          {ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                padding: '8px 12px',
                borderRadius: 4,
                textDecoration: 'none',
                fontSize: 13,
                color: '#cccccc',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLAnchorElement).style.background = '#1a1a1a'
                ;(e.currentTarget as HTMLAnchorElement).style.color = '#ffffff'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLAnchorElement).style.color = '#cccccc'
              }}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
