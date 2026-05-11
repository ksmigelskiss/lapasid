/**
 * AccuracySprite — augalas-spraitas, kuris auga vizualiai pagal
 * priežiūros tikslumo procentą (mūsų aggregateConfidence × 100).
 *
 * Brandbook v1.0 — visi tones forest gradient'e (nuo šviesaus iki INK):
 *  - 0–24%   stage 0: forest-200 (#9bb7a0)  — „Mokomės"   (light, just starting)
 *  - 25–49%  stage 1: forest-300 (#6e9778)  — „Tikslumas" (growing)
 *  - 50–74%  stage 2: forest-500 (#2e5238)  — „Tikslu"    (brand mid)
 *  - 75–100% stage 3: forest-700 (#1c3a2a)  — „Tobula"    (INK peak)
 *
 * Default size 22px. Color prop'ą perduot tik jei reikia override (pvz.
 * careMode tamsiame fone — bone spalva, kad būtų matomas).
 */
export default function AccuracySprite({ pct = 0, size = 22, color }) {
  const stage = pct < 25 ? 0 : pct < 50 ? 1 : pct < 75 ? 2 : 3
  // Forest gradient — nuo šviesaus (stage 0) iki INK (stage 3).
  const tones = ['#9bb7a0', '#6e9778', '#2e5238', '#1c3a2a']
  const tone = color ?? tones[stage]
  const stemTop = [16, 13, 10, 8][stage]

  // Leaf + bloom path'ai (reuse'inami ghost + active layer'iuose)
  const leaf1 = 'M12 16.5c-2.6 .2 -4.4 -1.1 -4.7 -3.5 2.6 -.2 4.4 1.1 4.7 3.5Z'
  const leaf2 = 'M12 13c2.6 .2 4.4 -1.1 4.7 -3.5 -2.6 -.2 -4.4 1.1 -4.7 3.5Z'
  const leaf3 = 'M12 9.8c-2.6 .1 -4.5 -1.4 -4.7 -3.8 2.7 -.1 4.5 1.4 4.7 3.8Z'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {/* soil hint */}
      <path d="M7.5 21.5h9" stroke={tone} strokeWidth="1.6" strokeLinecap="round" opacity="0.35" />

      {/* GHOST layer — pilnas augalas blankiai (kad visada matytųsi forma). */}
      <g opacity="0.25">
        <path d="M12 21.5 V 8" stroke={tone} strokeWidth="1.8" strokeLinecap="round" />
        <path d={leaf1} fill={tone} />
        <path d={leaf2} fill={tone} />
        <path d={leaf3} fill={tone} />
        <circle cx="12" cy="6.5" r="2.4" fill={tone} />
      </g>

      {/* ACTIVE layer — kas iš tikrųjų išaugę (stadia priklauso nuo pct). */}
      <path d={`M12 21.5 V ${stemTop}`} stroke={tone} strokeWidth="1.8" strokeLinecap="round" />
      <path d={leaf1} fill={tone} fillOpacity="0.9" />
      {stage >= 1 && <path d={leaf2} fill={tone} fillOpacity="0.9" />}
      {stage >= 2 && <path d={leaf3} fill={tone} fillOpacity="0.85" />}
      {stage >= 3 && (
        <g>
          <circle cx="12" cy="6.5" r="2.4" fill={tone} />
          <circle cx="12" cy="6.5" r="0.9" fill="#fff" opacity="0.7" />
        </g>
      )}
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
