'use client'

import { useState } from 'react'

/**
 * Progressive-enhancement form body. The parent server component wraps this
 * in a native <form method="POST" action="/api/admin/login">, so submission
 * works even if this JS never loads.
 *
 * When JS IS loaded, we override the default submit with fetch() so we can
 * show inline error state instead of a full-page redirect on wrong password.
 * Either way the server flow is identical — same endpoint, same cookie.
 */
export default function AdminLoginForm({ initialError }: { initialError: string | null }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    // Don't intercept if the runtime can't do fetch (very old Safari). Let
    // the browser do a native form submit in that case.
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return

    e.preventDefault()
    if (!password) return
    setLoading(true)
    setError(null)

    // Read `next` from the parent form so we pass it through
    const form = (e.target as HTMLFormElement).closest('form') as HTMLFormElement | null
    const nextInput = form?.querySelector('input[name="next"]') as HTMLInputElement | null
    const next = nextInput?.value || '/admin/questions'

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ password, next }),
      })
      if (!res.ok) {
        setError('Wrong password.')
        setLoading(false)
        return
      }
      // Hard navigation so middleware re-reads the fresh cookie
      window.location.href = next
    } catch {
      setError('Could not reach the server.')
      setLoading(false)
    }
  }

  // Attach submit handler to parent form via event delegation trick
  // (we can't put it on the form element directly because this is inside it
  // and we don't want to restructure the page component).
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const fakeForm = (e.target as HTMLInputElement).closest('form')
      if (fakeForm) {
        handleSubmit({
          preventDefault: () => {},
          target: fakeForm,
        } as unknown as React.FormEvent<HTMLFormElement>)
      }
    }
  }

  return (
    <>
      <input
        type="password"
        name="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={onInputKeyDown}
        placeholder="Admin password"
        autoFocus
        autoComplete="current-password"
        required
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid #333',
          color: '#fff',
          fontSize: 18,
          padding: '12px 0',
          outline: 'none',
          marginBottom: 28,
          boxSizing: 'border-box',
        }}
      />

      {error && (
        <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        onClick={(e) => {
          // If this was triggered by a click and JS is alive, use fetch path.
          // We do this at click-time instead of onSubmit so that the native
          // form still posts if JS dies before click.
          const form = (e.currentTarget as HTMLButtonElement).closest('form')
          if (form && typeof window !== 'undefined' && typeof window.fetch === 'function') {
            handleSubmit({
              preventDefault: () => {},
              target: form,
            } as unknown as React.FormEvent<HTMLFormElement>)
            e.preventDefault()
          }
        }}
        disabled={!password || loading}
        style={{
          width: '100%',
          background: '#fff',
          color: '#000',
          border: 'none',
          padding: '16px 0',
          fontSize: 15,
          fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer',
          opacity: !password || loading ? 0.4 : 1,
          minHeight: 48,
        }}
      >
        {loading ? 'Signing in...' : 'Sign in →'}
      </button>

      <p style={{ color: '#333', fontSize: 10, marginTop: 24, lineHeight: 1.5, textAlign: 'center' }}>
        Works without JavaScript. If this page is cached from an old build,
        submit will still log you in.
      </p>
    </>
  )
}
