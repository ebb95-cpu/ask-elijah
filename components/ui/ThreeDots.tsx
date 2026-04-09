'use client'

interface ThreeDotsProps {
  size?: number
  animate?: boolean
  className?: string
  color?: string
}

export default function ThreeDots({ size = 4, animate = false, className = '', color }: ThreeDotsProps) {
  const r = size
  const gap = size * 5
  const lineY = r
  const totalWidth = r * 2 + gap + r * 2 + gap + r * 2
  const totalHeight = r * 2

  const fill = color || 'currentColor'
  const stroke = color || 'currentColor'

  return (
    <svg
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Left line */}
      <line
        x1={r * 2}
        y1={lineY}
        x2={r * 2 + gap}
        y2={lineY}
        stroke={stroke}
        strokeWidth="1.5"
      />
      {/* Right line */}
      <line
        x1={r * 2 + gap + r * 2}
        y1={lineY}
        x2={r * 2 + gap + r * 2 + gap}
        y2={lineY}
        stroke={stroke}
        strokeWidth="1.5"
      />
      {/* Dot 1 */}
      <circle
        cx={r}
        cy={r}
        r={r}
        fill={fill}
        className={animate ? 'dot-1' : ''}
      />
      {/* Dot 2 */}
      <circle
        cx={r * 2 + gap + r}
        cy={r}
        r={r}
        fill={fill}
        className={animate ? 'dot-2' : ''}
      />
      {/* Dot 3 */}
      <circle
        cx={r * 2 + gap + r * 2 + gap + r}
        cy={r}
        r={r}
        fill={fill}
        className={animate ? 'dot-3' : ''}
      />
    </svg>
  )
}
