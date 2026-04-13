'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

export default function NewAnswerNotification() {
  const [show, setShow] = useState(false)
  const knownCountRef = useRef<number | null>(null)

  const check = async () => {
    const email = localStorage.getItem('ask_elijah_email')
    if (!email) return

    try {
      const res = await fetch('/api/history')
      if (!res.ok) return
      const data = await res.json()
      const count = (data.questions || []).length

      if (knownCountRef.current === null) {
        // First load — store baseline, don't notify
        knownCountRef.current = count
        const stored = localStorage.getItem('ask_elijah_seen_count')
        if (stored && count > parseInt(stored)) {
          setShow(true)
        }
        localStorage.setItem('ask_elijah_seen_count', String(count))
      } else if (count > knownCountRef.current) {
        // New answer came in while they were on the page
        knownCountRef.current = count
        localStorage.setItem('ask_elijah_seen_count', String(count))
        setShow(true)
      }
    } catch {
      // silent fail
    }
  }

  useEffect(() => {
    // Check on mount
    check()
    // Then every 60 seconds
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [])

  if (!show) return null

  return (
    <div className="fixed bottom-20 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <Link
        href="/history"
        onClick={() => {
          setShow(false)
          localStorage.setItem('ask_elijah_seen_count', String(knownCountRef.current ?? 0))
        }}
        className="flex items-center gap-3 bg-black text-white px-4 py-3 shadow-2xl border border-gray-800 hover:opacity-90 transition-opacity"
      >
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
        <span className="text-sm font-semibold">Elijah wrote back →</span>
        <button
          onClick={(e) => { e.preventDefault(); setShow(false) }}
          className="text-gray-500 hover:text-white ml-1 text-xs"
        >
          ✕
        </button>
      </Link>
    </div>
  )
}
