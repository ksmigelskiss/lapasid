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

  // Inactive — baltas su subtle shadow (tab pill „active" pattern'as);
  //            desktop'e hover gilina shadow'ą.
  // Active careMode — solid sage-700 (be hover, jau „selected" state'as).
  const wrapperCls = careMode
    ? 'bg-sage-700 shadow-[0_4px_14px_rgba(46,125,82,0.32)]'
    : 'bg-white shadow-[0_1px_2px_rgba(20,40,30,0.06),0_0_0_1px_rgba(20,40,30,0.04)] ' +
      'lg:hover:shadow-[0_3px_10px_rgba(20,40,30,0.12)]'

  const ctaCls = careMode
    ? 'bg-transparent text-white'
    : 'bg-sage-700 text-white'

  const metaCls = careMode
    ? 'bg-white/12 text-white border-l border-white/15'
    : stage === 0 ? 'bg-gray-100 text-gray-700'
    : stage === 1 ? 'bg-amber-100 text-amber-800'
    : stage === 2 ? 'bg-sage-50 text-sage-700'
    : 'bg-sage-100 text-sage-800'

  const pctNumberCls = careMode
    ? 'text-white'
    : stage === 0 ? 'text-gray-800'
    : stage === 1 ? 'text-amber-800'
    : stage === 2 ? 'text-sage-700'
    : 'text-sage-800'

  return (
    <span className="inline-flex p-1 rounded-[20px] bg-gray-900/[0.05]">
      <button
        onClick={onClick}
        className={`inline-flex items-stretch rounded-2xl overflow-hidden transition-all active:scale-[0.97] ${wrapperCls}`}
        title={careMode ? 'Išeiti iš priežiūros režimo' : `Priežiūra · ${label} ${pct}%`}
      >
        {/* Kairė sekcija: sprite viršuj, „Priežiūra" apačioj */}
        <span className={`inline-flex flex-col items-center justify-center gap-1 px-3.5 py-2 min-w-[68px] ${ctaCls}`}>
          {/* Sprite'as visada baltas — acc-cta fonas dark sage'as visomis stage'omis,
              stage spalva (žalia) ant žalio nematoma. Spalvos progresą atspindi
              acc-meta (Tikslumas N%) sekcija dešinėje. */}
          <AccuracySprite pct={pct} size={22} color="#fff" />
          <span className="text-[10.5px] font-semibold leading-none tracking-wide">Priežiūra</span>
        </span>

        {/* Dešinė sekcija: N% viršuj, „Tikslumas" apačioj */}
        <span className={`inline-flex flex-col items-center justify-center gap-1 px-3.5 py-2 min-w-[68px] ${metaCls}`}>
          <span className={`text-[15px] font-extrabold leading-none tabular-nums ${pctNumberCls}`}>{pct}%</span>
          <span className="text-[10.5px] font-medium leading-none">Tikslumas</span>
        </span>
      </button>
    </span>
  )
}
