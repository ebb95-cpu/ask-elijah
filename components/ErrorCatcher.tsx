'use client'

import { useEffect } from 'react'

/**
 * Invisible component that catches unhandled JS errors and logs them
 * to /api/admin/debug as a POST. This way we can see what's crashing
 * on mobile Safari without needing the console.
 *
 * Mount once in layout.tsx.
 */
export default function ErrorCatcher() {
  useEffect(() => {
    function report(msg: string, extra?: string) {
      // Fire and forget — best effort
      fetch('/api/admin/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          extra: extra || null,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {})
    }

    function onError(e: ErrorEvent) {
      report(
        `${e.message} at ${e.filename}:${e.lineno}:${e.colno}`,
        e.error?.stack || ''
      )
    }

    function onRejection(e: PromiseRejectionEvent) {
      report(
        `Unhandled rejection: ${e.reason?.message || String(e.reason)}`,
        e.reason?.stack || ''
      )
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
