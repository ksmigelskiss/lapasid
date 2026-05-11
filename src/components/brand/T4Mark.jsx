/**
 * T4Mark — LapasID Brandbook v1.0 locked mark.
 * Barcode bars + two-leaf sprig + paper-colored vein.
 *
 * Props:
 *   ink   — pagrindinė spalva (bars + leaves). Default forest #1c3a2a.
 *   paper — counter color veiniui virš tamsaus lapo. Default bone #f1ebdd.
 *   size  — width/height px.
 *
 * Visa SVG viduje viewBox="0 0 120 120" — naudojama tiek mažuose
 * mygtukuose (size=14), tiek dideliam splash'e (size=280).
 */
export default function T4Mark({ ink = '#1c3a2a', paper = '#f1ebdd', size = 32, className, style }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', ...style }}
      aria-hidden
    >
      {/* Barcode bars — 11 vertikalių lazdelių, septintoji aukščiausia (lapo bazė) */}
      {[
        { x: 16, w: 4, h: 50 },
        { x: 24, w: 2, h: 50 },
        { x: 30, w: 6, h: 50 },
        { x: 40, w: 3, h: 50 },
        { x: 47, w: 5, h: 50 },
        { x: 56, w: 2, h: 50 },
        { x: 62, w: 4, h: 70 },  // tallest — leaf rises from here
        { x: 72, w: 3, h: 50 },
        { x: 79, w: 6, h: 50 },
        { x: 89, w: 2, h: 50 },
        { x: 95, w: 4, h: 50 },
      ].map((b, i) => (
        <rect key={i} x={b.x} y={104 - b.h} width={b.w} height={b.h} rx="1" fill={ink} />
      ))}
      {/* Main leaf */}
      <path d="M64 30 C 62 12 80 2 106 0 C 102 20 88 32 68 34 C 66 34 64 32 64 30 Z" fill={ink} />
      {/* Counter-leaf */}
      <path d="M62 34 C 56 32 46 32 40 36 C 44 42 54 42 60 38 Z" fill={ink} />
      {/* Central vein */}
      <path d="M66 30 Q 82 18 104 4" stroke={paper} strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
