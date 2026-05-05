'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export default function PushFollowupOptIn() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
    if (Notification.permission === 'default') setVisible(true)
  }, [])

  async function enable() {
    setLoading(true)
    setMessage('')
    try {
      const keyRes = await fetch('/api/push-subscriptions')
      const keyData = await keyRes.json()
      if (!keyData.publicKey) throw new Error('Push is not configured yet.')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setMessage('No problem. Email follow-ups will still work.')
        setVisible(false)
        return
      }
      const registration = await navigator.serviceWorker.register('/push-sw.js')
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      })
      const saveRes = await fetch('/api/push-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      })
      if (!saveRes.ok) throw new Error('Could not save push.')
      setMessage('Rep reminders are on.')
      setVisible(false)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not turn on push.')
    } finally {
      setLoading(false)
    }
  }

  if (!visible && !message) return null

  return (
    <div className="mb-5 rounded-2xl border border-gray-900 bg-[#050505] p-4">
      <p className="text-sm font-bold text-white">Get the 7-day rep reminder.</p>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        I will still email you, but push is faster when it is time to report back.
      </p>
      {visible && (
        <button
          type="button"
          onClick={enable}
          disabled={loading}
          className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
        >
          {loading ? 'Turning on...' : 'Turn on reminders'}
        </button>
      )}
      {message && <p className="mt-2 text-xs font-semibold text-gray-500">{message}</p>}
    </div>
  )
}
