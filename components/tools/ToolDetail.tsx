'use client'

// Phase 5 decision: ToolDetail is client-side because it captures the `tool_viewed` and `tool_website_clicked` PostHog events. Data is passed in from a server component, so no client-side fetch.
import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'
import { motion } from 'framer-motion'
import { ToolLogo } from '../ui/ToolLogo'
import { Badge } from '../ui/Badge'
import type { ToolResult } from '@/lib/types'

const pricingLabel: Record<ToolResult['pricing'], string> = {
  FREE: 'Free',
  FREEMIUM: 'Freemium',
  PAID: 'Paid',
  OPEN_SOURCE: 'Open source',
}

export function ToolDetail({ tool }: { tool: ToolResult }) {
  const posthog = usePostHog()

  useEffect(() => {
    if (!posthog) return
    posthog.capture('tool_viewed', {
      tool_slug: tool.slug,
      tool_name: tool.name,
    })
  }, [posthog, tool.slug, tool.name])

  const onVisit = () => {
    posthog?.capture('tool_website_clicked', {
      tool_slug: tool.slug,
      tool_name: tool.name,
    })
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-3xl px-4 py-12 sm:px-6"
    >
      <header className="flex items-start gap-3 sm:gap-4">
        <ToolLogo name={tool.name} domain={tool.domain} size={56} framed />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
            {tool.name}
          </h1>
          <p className="mt-1 text-sm text-text-secondary sm:text-base">{tool.tagline}</p>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-1.5">
        <Badge tone="accent">{tool.category.name}</Badge>
        <Badge tone={tool.pricing === 'PAID' ? 'warning' : 'neutral'}>
          {pricingLabel[tool.pricing]}
        </Badge>
        {tool.isPrivacyFocused && <Badge tone="success">Privacy-focused</Badge>}
        {tool.isOpenSource && tool.pricing !== 'OPEN_SOURCE' && <Badge tone="neutral">Open source</Badge>}
        {tool.tags.map((t) => (
          <Badge key={t.id} tone="neutral">
            {t.name}
          </Badge>
        ))}
      </div>

      <section className="mt-8 leading-relaxed">
        <p className="text-base text-text-primary">{tool.description}</p>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Block label="Platforms">
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tool.platforms.map((p) => (
              <Badge key={p} tone="neutral">
                {p}
              </Badge>
            ))}
          </div>
        </Block>
        <Block label="Trust score">
          <p className="mt-2 text-2xl font-semibold text-text-primary">
            {Math.round(tool.trustScore * 100)}
            <span className="ml-1 text-sm font-normal text-text-muted">
              / 100
            </span>
          </p>
        </Block>
      </section>

      <div className="mt-10">
        <a
          href={tool.website}
          onClick={onVisit}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 min-w-[44px] items-center justify-center gap-2 rounded-md border-2 border-border bg-accent px-6 text-sm font-extrabold text-surface shadow-[4px_4px_0px_#1A1A1A] transition-all duration-fast ease-enter hover:bg-accent-glow hover:text-text-primary hover:-translate-y-1 hover:shadow-[6px_6px_0px_#1A1A1A] active:translate-y-0 active:shadow-[2px_2px_0px_#1A1A1A]"
        >
          visit {tool.name}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </a>
      </div>
    </motion.article>
  )
}

function Block({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border-2 border-border bg-surface p-4 shadow-[4px_4px_0px_#1A1A1A] font-bold">
      <p className="text-2xs uppercase tracking-widest text-text-muted">
        {label}
      </p>
      {children}
    </div>
  )
}
