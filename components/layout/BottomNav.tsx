'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/home', label: 'Home' },
  { href: '/library', label: 'Library' },
  { href: '/browse', label: 'Browse' },
  { href: '/ask-directly', label: 'Ask Directly' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex md:hidden z-40">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-3 text-xs font-semibold tracking-tight transition-colors ${
              active ? 'text-black' : 'text-gray-400'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
