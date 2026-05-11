/**
 * AccuracySprite — 4-bar mini meter, kuris kyla pagal priežiūros tikslumo
 * procentą. Semantiškai matavimas (≠ augimas), brand'iškai jungiasi su
 * T4Mark barcode pagrindu.
 *
 * 4 stadijos (bar'ų aktyvių):
 *  - 0–24%   stage 0: 1 bar  — „Mokomės"   (forest-200 #9bb7a0)
 *  - 25–49%  stage 1: 2 bars — „Tikslumas" (forest-300 #6e9778)
 *  - 50–74%  stage 2: 3 bars — „Tikslu"    (forest-500 #2e5238)
 *  - 75–100% stage 3: 4 bars — „Tobula"    (forest-700 #1c3a2a)
 *
 * Ghost layer'is (opacity 0.22) rodo visą skalę visada — net stage 0
 * matosi pilna forma. Active layer'is (opacity 0.95) rodo realią pažangą.
 *
 * Color prop tik special case (pvz. careMode tamsiame fone — bone).
 */
export default function AccuracySprite({ pct = 0, size = 22, color }) {
  const stage = pct < 25 ? 0 : pct < 50 ? 1 : pct < 75 ? 2 : 3
  // Forest gradient — nuo šviesaus (stage 0) iki INK (stage 3).
  const tones = ['#9bb7a0', '#6e9778', '#2e5238', '#1c3a2a']
  const tone = color ?? tones[stage]

  // 4 augantys bar'ai. Visi 3px platūs, 2px tarpai, baseline y=22.
  // Bar n aktyvus jei stage >= n (taigi stage 0 → 1 bar, stage 3 → 4 bar'ai).
  const bars = [
    { x: 3,  h: 7  },
    { x: 8,  h: 11 },
    { x: 13, h: 15 },
    { x: 18, h: 19 },
  ]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={22 - b.h}
          width="3"
          height={b.h}
          rx="0.6"
          fill={tone}
          fillOpacity={stage >= i ? 0.95 : 0.22}
        />
      ))}
    </svg>
  )
}

/** Stadiją atitinkanti label'as (pasinaudojam priežiūros tooltip'uose ar kortelėse). */
export function accuracyLabel(pct) {
  if (pct < 25) return 'Mokomės'
  if (pct < 50) return 'Tikslumas'
  if (pct < 75) return 'Tikslu'
  return 'Tobula'
}
