import { cookies } from 'next/headers'

/**
 * Auth gating for /admin/* lives in middleware.ts — that runs before any
 * layout/page and can cleanly exempt /admin/login without a redirect loop.
 * This layout just applies the admin chrome to every admin page EXCEPT
 * the login page itself (the login page renders bare).
 *
 * Note: middleware has already guaranteed the cookie is valid for any page
 * under this layout other than /admin/login; we rely on that invariant.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const hasAdmin = cookieStore.get('admin_token')?.value === process.env.ADMIN_PASSWORD

  // If there's no cookie, we're rendering /admin/login (middleware allowed
  // it through). Don't wrap it in admin chrome.
  if (!hasAdmin) {
    return <>{children}</>
  }

  const studentLinks: Array<{ href: string; label: string; internal?: boolean }> = [
    { href: '/admin/simulate', label: 'Simulator', internal: true },
    { href: '/', label: 'Home' },
    { href: '/ask', label: 'Ask' },
    { href: '/browse', label: 'Browse' },
    { href: '/history', label: 'History' },
    { href: '/library', label: 'Library' },
    { href: '/profile', label: 'Profile' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/admin/preview', label: 'Mock Preview', internal: true },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', color: '#ffffff', fontFamily: '-apple-system, sans-serif' }}>
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555555' }}>
          Admin
        </span>
        <span style={{ color: '#1a1a1a', fontSize: '11px' }}>|</span>
        <span style={{ fontSize: '10px', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          View as student
        </span>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {studentLinks.map((l) => {
            // Internal admin routes (Simulator, Mock Preview) open in the
            // same tab — they ARE admin pages. External student routes open
            // in a new tab so the admin's current work isn't interrupted.
            const isSimulator = l.href === '/admin/simulate'
            return (
              <a
                key={l.href}
                href={l.href}
                target={l.internal ? '_self' : '_blank'}
                rel={l.internal ? undefined : 'noopener noreferrer'}
                style={{
                  fontSize: '11px',
                  color: isSimulator ? '#ffffff' : '#888888',
                  textDecoration: 'none',
                  padding: '3px 8px',
                  border: isSimulator ? '1px solid #444444' : '1px solid #1a1a1a',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap',
                  fontWeight: isSimulator ? 600 : 400,
                }}
              >
                {l.label}{l.internal ? '' : ' ↗'}
              </a>
            )
          })}
        </div>
      </div>
      {children}
    </div>
  )
}
