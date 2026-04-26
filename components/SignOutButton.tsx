'use client'

import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { removeLocal, removeSession } from '@/lib/safe-storage'

type SignOutButtonProps = {
  className?: string
  label?: string
}

export default function SignOutButton({ className, label = 'Sign out' }: SignOutButtonProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => null)
    await getSupabaseClient().auth.signOut().catch(() => null)
    removeLocal('ask_elijah_email')
    removeLocal('ae_pending_profile')
    removeSession('pending_question')
    router.replace('/')
    router.refresh()
  }

  return (
    <button type="button" onClick={handleSignOut} className={className}>
      {label}
    </button>
  )
}
