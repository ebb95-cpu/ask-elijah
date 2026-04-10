'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TestPage() {
  const router = useRouter()

  useEffect(() => {
    // Skip profile modal and email gate for clean testing
    localStorage.setItem('profile_done', '1')
    localStorage.setItem('question_count', '0')
    sessionStorage.removeItem('user_email')
    sessionStorage.setItem('test_mode', '1')
    router.replace('/test/ask')
  }, [router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-gray-600 text-sm">Loading test mode...</p>
    </div>
  )
}
