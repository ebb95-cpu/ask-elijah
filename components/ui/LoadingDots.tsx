'use client'

import ThreeDots from './ThreeDots'

interface LoadingDotsProps {
  label?: string
  size?: number
  className?: string
  color?: string
}

export default function LoadingDots({
  label = 'Loading',
  size = 3,
  className = '',
  color,
}: LoadingDotsProps) {
  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center justify-center gap-2 ${className}`}
    >
      <ThreeDots size={size} animate color={color} />
      {label && <span>{label}</span>}
    </span>
  )
}
