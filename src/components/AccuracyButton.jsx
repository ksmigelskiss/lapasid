import AccuracySprite, { accuracyLabel } from './AccuracySprite'

/**
 * AccuracyButton — Brandbook v1.0 unifikuotas dizainas.
 *
 * Viena bone kortelė su forest border'iu, vidiniu vertical divider'iu
 * skiriančiu dvi sekcijas:
 *   Kairė:  sprite + „PRIEŽIŪRA" (mono uppercase metadata)
 *   Dešinė: N% (Bricolage extrabold) + „TIKSLUMAS" (mono uppercase)
 *
 * % skaičiaus spalva atspindi stage'ą (forest gerai, terracotta warning).
 * careMode metu — solid forest-700 + bone tekstas (INK rezimas).
 */
export default function AccuracyButton({ careConfidence = 0, careMode = false, onClick }) {
  const pct   = Math.round((careConfidence ?? 0) * 100)
  const label = accuracyLabel(pct)
  const stage = pct < 25 ? 0 : pct < 50 ? 1 : pct < 75 ? 2 : 3

  const wrapperCls = careMode
    ? 'bg-forest-700 border-forest-800 shadow-[0_4px_14px_rgba(28,58,42,0.32)]'
    : 'bg-bone border-bone-400/70 shadow-[0_1px_2px_rgba(28,58,42,0.04)] ' +
      'lg:hover:bg-bone-50 lg:hover:border-forest-200/70 lg:hover:shadow-[0_3px_10px_rgba(28,58,42,0.10)]'

  const labelCls = careMode
    ? 'text-bone/70'
    : 'text-forest-500'

  const dividerCls = careMode
    ? 'border-bone/15'
    : 'border-bone-400/70'

  const pctNumberCls = careMode
    ? 'text-bone'
    : stage === 0 ? 'text-forest-700'
    : stage === 1 ? 'text-terracotta-600'
    : stage === 2 ? 'text-forest-700'
    : 'text-forest-800'

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-stretch rounded-btn overflow-hidden border transition-all active:scale-[0.97] ${wrapperCls}`}
      title={careMode ? 'Išeiti iš priežiūros režimo' : `Priežiūra · ${label} ${pct}%`}
    >
      {/* Kairė: sprite + „PRIEŽIŪRA" mono metadata */}
      <span className="inline-flex flex-col items-center justify-center gap-1.5 px-4 py-2.5 min-w-[76px]">
        <AccuracySprite pct={pct} size={22} color={careMode ? '#f1ebdd' : '#1c3a2a'} />
        <span className={`font-mono text-[9px] font-medium uppercase tracking-[0.18em] leading-none ${labelCls}`}>
          Priežiūra
        </span>
      </span>

      {/* Vertical divider */}
      <span className={`border-l ${dividerCls} my-2`} />

      {/* Dešinė: N% Bricolage + „TIKSLUMAS" mono */}
      <span className="inline-flex flex-col items-center justify-center gap-1.5 px-4 py-2.5 min-w-[76px]">
        <span className={`font-display text-[18px] font-extrabold leading-none tabular-nums tracking-tight ${pctNumberCls}`}>
          {pct}%
        </span>
        <span className={`font-mono text-[9px] font-medium uppercase tracking-[0.18em] leading-none ${labelCls}`}>
          Tikslumas
        </span>
      </span>
    </button>
  )
}
