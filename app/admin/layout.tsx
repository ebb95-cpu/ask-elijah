import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value

  if (adminToken !== process.env.ADMIN_PASSWORD) {
    redirect('/admin/login')
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
