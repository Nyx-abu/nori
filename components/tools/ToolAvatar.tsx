// Phase 4 decision: deterministic SVG monogram avatar — no external image hosting, no broken <img> tags, consistent visual identity across the app.
import { cn } from '../ui/cn'

const PALETTE = [
  '#6366F1',
  '#8B5CF6',
  '#06B6D4',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#3B82F6',
  '#14B8A6',
]

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

type Props = {
  name: string
  size?: number
  className?: string
}

export function ToolAvatar({ name, size = 44, className }: Props) {
  const h = hash(name)
  const color1 = PALETTE[h % PALETTE.length] ?? '#6366F1'
  const color2 = PALETTE[(h >> 3) % PALETTE.length] ?? '#8B5CF6'
  const letters = initials(name)
  const id = `nori-avatar-${h}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      role="img"
      aria-label={`${name} logo`}
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="10" fill={`url(#${id})`} />
      <text
        x="22"
        y="27"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="16"
        fontWeight="600"
        fill="#ffffff"
        letterSpacing="-0.5"
      >
        {letters}
      </text>
    </svg>
  )
}
