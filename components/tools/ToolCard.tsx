// Phase 4 decision: ToolCard is a server component — pure markup, no state. The hover/focus effects come from CSS classes, not JS handlers.
import Link from 'next/link'
import { ToolAvatar } from './ToolAvatar'
import { Badge } from '../ui/Badge'
import { cn } from '../ui/cn'
import type { ToolResult } from '@/lib/types'

const pricingLabel: Record<ToolResult['pricing'], string> = {
  FREE: 'Free',
  FREEMIUM: 'Freemium',
  PAID: 'Paid',
  OPEN_SOURCE: 'Open source',
}

type Props = {
  tool: ToolResult
  className?: string
  compact?: boolean
}

export function ToolCard({ tool, className, compact = false }: Props) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      tabIndex={0}
      className={cn(
        'group block rounded-lg border border-border bg-surface p-5',
        'min-h-[44px]',
        'transition-all duration-base ease-enter',
        'hover:border-border-hover hover:bg-surface-2 hover:scale-[1.02]',
        'focus-visible:border-accent',
        compact ? 'p-4' : 'p-5',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <ToolAvatar name={tool.name} size={compact ? 36 : 44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-base font-semibold text-text-primary">
              {tool.name}
            </h3>
            <TrustDot value={tool.trustScore} />
          </div>
          <p className="mt-0.5 truncate text-sm text-text-secondary">
            {tool.tagline}
          </p>
        </div>
      </div>

      {!compact && (
        <p className="mt-3 line-clamp-2 text-sm text-text-secondary">
          {tool.description}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Badge tone="accent">{tool.category.name}</Badge>
        <Badge tone={tool.pricing === 'PAID' ? 'warning' : 'neutral'}>
          {pricingLabel[tool.pricing]}
        </Badge>
        {tool.isPrivacyFocused && <Badge tone="success">Private</Badge>}
        {tool.isOpenSource && <Badge tone="neutral">Open source</Badge>}
      </div>
    </Link>
  )
}

function TrustDot({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  return (
    <span
      className="flex items-center gap-1 text-2xs text-text-muted"
      aria-label={`Trust score ${pct}`}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          backgroundColor:
            value >= 0.9
              ? '#10B981'
              : value >= 0.8
                ? '#6366F1'
                : value >= 0.7
                  ? '#F59E0B'
                  : '#888',
        }}
      />
      {pct}
    </span>
  )
}
