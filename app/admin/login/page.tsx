'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = getSupabaseClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Wrong email or password.')
      setLoading(false)
      return
    }

    router.push('/admin/questions')
  }

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#000', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, sans-serif'
    }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, padding: '0 24px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555', marginBottom: 40 }}>
          Admin
        </p>

        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          autoFocus
          required
          style={{
            width: '100%', background: 'transparent', border: 'none',
            borderBottom: '1px solid #333', color: '#fff', fontSize: 18,
            padding: '8px 0', outline: 'none', marginBottom: 24, boxSizing: 'border-box'
          }}
        />

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          required
          style={{
            width: '100%', background: 'transparent', border: 'none',
            borderBottom: '1px solid #333', color: '#fff', fontSize: 18,
            padding: '8px 0', outline: 'none', marginBottom: 36, boxSizing: 'border-box'
          }}
        />

        {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

        <button
          type="submit"
          disabled={!email || !password || loading}
          style={{
            width: '100%', background: '#fff', color: '#000', border: 'none',
            padding: '14px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            opacity: !email || !password || loading ? 0.4 : 1
          }}
        >
          {loading ? 'Signing in...' : 'Sign in →'}
        </button>
      </form>
    </div>
  )
}
