'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin')
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (isAdmin) return
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
    if (hasInitialized.current) return

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
      session_recording: {
        maskAllInputs: true,
        maskInputOptions: { password: true },
      },
    })
    hasInitialized.current = true
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin) return
    if (!hasInitialized.current) return
    posthog.capture('$pageview', {
      $current_url: window.location.href,
    })
  }, [isAdmin, pathname])

  if (isAdmin) return <>{children}</>

  return <PHProvider client={posthog}>{children}</PHProvider>
}
