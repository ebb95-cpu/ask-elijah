'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/admin/questions')
    } else {
      setError('Wrong password.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#000', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, sans-serif'
    }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, padding: '0 24px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555', marginBottom: 32 }}>
          Admin
        </p>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          style={{
            width: '100%', background: 'transparent', border: 'none',
            borderBottom: '1px solid #333', color: '#fff', fontSize: 20,
            padding: '8px 0', outline: 'none', marginBottom: 32, boxSizing: 'border-box'
          }}
        />
        {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}
        <button
          type="submit"
          disabled={!password || loading}
          style={{
            width: '100%', background: '#fff', color: '#000', border: 'none',
            padding: '14px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            opacity: !password || loading ? 0.4 : 1
          }}
        >
          {loading ? 'Checking...' : 'Enter →'}
        </button>
      </form>
    </div>
  )
}
