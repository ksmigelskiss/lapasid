import AccuracySprite, { accuracyLabel } from './AccuracySprite'

/**
 * AccuracyButton — vientisas pill su dviem vidinėm sekcijom:
 *   acc-cta  (kairė): sprite + „Priežiūra"
 *   acc-meta (dešinė): „Tikslumas N%"
 *
 * 2 state'ai:
 *   inactive — bg-white outer + sage-700 acc-cta + stage-spalva acc-meta
 *   active   (careMode) — solid sage-700 outer + transparent inner + white tekstas
 *
 * Designer'io spec'as iš /tmp/geliai-design (.accuracy-btn struktūra),
 * pritaikytas mūsų Tailwind palette'ei (sage / amber stage tones).
 */
export default function AccuracyButton({ careConfidence = 0, careMode = false, onClick }) {
  const pct   = Math.round((careConfidence ?? 0) * 100)
  const label = accuracyLabel(pct)
  const stage = pct < 25 ? 0 : pct < 50 ? 1 : pct < 75 ? 2 : 3

  const wrapperCls = careMode
    ? 'bg-sage-700 shadow-[0_4px_14px_rgba(46,125,82,0.32)]'
    : 'bg-white shadow-[0_1px_2px_rgba(20,40,30,0.06),0_0_0_1px_rgba(20,40,30,0.04)]'

  const ctaCls = careMode
    ? 'bg-transparent text-white'
    : 'bg-sage-700 text-white'

  const metaCls = careMode
    ? 'bg-white/12 text-white border-l border-white/15'
    : stage === 0 ? 'bg-gray-100 text-gray-700'
    : stage === 1 ? 'bg-amber-100 text-amber-800'
    : stage === 2 ? 'bg-sage-50 text-sage-700'
    : 'bg-sage-100 text-sage-800'

  const pctCls = careMode
    ? 'bg-white/25 text-white'
    : stage === 0 ? 'bg-gray-200/80 text-gray-700'
    : stage === 1 ? 'bg-amber-200/70 text-amber-800'
    : stage === 2 ? 'bg-sage-100 text-sage-700'
    : 'bg-sage-200/80 text-sage-800'

  return (
    <button
      onClick={onClick}
      className={`h-10 inline-flex items-stretch rounded-full overflow-hidden transition-all active:scale-[0.97] ${wrapperCls}`}
      title={careMode ? 'Išeiti iš priežiūros režimo' : `Priežiūra · ${label} ${pct}%`}
    >
      <span className={`inline-flex items-center gap-2 pl-3 pr-3.5 ${ctaCls}`}>
        {/* Sprite'as visada baltas — acc-cta fonas dark sage'as visomis stage'omis,
            stage spalva (žalia) ant žalio nematoma. Spalvos progresą atspindi
            acc-meta (Tikslumas N%) sekcija dešinėje. */}
        <AccuracySprite pct={pct} size={20} color="#fff" />
        <span className="text-[13.5px] font-bold leading-none tracking-tight">Priežiūra</span>
      </span>
      <span className={`inline-flex items-center gap-1.5 pl-3 pr-3.5 ${metaCls}`}>
        <span className="text-[12.5px] font-semibold leading-none">Tikslumas</span>
        <span className={`text-[11px] font-bold leading-none tabular-nums px-1.5 py-0.5 rounded-full ${pctCls}`}>
          {pct}%
        </span>
      </span>
    </button>
  )
}
