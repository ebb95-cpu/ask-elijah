'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Fixed bottom tab bar for student pages — always visible on mobile, hidden
 * on desktop (md+). This is the persistent external trigger infrastructure:
 * no matter where the student is in the app, the four core loops are one
 * thumb-tap away.
 *
 * Mount it at the bottom of any student page. Pages that use this MUST add
 * bottom padding (pb-20 + safe-area) so content doesn't render under the bar.
 */
const TABS: { href: string; label: string; icon: React.ReactNode }[] = [
  {
    href: '/ask',
    label: 'Ask',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/library',
    label: 'Library',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    href: '/browse',
    label: 'Browse',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Me',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

// Paths where the bottom nav should NOT render.
// - /admin, /sign-in, /sign-up, /auth, /approve are admin/auth surfaces
// - /ask is a compose surface with its own sticky action bar; stacking a
//   tab bar underneath is noise and steals keyboard real estate
// - / and marketing pages have their own chrome
const HIDDEN_PREFIXES = ['/admin', '/sign-in', '/sign-up', '/auth', '/approve', '/ask']
const HIDDEN_EXACT = ['/', '/waitlist-confirmed', '/pricing', '/privacy']

export default function MobileBottomNav() {
  const pathname = usePathname() || ''

  const shouldHide =
    HIDDEN_EXACT.includes(pathname) ||
    HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))
  if (shouldHide) return null

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur border-t border-gray-900 flex pb-safe"
      style={{ WebkitBackdropFilter: 'blur(8px)' }}
    >
      {TABS.map((tab) => {
        const active =
          pathname === tab.href ||
          (tab.href !== '/' && pathname.startsWith(tab.href + '/'))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5"
            style={{ minHeight: 56 }}
            aria-current={active ? 'page' : undefined}
          >
            <span className={active ? 'text-white' : 'text-gray-600'}>{tab.icon}</span>
            <span className={`text-[10px] tracking-wide ${active ? 'text-white font-semibold' : 'text-gray-600'}`}>
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
