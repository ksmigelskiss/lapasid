import AccuracySprite, { accuracyLabel } from './AccuracySprite'

/**
 * AccuracyButton — Brandbook v1.0 two-section model.
 *
 * Du sklipusi staciakampiai įdėti į subtle outer pill (kaip tab nav rėmas).
 *   Kairė (Priežiūra): frosted glass (bone-tinted backdrop blur) — neaktyvus
 *                      vizualas, kaip widget'ai. Sprite + label.
 *   Dešinė (Tikslumas): dinaminis forest gradient'as pagal stage'ą — nuo
 *                       šviesaus (Mokomės) iki INK (Tobula). % skaičius +
 *                       label. Spalva intensyvėja procentaliai.
 *
 * careMode metu — solid forest-700 + bone tekstas (rezimas paslepiamas
 * dashboard'e care mode'e, bet šis kelis state'as palaikomas dėl konsistencijos).
 *
 * AccuracySprite naudoja default forest gradient (žr. AccuracySprite.jsx).
 */
export default function AccuracyButton({ careConfidence = 0, careMode = false, onClick }) {
  const pct   = Math.round((careConfidence ?? 0) * 100)
  const label = accuracyLabel(pct)
  const stage = pct < 25 ? 0 : pct < 50 ? 1 : pct < 75 ? 2 : 3

  // Outer pill — kaip tab nav konteineris, signalas „interaktyvu".
  const outerCls = 'inline-flex p-1 rounded-btn bg-forest-700/[0.05]'

  // Inner wrapper shadow/state.
  const wrapperCls = careMode
    ? 'bg-forest-700 shadow-[0_4px_14px_rgba(28,58,42,0.32)]'
    : 'shadow-[0_1px_2px_rgba(28,58,42,0.06)] lg:hover:shadow-[0_3px_10px_rgba(28,58,42,0.12)]'

  // Kairė (Priežiūra) — frosted glass kaip neaktyvūs widget'ai.
  const ctaCls = careMode
    ? 'bg-transparent text-bone'
    : 'bg-white/55 backdrop-blur-xl text-forest-700 border-r border-bone-400/40'

  // Dešinė (Tikslumas) — dinaminis forest gradient'as pagal stage.
  // Nuo forest-50 (Mokomės) iki forest-300 (Tobula). Visa žalia paletė.
  const metaCls = careMode
    ? 'bg-white/12 text-bone border-l border-white/15'
    : stage === 0 ? 'bg-forest-50 text-forest-500'
    : stage === 1 ? 'bg-forest-100 text-forest-600'
    : stage === 2 ? 'bg-forest-200 text-forest-700'
    : 'bg-forest-300 text-forest-800'

  // % skaičius — kontrastingesnis nei label, gilesnis stage'inis tonas.
  const pctNumberCls = careMode
    ? 'text-bone'
    : stage === 0 ? 'text-forest-700'
    : stage === 1 ? 'text-forest-800'
    : stage === 2 ? 'text-forest-900'
    : 'text-forest-900'

  return (
    <span className={outerCls}>
      <button
        onClick={onClick}
        className={`inline-flex items-stretch rounded-btn-sm overflow-hidden transition-all active:scale-[0.97] ${wrapperCls}`}
        title={careMode ? 'Išeiti iš priežiūros režimo' : `Priežiūra · ${label} ${pct}%`}
      >
        {/* Kairė: sprite + „Priežiūra" — frosted */}
        <span className={`inline-flex flex-col items-center justify-center gap-1 px-3.5 py-2 min-w-[68px] ${ctaCls}`}>
          <AccuracySprite pct={pct} size={22} color={careMode ? '#f1ebdd' : undefined} />
          <span className="text-[10.5px] font-semibold leading-none tracking-wide">Priežiūra</span>
        </span>

        {/* Dešinė: N% + „Tikslumas" — dinaminis forest gradient */}
        <span className={`inline-flex flex-col items-center justify-center gap-1 px-3.5 py-2 min-w-[68px] ${metaCls}`}>
          <span className={`text-[15px] font-extrabold leading-none tabular-nums ${pctNumberCls}`}>{pct}%</span>
          <span className="text-[10.5px] font-medium leading-none">Tikslumas</span>
        </span>
      </button>
    </span>
  )
}
