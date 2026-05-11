/**
 * T4Word — LapasID wordmark (Brandbook v1.0).
 *
 * „Lapas" semi-bold (600) + „ID" regular (400) su 55% opacity.
 * Letter-spacing -0.035em, line-height 1, white-space nowrap.
 *
 * Props:
 *   size — font-size px. Atskirai kontroliuojame mark size'ą per T4Mark.
 *   className — Tailwind text color (pvz. „text-forest-700" arba „text-bone").
 */
export default function T4Word({ size = 18, className = 'text-forest-700', style }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
        fontWeight: 600,
        fontSize: size,
        letterSpacing: '-0.035em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      Lapas<span style={{ fontWeight: 400, opacity: 0.55 }}>ID</span>
    </span>
  )
}
