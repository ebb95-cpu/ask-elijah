'use client'

interface StreakBadgeProps {
  count: number
}

export default function StreakBadge({ count }: StreakBadgeProps) {
  if (!count) return null

  return (
    <span className="text-xs text-gray-400 tracking-wider uppercase">
      Day {count}
    </span>
  )
}
