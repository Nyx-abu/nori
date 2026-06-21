import * as React from 'react'
import { cn } from './cn'

export function WaveDivider({ 
  className, 
  topColor = '#FDFBF7', 
  bottomColor = '#FDFBF7' 
}: { 
  className?: string
  topColor?: string
  bottomColor?: string 
}) {
  return (
    <div className={cn("relative w-full overflow-hidden h-[60px]", className)} style={{ backgroundColor: bottomColor }}>
      <svg
        className="absolute bottom-0 w-full h-[64px]"
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Fill the top section */}
        <path
          d="M0 0V30C120 60 240 0 360 30C480 60 600 0 720 30C840 60 960 0 1080 30C1200 60 1320 0 1440 30V0H0Z"
          fill={topColor}
        />
        {/* The thick dark stroke */}
        <path
          d="M0 30C120 60 240 0 360 30C480 60 600 0 720 30C840 60 960 0 1080 30C1200 60 1320 0 1440 30"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="6"
        />
      </svg>
    </div>
  )
}
