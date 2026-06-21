'use client'

import { useEffect, useRef } from 'react'

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Disable on touch devices
    if (window.matchMedia('(pointer: coarse)').matches) return

    let mouseX = 0
    let mouseY = 0
    let cursorX = 0
    let cursorY = 0

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    window.addEventListener('mousemove', onMouseMove)

    const animate = () => {
      cursorX += (mouseX - cursorX) * 0.15
      cursorY += (mouseY - cursorY) * 0.15

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`
      }

      requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return (
    <div
      ref={cursorRef}
      className="pointer-events-none fixed left-0 top-0 z-[9999] hidden h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-difference md:block"
      style={{ backgroundColor: 'white' }}
      aria-hidden="true"
    />
  )
}
