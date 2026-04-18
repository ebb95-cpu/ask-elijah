'use client'

import { useEffect, useState } from 'react'
import { simFetch } from '@/lib/simulator'
import { getLocal } from '@/lib/safe-storage'

/**
 * Floating "Something broken?" button, bottom-right of every student
 * page. One click → tiny modal with a textarea + auto-captured page URL
 * and user agent. Every submission emails Elijah immediately and lands
 * in the admin dashboard.
 *
 * Auto-hides inside the admin surface (admin has its own reporting) and
 * inside the student simulator iframe (bug reports from fake users
 * would pollute the real inbox).
 */

export default function BugReportButton() {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [hideSelf, setHideSelf] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Don't render inside admin pages or inside the simulator iframe.
    if (typeof window === 'undefined') return
    const path = window.location.pathname
    if (path.startsWith('/admin')) setHideSelf(true)
    try {
      if (window.self !== window.top) {
        const parentPath = window.parent.location.pathname
        if (parentPath.startsWith('/admin/simulate')) setHideSelf(true)
      }
    } catch {
      /* cross-origin — keep showing */
    }
  }, [])

  const submit = async () => {
    if (sending || !message.trim()) return
    setSending(true)
    try {
      await simFetch(
        '/api/bug-report',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: getLocal('ask_elijah_email') || null,
            page_url: typeof window !== 'undefined' ? window.location.href : null,
            message: message.trim(),
          }),
        },
        { ok: true }
      )
      setSent(true)
      setMessage('')
      setTimeout(() => {
        setOpen(false)
        setSent(false)
      }, 2000)
    } catch {
      /* swallow */
    } finally {
      setSending(false)
    }
  }

  if (!mounted || hideSelf) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Report a problem"
        title="Something broken? Tell Elijah."
        style={launcherStyle}
      >
        ⚠
      </button>

      {open && (
        <div style={backdropStyle} onClick={() => !sending && setOpen(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, margin: 0, color: '#fff' }}>Something broken?</h2>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: '#666', fontSize: 18, cursor: 'pointer', padding: 4 }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {sent ? (
              <div style={{ fontSize: 13, color: '#34d399', padding: '12px 0' }}>
                Got it — Elijah will take a look.
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: '#888', margin: '0 0 10px 0' }}>
                  What happened? The page URL and your browser info get included automatically.
                </p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="The button doesn't do anything when I tap it..."
                  rows={4}
                  autoFocus
                  style={{
                    width: '100%',
                    background: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: 4,
                    padding: 10,
                    fontSize: 13,
                    color: '#fff',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: '-apple-system, sans-serif',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setOpen(false)}
                    style={{
                      fontSize: 12,
                      padding: '6px 12px',
                      background: 'transparent',
                      color: '#888',
                      border: '1px solid #333',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={sending || message.trim().length < 3}
                    style={{
                      fontSize: 12,
                      padding: '6px 14px',
                      background: '#fff',
                      color: '#000',
                      border: 'none',
                      borderRadius: 4,
                      cursor: sending ? 'wait' : 'pointer',
                      fontWeight: 600,
                      opacity: message.trim().length < 3 ? 0.5 : 1,
                    }}
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const launcherStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  width: 40,
  height: 40,
  borderRadius: 999,
  background: '#1a1a1a',
  border: '1px solid #333',
  color: '#888',
  fontSize: 16,
  cursor: 'pointer',
  zIndex: 45,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  padding: 0,
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.65)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 60,
  padding: 16,
}

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  background: '#111',
  border: '1px solid #222',
  borderRadius: 8,
  padding: 18,
  boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
  fontFamily: '-apple-system, sans-serif',
}
