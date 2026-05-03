import { Suspense } from 'react'
import AdminLoginForm from './form'

// Server-rendered shell. Important that it emits `Cache-Control: no-store`
// via the route segment config below so mobile Safari cannot serve a stale
// copy of this page (which was the root cause of the login-on-mobile saga).
export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = {
  searchParams?: Promise<{ next?: string; error?: string }>
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const params = await searchParams
  const next = typeof params?.next === 'string' && params.next.startsWith('/admin')
    ? params.next
    : '/admin/questions'
  const error = params?.error === 'wrong_password' ? 'Wrong password.' : null

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
      {/* HTML form as the source of truth. Submits natively — works without
          any JS loading, so mobile Safari cache issues can't break it.
          The React form below progressively enhances this (same endpoint,
          nicer error handling), but if JS never runs this still works. */}
      <form
        method="POST"
        action="/api/admin/login"
        style={{ width: '100%', maxWidth: 360 }}
      >
        <input type="hidden" name="next" value={next} />

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

        <Suspense fallback={null}>
          <AdminLoginForm initialError={error} />
        </Suspense>
      </form>
    </div>
  )
}
