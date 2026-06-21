'use client'

import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { cn } from './cn'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  stagger = 0.05,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  stagger?: number
}) {
  const container = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!container.current) return

    const elements = container.current.children

    gsap.fromTo(
      elements,
      { opacity: 0, y: 40, scale: 0.98 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 1,
        ease: 'power4.out',
        stagger,
        delay,
        scrollTrigger: {
          trigger: container.current,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        },
      }
    )
  }, { scope: container })

  return (
    <div ref={container} className={cn('relative', className)}>
      {children}
    </div>
  )
}
