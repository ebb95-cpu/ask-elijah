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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', color: '#ffffff', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555555' }}>
          Admin
        </span>
      </div>
      {children}
    </div>
  )
}
