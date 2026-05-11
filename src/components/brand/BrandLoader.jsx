// Brandbook v1.0 BarsBuildLoader — 11 barcode bars rise + leaf unfurls.
// Default: T4Icon antspaudas inverted (forest square + bone bars), 96px, 2.4s loop.
// inline=true → naked SVG (no square), 20px, 1.6s loop.
// ink='bone' (default) bars rise on dark; ink='forest' bars rise on light.

import { useEffect } from 'react'

const BARS = [
  { x: 16, w: 4, h: 50 }, { x: 24, w: 2, h: 50 }, { x: 30, w: 6, h: 50 },
  { x: 40, w: 3, h: 50 }, { x: 47, w: 5, h: 50 }, { x: 56, w: 2, h: 50 },
  { x: 62, w: 4, h: 70 }, { x: 72, w: 3, h: 50 }, { x: 79, w: 6, h: 50 },
  { x: 89, w: 2, h: 50 }, { x: 95, w: 4, h: 50 },
]

const CSS = `
@keyframes bl-bar-rise {
  0%, 10% { transform: scaleY(0) }
  40%, 80% { transform: scaleY(1) }
  90%, 100% { transform: scaleY(0) }
}
@keyframes bl-leaf-rise {
  0%, 60% { transform: scale(0); opacity: 0 }
  72% { transform: scale(1.06); opacity: 1 }
  82% { transform: scale(1); opacity: 1 }
  90%, 100% { transform: scale(0); opacity: 0 }
}
.bl-bar {
  transform-origin: 50% 100%;
  transform-box: fill-box;
  animation-name: bl-bar-rise;
  animation-timing-function: cubic-bezier(.5,1.6,.4,1);
  animation-iteration-count: infinite;
}
.bl-leaf {
  transform-origin: 64px 32px;
  transform-box: fill-box;
  animation-name: bl-leaf-rise;
  animation-timing-function: cubic-bezier(.3,1.5,.4,1);
  animation-iteration-count: infinite;
}
`

let cssInjected = false
function injectCss() {
  if (cssInjected || typeof document === 'undefined') return
  const style = document.createElement('style')
  style.setAttribute('data-brand-loader', '')
  style.textContent = CSS
  document.head.appendChild(style)
  cssInjected = true
}
if (typeof document !== 'undefined') injectCss()

export default function BrandLoader({
  size,
  inline = false,
  ink = 'bone',
  duration,
  className = '',
  label = 'Kraunama',
}) {
  useEffect(() => { injectCss() }, [])

  const containerSize = size ?? (inline ? 20 : 96)
  const innerSize = inline ? containerSize : Math.round(containerSize * 0.625)
  const dur = `${duration ?? (inline ? 1.6 : 2.4)}s`
  const radius = inline ? 0 : Math.round(containerSize * 0.225)

  const barColor = ink === 'bone' ? '#f1ebdd' : '#1c3a2a'
  const veinColor = ink === 'bone' ? '#1c3a2a' : '#f1ebdd'
  const squareBg = ink === 'bone' ? '#1c3a2a' : '#f1ebdd'

  const svg = (
    <svg viewBox="0 0 120 120" width={innerSize} height={innerSize} style={{ display: 'block' }}>
      {BARS.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={104 - b.h}
          width={b.w}
          height={b.h}
          rx="1"
          fill={barColor}
          className="bl-bar"
          style={{ animationDuration: dur, animationDelay: `${i * 0.04}s` }}
        />
      ))}
      <g className="bl-leaf" style={{ animationDuration: dur }}>
        <path d="M64 30 C 62 12 80 2 106 0 C 102 20 88 32 68 34 C 66 34 64 32 64 30 Z" fill={barColor} />
        <path d="M62 34 C 56 32 46 32 40 36 C 44 42 54 42 60 38 Z" fill={barColor} />
        <path
          d="M66 30 Q 82 18 104 4"
          stroke={veinColor}
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  )

  if (inline) {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        role="status"
        aria-label={label}
      >
        {svg}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        width: containerSize,
        height: containerSize,
        borderRadius: radius,
        background: squareBg,
      }}
      role="status"
      aria-label={label}
    >
      {svg}
    </span>
  )
}
