'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { getLocal, setLocal } from '@/lib/safe-storage'

export type CheckoutPlan =
  | 'locker_monthly'
  | 'locker_annual'

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
  showPromoCode = false,
}: {
  plan: CheckoutPlan
  children: ReactNode
  className?: string
  disabled?: boolean
  isFoundingMember?: boolean
  email?: string
  showPromoCode?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [promoCode, setPromoCode] = useState('')

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
        body: JSON.stringify({ email: checkoutEmail, plan, isFoundingMember, promoCode }),
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
      {showPromoCode ? (
        <label className="mb-3 block text-left text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
          Tester code
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Optional"
            className="mt-2 w-full rounded-full border border-black/15 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-black outline-none placeholder:text-gray-400 focus:border-black"
          />
        </label>
      ) : null}
      <button type="button" onClick={handleClick} disabled={disabled || loading} className={className}>
        {loading ? 'Opening checkout...' : children}
      </button>
      {error ? <p className="mt-2 text-xs font-bold text-red-400">{error}</p> : null}
    </div>
  )
}
