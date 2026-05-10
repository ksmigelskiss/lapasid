/**
 * AccuracySprite — augalas-spraitas, kuris auga vizualiai pagal
 * priežiūros tikslumo procentą (mūsų aggregateConfidence × 100).
 *
 * 4 stadijos:
 *  - 0–24%   stage 0: gray sprout            (#94a3a0) — „Mokomės"
 *  - 25–49%  stage 1: amber sprout + 2 leaf  (#f59e0b) — „Tikslumas"
 *  - 50–74%  stage 2: sage sprout + 3 leaf   (#2e7d52) — „Tikslu"
 *  - 75–100% stage 3: dark sage + bloom      (#1f5f3d) — „Tobula"
 *
 * Designer'io exact SVG iš `/tmp/geliai-design/lapasid/project/components.jsx`.
 *
 * Default size 22px, header'yje. Galima skalei 32px+ (jei norėsim
 * parodyti kortelėse ar ant sprite'o atskirai).
 */
export default function AccuracySprite({ pct = 0, size = 22, color }) {
  const stage = pct < 25 ? 0 : pct < 50 ? 1 : pct < 75 ? 2 : 3
  // Stage tones — naudojami tik jei explicit `color` neperduotas. Default
  // (žaliuojanti spalva) tinka mobile baltame fone; AccuracyButton (desktop
  // greeting) kelia tamsų sage-700 fonu, todėl perduoda color="#fff".
  const tones = ['#94a3a0', '#f59e0b', '#2e7d52', '#1f5f3d']
  const tone = color ?? tones[stage]
  const stemTop = [16, 13, 10, 8][stage]

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
      {/* stem */}
      <path d={`M12 21.5 V ${stemTop}`} stroke={tone} strokeWidth="1.8" strokeLinecap="round" />
      {/* leaf 1 — always */}
      <path d="M12 16.5c-2.6 .2 -4.4 -1.1 -4.7 -3.5 2.6 -.2 4.4 1.1 4.7 3.5Z"
            fill={tone} fillOpacity="0.9" />
      {/* leaf 2 — stage ≥1 */}
      {stage >= 1 && (
        <path d="M12 13c2.6 .2 4.4 -1.1 4.7 -3.5 -2.6 -.2 -4.4 1.1 -4.7 3.5Z"
              fill={tone} fillOpacity="0.9" />
      )}
      {/* leaf 3 — stage ≥2 */}
      {stage >= 2 && (
        <path d="M12 9.8c-2.6 .1 -4.5 -1.4 -4.7 -3.8 2.7 -.1 4.5 1.4 4.7 3.8Z"
              fill={tone} fillOpacity="0.85" />
      )}
      {/* bloom — stage 3 */}
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
