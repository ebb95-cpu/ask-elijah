'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The "ADMIN" label in the top-left of every admin page is an interactive
 * dropdown. Click it to jump between the core admin surfaces.
 */

const SECTIONS: Array<{ title: string; items: Array<{ href: string; label: string }> }> = [
  {
    title: 'V1',
    items: [
      { href: '/admin/questions', label: 'Queue' },
      { href: '/admin/test-chat', label: 'Test Chat' },
      { href: '/admin/access', label: 'Players' },
      { href: '/admin/kb-sources', label: 'Knowledge' },
      { href: '/admin/launch', label: 'Launch' },
    ],
  },
  {
    title: 'Signals',
    items: [
      { href: '/admin/feedback', label: 'Health' },
      { href: '/admin/pain-research', label: 'Pain Research' },
    ],
  },
  {
    title: 'Lab',
    items: [
      { href: '/admin/brain', label: 'Elijah Brain' },
      { href: '/admin/simulate', label: 'App Preview' },
    ],
  },
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
            minWidth: 220,
            background: '#0a0a0a',
            border: '1px solid #1f1f1f',
            borderRadius: 12,
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
            padding: 6,
            zIndex: 50,
          }}
        >
          {SECTIONS.map((section, sectionIndex) => (
            <div
              key={section.title}
              style={{
                borderTop: sectionIndex === 0 ? 'none' : '1px solid #1a1a1a',
                marginTop: sectionIndex === 0 ? 0 : 6,
                paddingTop: sectionIndex === 0 ? 0 : 6,
              }}
            >
              <p
                style={{
                  color: '#555',
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  margin: '4px 10px 5px',
                  textTransform: 'uppercase',
                }}
              >
                {section.title}
              </p>
              {section.items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'block',
                    padding: '9px 12px',
                    borderRadius: 7,
                    textDecoration: 'none',
                    fontSize: 14,
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
          ))}
        </div>
      )}
    </div>
  )
}
