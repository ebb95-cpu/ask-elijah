'use client'

import Link from 'next/link'
import ThreeDots from '@/components/ui/ThreeDots'

interface NavProps {
  dark?: boolean
  loggedIn?: boolean
  firstName?: string
}

export default function Nav({ dark = false, loggedIn = false, firstName }: NavProps) {
  const textClass = dark ? 'text-white' : 'text-black'
  const mutedClass = dark ? 'text-gray-400' : 'text-gray-500'
  const borderClass = dark ? 'border-white' : 'border-black'

  return (
    <nav className={`flex items-center justify-between px-6 py-5 ${dark ? 'bg-black' : 'bg-white'}`}>
      <Link href={loggedIn ? '/track' : '/'} className={textClass}>
        <ThreeDots size={4} color={dark ? '#fff' : '#000'} />
      </Link>

      <div className="flex items-center gap-6">
        {loggedIn ? (
          <>
            <Link href="/library" className={`hidden md:block text-sm ${mutedClass} hover:${textClass} transition-colors`}>Library</Link>
            <Link href="/browse" className={`hidden md:block text-sm ${mutedClass} hover:${textClass} transition-colors`}>Browse</Link>
            <Link href="/ask-directly" className={`hidden md:block text-sm ${mutedClass} hover:${textClass} transition-colors`}>Ask Directly</Link>
            <Link href="/track" className={`text-sm font-semibold ${textClass}`}>{firstName || 'Locker room'}</Link>
          </>
        ) : (
          <>
            <Link href="/sign-in" className={`text-sm ${mutedClass} hover:${textClass} transition-colors`}>Sign in</Link>
            <Link
              href="/ask"
              className={`text-sm font-semibold px-4 py-2 ${dark ? 'bg-white text-black' : 'bg-black text-white'} hover:opacity-80 transition-opacity`}
            >
              Try free
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
