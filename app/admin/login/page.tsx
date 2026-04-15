'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AdminLoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  // Where to send the admin after successful login
  const next = searchParams.get('next') || '/admin/questions'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        setError('Wrong password.')
        setLoading(false)
        return
      }

      // Hard-navigate so the server re-evaluates the admin layout with the
      // fresh cookie. router.push works but some mobile Safari builds cache
      // the redirect decision — location.href forces a clean round-trip.
      window.location.href = next
    } catch {
      setError('Could not reach the server. Check your connection.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, sans-serif',
        padding: '24px',
      }}
    >
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#555',
            marginBottom: 40,
          }}
        >
          Admin
        </p>

        {/* One field — no email; the single shared admin password is what gates
            access. Cleaner on mobile and matches the API the app actually uses. */}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
            // 16px prevents iOS Safari's auto-zoom on focus
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
            // 48px touch target for mobile
            minHeight: 48,
          }}
        >
          {loading ? 'Signing in...' : 'Sign in →'}
        </button>
      </form>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#000' }} />}>
      <AdminLoginForm />
    </Suspense>
  )
}
