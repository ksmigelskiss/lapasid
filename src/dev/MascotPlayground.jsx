// MascotPlayground — du sluoksniai mascot variantų preview'ui.
//
// 1) ANIMUS (NAUJAS, rekomenduojamas) — plant + gardener characters
//    iš lapasid-brand/Animus paketo. Pilna character'ystė, brand-aligned.
//
// 2) T4Icon „living mark" (ankstesnė idėja) — abstraktus brand mark'as
//    su state-based animation'omis.
//
// Available at /?playground=mascot.

import Mascot from '../components/brand/Mascot'

const INK_FOREST = '#1c3a2a'
const INK_LIGHT  = '#f1ebdd'
const ACCENT_TERRACOTTA = '#b86a3a'

// SVG bar definitions — exactly matching T4Mark
const BARS = [
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
]

const STYLES = `
@keyframes mascot-sway {
  0%, 100% { transform: rotate(0deg) }
  50%      { transform: rotate(-3deg) }
}
@keyframes mascot-speaking {
  0%, 100% { transform: translateY(0) }
  50%      { transform: translateY(-2px) }
}
@keyframes mascot-droop {
  to { transform: rotate(12deg) translate(2px, 4px) }
}
@keyframes mascot-glow {
  0%, 100% { filter: drop-shadow(0 0 0 transparent) }
  50%      { filter: drop-shadow(0 0 8px rgba(46,82,56,0.45)) }
}
@keyframes mascot-perk {
  0%, 100% { transform: rotate(-2deg) translateY(-1px) }
  50%      { transform: rotate(-4deg) translateY(-2px) }
}
@keyframes bar-pulse {
  0%, 100% { transform: scaleY(1); opacity: 1 }
  50%      { transform: scaleY(1.12); opacity: 0.7 }
}
.leaf-anchor    { transform-origin: 64px 32px }
.bar-anchor     { transform-box: fill-box; transform-origin: bottom }

.sway     .leaf-anchor { animation: mascot-sway 3.2s ease-in-out infinite }
.speaking              { animation: mascot-speaking 1.8s ease-in-out infinite }
.warning  .leaf-anchor { animation: mascot-droop 600ms ease-out forwards }
.success               { animation: mascot-glow 1.6s ease-in-out infinite }
.success  .leaf-anchor { animation: mascot-perk 1.6s ease-in-out infinite }
.thinking .bar { animation: bar-pulse 1.4s ease-in-out infinite }
.thinking .bar:nth-child(1)  { animation-delay: 0.00s }
.thinking .bar:nth-child(2)  { animation-delay: 0.08s }
.thinking .bar:nth-child(3)  { animation-delay: 0.16s }
.thinking .bar:nth-child(4)  { animation-delay: 0.24s }
.thinking .bar:nth-child(5)  { animation-delay: 0.32s }
.thinking .bar:nth-child(6)  { animation-delay: 0.40s }
.thinking .bar:nth-child(7)  { animation-delay: 0.48s }
.thinking .bar:nth-child(8)  { animation-delay: 0.56s }
.thinking .bar:nth-child(9)  { animation-delay: 0.64s }
.thinking .bar:nth-child(10) { animation-delay: 0.72s }
.thinking .bar:nth-child(11) { animation-delay: 0.80s }
`

function AnimatedMark({ state = 'idle', size = 96, ink = INK_FOREST, paper = INK_LIGHT, accent }) {
  const stateClass = state // idle | sway | thinking | speaking | warning | success
  const barFill   = state === 'warning' ? ACCENT_TERRACOTTA : ink
  const leafFill  = state === 'warning' ? ACCENT_TERRACOTTA : (accent || ink)
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={stateClass}
      style={{ display: 'block' }}
      aria-hidden
    >
      {/* Barcode bars */}
      <g>
        {BARS.map((b, i) => (
          <rect
            key={i}
            className="bar bar-anchor"
            x={b.x} y={104 - b.h} width={b.w} height={b.h} rx="1"
            fill={barFill}
          />
        ))}
      </g>
      {/* Leaf group — animated as single unit (sway/droop/perk) */}
      <g className="leaf-anchor">
        <path d="M64 30 C 62 12 80 2 106 0 C 102 20 88 32 68 34 C 66 34 64 32 64 30 Z" fill={leafFill} />
        <path d="M62 34 C 56 32 46 32 40 36 C 44 42 54 42 60 38 Z" fill={leafFill} />
        <path d="M66 30 Q 82 18 104 4" stroke={paper} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}

function Variant({ title, state, description, bg = 'bone' }) {
  const bgClass = bg === 'forest' ? 'bg-forest-700' : 'bg-bone-100'
  const paperColor = bg === 'forest' ? '#f1ebdd' : '#f1ebdd'
  const inkColor   = bg === 'forest' ? '#f1ebdd' : '#1c3a2a'
  return (
    <div className="space-y-3">
      <div className={`${bgClass} rounded-2xl p-8 flex items-center justify-center aspect-square border border-bone-400/40`}>
        <AnimatedMark state={state} size={112} ink={inkColor} paper={paperColor} />
      </div>
      <div>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">{title}</p>
        <p className="text-sm text-forest-700 mt-1">{description}</p>
      </div>
    </div>
  )
}

function AnimusVariant({ title, type, state, description, hoverable = false }) {
  return (
    <div className="space-y-3">
      <div className="bg-bone-100 rounded-2xl p-8 flex items-center justify-center aspect-square border border-bone-400/40">
        <Mascot type={type} state={state} size={160} hoverable={hoverable} />
      </div>
      <div>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">{title}</p>
        <p className="text-sm text-forest-700 mt-1">{description}</p>
      </div>
    </div>
  )
}

export default function MascotPlayground() {
  return (
    <div className="min-h-screen bg-app p-8">
      <style>{STYLES}</style>

      <div className="max-w-5xl mx-auto">
        {/* ═══════════ ANIMUS SECTION (NEW · recommended) ═══════════ */}
        <header className="mb-8">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-terracotta-500 mb-1">Animus mascot · NEW</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-forest-800">Plant + Gardener characters</h1>
          <p className="text-sm text-forest-600 mt-3 max-w-2xl leading-relaxed">
            Iš <span className="font-mono text-xs">lapasid-brand/Animus</span> design'o paketo. Du charakteriai — <strong>Plant</strong> (augalas pats kalba) ir <strong>Gardener</strong> (asistento balsas) — vienas vizualinis žodynas, skirtinga poza. „Wisp-like, ambient, modern" siela su brand-aligned forest + bone paletė. Random blink kas 3-7s palaiko gyvybingumą.
          </p>
        </header>

        <h2 className="font-display text-xl font-semibold tracking-tight text-forest-800 mb-4">Plant — augalo balsas</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-10">
          <AnimusVariant title="Idle" type="plant" state="idle" description={`Default. Breath + random blink + sprout sway. „Aš čia." Naudoti PlantCard hint'ams, plant chat avatar'ui.`} />
          <AnimusVariant title="Happy" type="plant" state="happy" description={`Body bounces taller, sprout perks. „Ačiū už vandenį!" Po sėkmingo watering'o ar achievement'o.`} />
          <AnimusVariant title="Wilt" type="plant" state="wilt" description={`Drooped + terracotta tint. „Praėjo 7 dienos…" Notification'uose kai augalas vėluoja.`} />
          <AnimusVariant title="Think" type="plant" state="think" description={`Thought bubble + pulse dots. „…" Kai AI generuoja patarimą apie šitą augalą.`} />
          <AnimusVariant title="Hoverable idle" type="plant" state="idle" hoverable description={`Idle su hover sway interakcija. Pelę užvedus — gentle sway. Click target'ams.`} />
        </div>

        <h2 className="font-display text-xl font-semibold tracking-tight text-forest-800 mb-4">Gardener — AI asistento balsas</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
          <AnimusVariant title="Idle" type="gardener" state="idle" description={`Default. Breath + random blink. „Klausau visos kolekcijos." Dashboard floating button, chat avatar.`} />
          <AnimusVariant title="Tilt (listening)" type="gardener" state="tilt" description={`Body leans -5°. „Klausau / mąstau." Kai user'is rašo chat'e (typing indicator).`} />
          <AnimusVariant title="Wave" type="gardener" state="wave" description={`Dešinė ranka pakeltą — banguoja. „Sveiki!" Atidarius chat'ą pirmą kartą.`} />
          <AnimusVariant title="Think" type="gardener" state="think" description={`Thought bubble + pulse dots. AI generuoja atsakymą — loading indicator chat'e.`} />
        </div>

        {/* Usage matrix — Animus integration sites */}
        <section className="bg-bone-50 rounded-2xl border border-bone-400/40 p-6 mb-12">
          <h2 className="font-display text-lg font-semibold tracking-tight text-forest-800 mb-4">Integracija — kur kuris characteris</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-bone-400/40">
                <th className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-forest-500 py-2">Vieta</th>
                <th className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-forest-500 py-2">Character</th>
                <th className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-forest-500 py-2">State</th>
              </tr>
            </thead>
            <tbody className="text-forest-700">
              <tr className="border-b border-bone-400/20"><td className="py-2">Dashboard floating AI button</td><td>gardener</td><td>idle (hoverable)</td></tr>
              <tr className="border-b border-bone-400/20"><td className="py-2">Biblioteka floating AI button</td><td>gardener</td><td>idle (hoverable)</td></tr>
              <tr className="border-b border-bone-400/20"><td className="py-2">Chat dialog avatar (Collection)</td><td>gardener</td><td>tilt → think (typing) → idle</td></tr>
              <tr className="border-b border-bone-400/20"><td className="py-2">PlantChat avatar (single plant)</td><td>plant</td><td>idle → think kai AI atsako</td></tr>
              <tr className="border-b border-bone-400/20"><td className="py-2">Watering reminder notification</td><td>plant</td><td>wilt</td></tr>
              <tr className="border-b border-bone-400/20"><td className="py-2">Care done toast'as</td><td>plant</td><td>happy</td></tr>
              <tr><td className="py-2">SearchModal empty state</td><td>gardener</td><td>wave (welcome)</td></tr>
            </tbody>
          </table>
        </section>

        {/* ═══════════ T4Icon SECTION (alt — original idea) ═══════════ */}
        <header className="mb-8 mt-16 border-t border-bone-400/40 pt-8">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500 mb-1">Alternative — original idea</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-forest-800">Mascot — „Living Mark" variantai</h1>
          <p className="text-sm text-forest-600 mt-3 max-w-2xl leading-relaxed">
            T4Icon kaip gyvas brand mark'as. Charakteris atsiranda per <strong className="font-semibold">animation + state</strong>, ne per veido bruožus.
            Vienas „personality" per visą app'ą, brand reinforcement kiekvienoje interakcijoje. Pattern'as kaip Duolingo owl, Linear logo, GitHub Octocat.
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
          <Variant
            title="Idle (default)"
            state="idle"
            description="Statiškas brand mark'as. Naudojama kai AI neaktyvus — splash'e, headeryje, button'uose."
          />
          <Variant
            title="Sway (hover/ambient)"
            state="sway"
            description={`Lapas švelniai siūbuoja −3° (3.2s loop). „Aš čia, jei reikės" — gentle alive signal'as floating button'ams.`}
          />
          <Variant
            title="Thinking (AI processing)"
            state="thinking"
            description="Barcode bars pulse'uoja sequentially (heartbeat). Naudojama kai AI generuoja atsakymą chat'e ar search'e."
          />
          <Variant
            title="Speaking (chat reply)"
            state="speaking"
            description={`Visa marka bob'inasi 2px vertikaliai (1.8s loop). „Kalbu su tavim" — kai chat message renderinasi.`}
          />
          <Variant
            title="Warning (alert state)"
            state="warning"
            description="Lapas droops 12° + terracotta tint'as. Naudojama kai augalas reikalauja dėmesio arba AI mato problemą."
            bg="bone"
          />
          <Variant
            title="Success (positive feedback)"
            state="success"
            description="Lapas perks up + forest glow halo (1.6s loop). Po sėkmingo veiksmo (augalas pridėtas, priežiūra atlikta)."
          />
        </div>

        {/* Inverted variants — antspaudas stilius su forest fonu */}
        <header className="mb-6 mt-12">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500 mb-1">Inverted („antspaudas")</p>
          <h2 className="font-display text-xl font-semibold tracking-tight text-forest-800">Bone marka ant forest fone</h2>
          <p className="text-sm text-forest-600 mt-2 max-w-2xl">Tas pats animation patterns, tik invertuoti tonai — naudojama header'iuose ir tamsesniuose kontekstuose.</p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
          <Variant title="Idle (inverted)"     state="idle"     description="Antspaudo stilius — naudojamas header'yje." bg="forest" />
          <Variant title="Sway (inverted)"     state="sway"     description="Hover state header'io brand'e." bg="forest" />
          <Variant title="Thinking (inverted)" state="thinking" description="Loading state ant tamsesnio bg." bg="forest" />
        </div>

        {/* Usage matrix — kur kuris state'as taikomas */}
        <section className={`bg-bone-50 rounded-2xl border border-bone-400/40 p-6 mb-8`}>
          <h2 className="font-display text-lg font-semibold tracking-tight text-forest-800 mb-4">Kur taikoma — UI state mapping</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-bone-400/40">
                <th className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-forest-500 py-2">Vieta</th>
                <th className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-forest-500 py-2">Default</th>
                <th className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-forest-500 py-2">Active state</th>
              </tr>
            </thead>
            <tbody className="text-forest-700">
              <tr className="border-b border-bone-400/20"><td className="py-2">Dashboard floating AI button</td><td>sway (ambient)</td><td>thinking (chat open)</td></tr>
              <tr className="border-b border-bone-400/20"><td className="py-2">Biblioteka floating AI button</td><td>sway</td><td>thinking</td></tr>
              <tr className="border-b border-bone-400/20"><td className="py-2">Chat avatar (AI message)</td><td>idle</td><td>speaking → success when done</td></tr>
              <tr className="border-b border-bone-400/20"><td className="py-2">SearchModal empty state hero</td><td>idle (didelis 160px)</td><td>thinking ant loading'o</td></tr>
              <tr className="border-b border-bone-400/20"><td className="py-2">App header logo</td><td>idle (inverted)</td><td>sway ant hover'io</td></tr>
              <tr className="border-b border-bone-400/20"><td className="py-2">Plant card AI hint badge</td><td>(naujas: 20px su sway)</td><td>warning kai augalas vėluoja</td></tr>
              <tr><td className="py-2">PlantInfo „Atnaujinti per AI"</td><td>idle</td><td>thinking refresh'inant</td></tr>
            </tbody>
          </table>
        </section>

        <section className="bg-forest-50 border border-forest-100 rounded-2xl p-6">
          <h2 className="font-display text-base font-semibold tracking-tight text-forest-800 mb-2">Ką tau matyt</h2>
          <ul className="text-sm text-forest-700 leading-relaxed space-y-1.5">
            <li>• <strong className="font-semibold">Sway</strong> turi būti vos pastebimas — tu pradžioj galvoji „ar tai paprasta logo, ar gyvas?", po kelių sekundžių pamatai.</li>
            <li>• <strong className="font-semibold">Thinking</strong> bars'ai turi atrodyti kaip loading bar bet su brand mark identity.</li>
            <li>• <strong className="font-semibold">Warning</strong> droops yra DRASTIŠKAS — patikrink ar tinka tonas, gal reikia mažesnio kampo (8° vietoj 12°)?</li>
            <li>• <strong className="font-semibold">Success</strong> glow turi būti šviesus + linksmas, ne harsh — žiūrim ar šešėlio intensyvumas tinka.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
