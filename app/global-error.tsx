'use client'

import { useEffect } from 'react'

/**
 * Catches ALL errors including those thrown during render / hydration that
 * window.addEventListener('error') misses because React swallows them in its
 * internal error boundary. This is the Next 14 App Router hook for root-level
 * errors — it receives the Error object directly and can log it before
 * rendering the fallback UI.
 *
 * Reports to /api/admin/error-report as source='global-error' so we can
 * distinguish these from the generic uncaught-error stream.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Fire-and-forget — we want this to hit the log even if it rejects.
    try {
      fetch('/api/admin/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true, // survive page unload
        body: JSON.stringify({
          message: `[global-error] ${error?.message || 'Unknown render error'}`,
          extra: JSON.stringify({
            name: error?.name,
            stack: error?.stack,
            digest: error?.digest,
          }),
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {})
    } catch {
      /* noop */
    }
  }, [error])

  return (
    <html>
      <body style={{ background: '#000', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: '40px 20px', minHeight: '100vh' }}>
        <div style={{ maxWidth: 520, margin: '80px auto', textAlign: 'center' }}>
          <p style={{ color: '#999', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
            Something broke
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, lineHeight: 1.2 }}>
            Hang on — page hit a snag.
          </h1>
          <p style={{ color: '#666', fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
            We logged the issue. Try reloading.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: '#fff',
              color: '#000',
              border: 'none',
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
