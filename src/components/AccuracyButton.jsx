import AccuracySprite, { accuracyLabel } from './AccuracySprite'

/**
 * AccuracyButton — du sujungti stačiakampiai įdėti į pilką wrapper'į.
 *
 * Outer wrapper (`bg-gray-900/[0.05]` + `p-1` + `rounded-[20px]`) imituoja
 * tab nav konteinerį — pilkas „rėmas" aiškiai signalina, kad čia yra
 * interaktyvus elementas (analogija su top tab'ais virš header'io).
 *
 * Inner button — du sujungti staciakampiai (rounded-2xl, ne pill):
 *   acc-cta  (kairė): sprite viršuj + „Priežiūra" apačioj
 *   acc-meta (dešinė): N% viršuj + „Tikslumas" apačioj
 *
 * 2 state'ai:
 *   inactive — bg-white outer + dark sage acc-cta + stage-spalva acc-meta
 *   active   (careMode) — solid sage-700 outer + transparent inner + white tekstas
 */
export default function AccuracyButton({ careConfidence = 0, careMode = false, onClick }) {
  const pct   = Math.round((careConfidence ?? 0) * 100)
  const label = accuracyLabel(pct)
  const stage = pct < 25 ? 0 : pct < 50 ? 1 : pct < 75 ? 2 : 3

  // Inactive — baltas su subtle shadow; desktop'e hover gilina shadow'ą.
  // Active careMode — solid forest-700 (Brandbook INK).
  const wrapperCls = careMode
    ? 'bg-forest-700 shadow-[0_4px_14px_rgba(28,58,42,0.32)]'
    : 'bg-white shadow-[0_1px_2px_rgba(28,58,42,0.06),0_0_0_1px_rgba(28,58,42,0.04)] ' +
      'lg:hover:shadow-[0_3px_10px_rgba(28,58,42,0.12)]'

  // Kairė sekcija: balta su forest tekstu/ikona; careMode'e transparent + bone.
  const ctaCls = careMode
    ? 'bg-transparent text-bone'
    : 'bg-white text-forest-700 border-r border-forest-100'

  // Dešinė: stage'inė. Brand'iškai — neutralus bone-300, terracotta warning,
  // forest gerai/puiku. Jokio amber/gray.
  const metaCls = careMode
    ? 'bg-white/12 text-bone border-l border-white/15'
    : stage === 0 ? 'bg-bone-300 text-forest-700'
    : stage === 1 ? 'bg-terracotta-50 text-terracotta-600'
    : stage === 2 ? 'bg-forest-50 text-forest-600'
    : 'bg-forest-100 text-forest-700'

  const pctNumberCls = careMode
    ? 'text-bone'
    : stage === 0 ? 'text-forest-800'
    : stage === 1 ? 'text-terracotta-600'
    : stage === 2 ? 'text-forest-700'
    : 'text-forest-800'

  return (
    <span className="inline-flex p-1 rounded-btn bg-forest-700/[0.05]">
      <button
        onClick={onClick}
        className={`inline-flex items-stretch rounded-btn-sm overflow-hidden transition-all active:scale-[0.97] ${wrapperCls}`}
        title={careMode ? 'Išeiti iš priežiūros režimo' : `Priežiūra · ${label} ${pct}%`}
      >
        {/* Kairė: sprite + „Priežiūra" */}
        <span className={`inline-flex flex-col items-center justify-center gap-1 px-3.5 py-2 min-w-[68px] ${ctaCls}`}>
          <AccuracySprite pct={pct} size={22} color={careMode ? '#f1ebdd' : '#1c3a2a'} />
          <span className="text-[10.5px] font-semibold leading-none tracking-wide">Priežiūra</span>
        </span>

        {/* Dešinė: N% + „Tikslumas" */}
        <span className={`inline-flex flex-col items-center justify-center gap-1 px-3.5 py-2 min-w-[68px] ${metaCls}`}>
          <span className={`text-[15px] font-extrabold leading-none tabular-nums ${pctNumberCls}`}>{pct}%</span>
          <span className="text-[10.5px] font-medium leading-none">Tikslumas</span>
        </span>
      </button>
    </span>
  )
}
