import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
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
