'use client'

// Fix-pass decision: the previous version rendered <img> directly and showed nothing while the request was in flight. With 8+ Clearbit calls firing in parallel on the trending grid, that read as "logos don't load on the homepage but show up when I click in". The placeholder ToolAvatar now stays visible underneath the <img> until onLoad fires, so first paint always shows something. The fallback chain (Clearbit → Google favicon → ToolAvatar) is preserved.
import { useState } from 'react'
import { getClearbitLogoUrl, getFaviconUrl } from '@/lib/logo'
import { ToolAvatar } from '../tools/ToolAvatar'
import { cn } from './cn'

type LogoState = 'clearbit' | 'favicon' | 'avatar'

type Props = {
  name: string
  domain: string | null
  size?: number
  className?: string
  framed?: boolean
}

export function ToolLogo({ name, domain, size = 44, className, framed = false }: Props) {
  const [state, setState] = useState<LogoState>(domain ? 'clearbit' : 'avatar')
  const [loaded, setLoaded] = useState(false)

  const wrapperSize = framed ? size + 12 : size
  const frame = framed
    ? 'rounded-md border-2 border-border bg-surface p-1 shadow-[2px_2px_0px_#1A1A1A]'
    : ''

  // No domain, or both remote attempts exhausted → just the monogram
  if (!domain || state === 'avatar') {
    return (
      <div
        className={cn('shrink-0', frame, className)}
        style={{ width: wrapperSize, height: wrapperSize }}
      >
        <ToolAvatar name={name} size={size} />
      </div>
    )
  }

  const src = state === 'clearbit' ? getClearbitLogoUrl(domain) : getFaviconUrl(domain)

  return (
    <div
      className={cn(
        'shrink-0 relative flex items-center justify-center bg-surface',
        frame,
        className,
      )}
      style={{ width: wrapperSize, height: wrapperSize }}
    >
      {/* Monogram sits behind the img — visible the moment the component mounts,
          hidden only once the real logo actually paints. */}
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 flex items-center justify-center transition-opacity duration-base',
          loaded ? 'opacity-0' : 'opacity-100',
        )}
        style={{ padding: framed ? 4 : 0 }}
      >
        <ToolAvatar name={name} size={size} />
      </div>
      <img
        // key forces a fresh <img> when src changes so onLoad fires for each new attempt
        key={src}
        src={src}
        alt={`${name} logo`}
        width={size}
        height={size}
        loading="eager"
        decoding="async"
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 200ms ease-out',
          position: 'relative',
          zIndex: 1,
        }}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false)
          if (state === 'clearbit') setState('favicon')
          else setState('avatar')
        }}
      />
    </div>
  )
}
