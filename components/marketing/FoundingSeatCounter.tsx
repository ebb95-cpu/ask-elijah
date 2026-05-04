'use client'

import { useEffect, useState } from 'react'

type Props = {
  fallbackLeft?: number | null
  fallbackLimit?: number
  className?: string
  mode?: 'left' | 'fraction'
}

export default function FoundingSeatCounter({
  fallbackLeft = null,
  fallbackLimit = 200,
  className = '',
  mode = 'left',
}: Props) {
  const [left, setLeft] = useState<number | null>(fallbackLeft)
  const [limit, setLimit] = useState(fallbackLimit)

  useEffect(() => {
    fetch('/api/founding-seats')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.left === 'number') setLeft(data.left)
        if (typeof data.limit === 'number') setLimit(data.limit)
      })
      .catch(() => {})
  }, [])

  const label = left === null
    ? `Only ${limit} seats`
    : mode === 'fraction'
      ? `${left} / ${limit} SEATS LEFT`
      : `${left} SEATS LEFT`

  return <span className={className}>{label}</span>
}
