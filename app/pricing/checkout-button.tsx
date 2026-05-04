'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { getLocal, setLocal } from '@/lib/safe-storage'

export type CheckoutPlan =
  | 'locker_monthly'
  | 'locker_annual'
  | 'inner_circle_monthly'
  | 'inner_circle_annual'
  | 'priority'
  | 'gift_card_annual'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_KEYS = ['ask_elijah_email', 'ask-elijah-email', 'playerEmail']

function storedEmail(email?: string) {
  if (email && EMAIL_RE.test(email.trim())) return email.trim().toLowerCase()

  for (const key of EMAIL_KEYS) {
    const value = getLocal(key)
    if (value && EMAIL_RE.test(value.trim())) return value.trim().toLowerCase()
  }

  return ''
}

export default function CheckoutButton({
  plan,
  children,
  className,
  disabled = false,
  isFoundingMember = false,
  email,
}: {
  plan: CheckoutPlan
  children: ReactNode
  className?: string
  disabled?: boolean
  isFoundingMember?: boolean
  email?: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setError('')

    let checkoutEmail = storedEmail(email)
    if (!checkoutEmail) {
      const entered = window.prompt('What email should Elijah use for your locker room?')?.trim().toLowerCase()
      if (!entered || !EMAIL_RE.test(entered)) {
        setError('Enter a real email so Stripe can connect this to your locker room.')
        return
      }

      checkoutEmail = entered
      setLocal('ask_elijah_email', checkoutEmail)
    }

    setLoading(true)

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: checkoutEmail, plan, isFoundingMember }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Could not start checkout.')
      }

      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.')
      setLoading(false)
    }
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={disabled || loading} className={className}>
        {loading ? 'Opening checkout...' : children}
      </button>
      {error ? <p className="mt-2 text-xs font-bold text-red-400">{error}</p> : null}
    </div>
  )
}
