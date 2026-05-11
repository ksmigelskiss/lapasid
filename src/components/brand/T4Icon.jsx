import T4Mark from './T4Mark'

/**
 * T4Icon — Brandbook v1.0 app icon container.
 * Rounded square (iOS 22.5% corner radius), mark centered at 62% size.
 *
 * Standard:  ink=INK (#1c3a2a), paper=PAPER (#f1ebdd) — dark mark on bone square
 * Inverted:  ink=PAPER, paper=INK — bone mark on forest square ("stamp" variant)
 *
 * Props:
 *   ink, paper — colors passed through to T4Mark + background
 *   size       — outer square size px
 *   radius     — override corner radius (default: size × 0.225)
 */
export default function T4Icon({ ink = '#1c3a2a', paper = '#f1ebdd', size = 120, radius, className, style }) {
  const r = radius != null ? radius : Math.round(size * 0.225)
  return (
    <div
      className={className}
      style={{
        width: size, height: size,
        background: paper,
        borderRadius: r,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
        ...style,
      }}
    >
      <T4Mark ink={ink} paper={paper} size={Math.round(size * 0.62)} />
    </div>
  )
}
