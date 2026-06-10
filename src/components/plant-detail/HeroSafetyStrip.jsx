import { User, Cat, Apple, BadgeCheck, HeartPlus } from 'lucide-react'

// ── HeroSafetyStrip — kompaktinis savybes summary tarp hero + tab bar ──
//
// 2026-06-01 — vartotojas norėjo at-a-glance toxicity/edibility/vaistinis
// info'os be scroll'inimo iki PAVOJAI sekcijos. Strip kompaktiškas — 3 max
// pill'ai, kiekvienas reduced į worst-case (toxicity) arba single fact
// (edibility/vaistinis). Tarša photo'os nėra (sub-hero white strip).
//
// LOGIKA:
//   • Pavojai: pick worst tipas/severity iš pavojai[] (toksiskas > alergiskas >
//     dirginantis; stiprus > vidutinis > silpnas). Fallback į pavojingumas.yra
//     ATSARGIAI saugiklį kai pavojai[] tuščias. Target icons (žmonės/gyvūnai)
//     mini chip'o gale (svarbu safety wise).
//   • Valgomumas: rodom jei !== 'none' (pilnai → „VISAS VALGOMAS", dalinai →
//     „DALINAI VALGOMA").
//   • Vaistinis: rodom jei !== 'none'. BadgeCheck (mokslinė) vs HeartPlus
//     (liaudies) — tas pats ikonos sprendimas kaip PlantSavybesPills.
//
// Nothing to show → komponentas grąžina null (strip dingsta brand new plant'uose).
export default function HeroSafetyStrip({ plant, section }) {
  // 2026-06-01 — strip slėpiamas Dashboard auginamuose plant'uose.
  // Rezonas: user'is jau ŽINO savo augalo savybes (jis pats jį pridėjo),
  // o ant personal photo hero solid pill'ai jaučiasi imposed/aggressive.
  // Biblioteka/wishlist (nori, istorija) — discovery contextas, strip
  // naudingas at-a-glance toxicity reference'iui.
  if (section === 'auginama') return null

  const s = plant?.savybes
  if (!s) return null

  // ── Worst-case toxicity ─────────────────────────────────────
  const pavojai = Array.isArray(s.pavojai) ? s.pavojai : []
  const TIPAS_ORDER = { toksiskas: 3, alergiskas: 2, dirginantis: 1 }
  const SEV_ORDER   = { stiprus: 3, vidutinis: 2, silpnas: 1 }
  let worstTox = null
  for (const p of pavojai) {
    if (!p?.tipas) continue
    if (!worstTox) { worstTox = p; continue }
    const tipasScore  = TIPAS_ORDER[p.tipas] ?? 0
    const sevScore    = SEV_ORDER[p.severity] ?? 0
    const wTipasScore = TIPAS_ORDER[worstTox.tipas] ?? 0
    const wSevScore   = SEV_ORDER[worstTox.severity] ?? 0
    if (tipasScore > wTipasScore || (tipasScore === wTipasScore && sevScore > wSevScore)) {
      worstTox = p
    }
  }
  if (!worstTox && s.pavojingumas?.yra) {
    worstTox = { tipas: 'atsargiai', severity: s.pavojingumas.lygis ?? 'silpnas' }
  }

  const targets = new Set(pavojai.map(p => p?.target).filter(Boolean))
  const hasZmones = targets.has('zmonems')
  const hasGyv    = targets.has('gyvunams')

  // ── Edibility ──────────────────────────────────────────────
  const edibility = s.valgomumas?.statusas
  const hasEdible = edibility && edibility !== 'none'

  // ── Vaistinis ──────────────────────────────────────────────
  const medical = s.vaistinis?.statusas
  const hasMedical = medical && medical !== 'none'

  if (!worstTox && !hasEdible && !hasMedical) return null

  const TIPAS_LABEL = {
    toksiskas:   'TOKSIŠKA',
    alergiskas:  'ALERGIŠKA',
    dirginantis: 'DIRGINA',
    atsargiai:   'ATSARGIAI',
  }
  // 2026-06-01 — TOKSIŠKA spalva sušvelninta nuo solid terracotta į
  // terracotta-200/700 (matches alergiškas saturation). Per user feedback'ą
  // solid pill ant user photo hero'o jautėsi per agresyvus. Severity bars
  // (1/2/3 filled) toliau koduoja sunkumo hierarchiją, color'as ne kritinis.
  const TIPAS_STYLE = {
    toksiskas:   'bg-terracotta-200 text-terracotta-700',
    alergiskas:  'bg-terracotta-100 text-terracotta-600',
    dirginantis: 'bg-terracotta-50 text-terracotta-600',
    atsargiai:   'bg-terracotta-100 text-terracotta-600',
  }
  const sevLevel = worstTox
    ? (worstTox.severity === 'stiprus' ? 3 : worstTox.severity === 'vidutinis' ? 2 : 1)
    : 0

  return (
    <div className="flex items-center gap-1.5 px-4 py-1.5 bg-bone-50 overflow-x-auto scrollbar-none">
      {worstTox && (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] ${TIPAS_STYLE[worstTox.tipas]} flex-shrink-0`}>
          <svg width="9" height="8" viewBox="0 0 12 10" fill="currentColor" aria-hidden>
            <rect x="0"   y="6.5" width="2.5" height="3.5" rx="0.5" opacity={sevLevel >= 1 ? 1 : 0.3} />
            <rect x="4.5" y="3.5" width="2.5" height="6.5" rx="0.5" opacity={sevLevel >= 2 ? 1 : 0.3} />
            <rect x="9"   y="0"   width="2.5" height="10"  rx="0.5" opacity={sevLevel >= 3 ? 1 : 0.3} />
          </svg>
          {TIPAS_LABEL[worstTox.tipas]}
          {(hasZmones || hasGyv) && (
            <span className="flex items-center gap-px opacity-85 -mr-0.5">
              {hasZmones && <User size={9} strokeWidth={2.5} />}
              {hasGyv    && <Cat  size={9} strokeWidth={2.5} />}
            </span>
          )}
        </span>
      )}
      {hasEdible && (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] bg-forest-100 text-forest-700 flex-shrink-0">
          <Apple size={9} strokeWidth={2.5} />
          {edibility === 'pilnai' ? 'VISAS VALGOMAS' : 'DALINAI VALGOMA'}
        </span>
      )}
      {hasMedical && (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] bg-bone-300 text-forest-700 flex-shrink-0">
          {medical === 'moksline' ? <BadgeCheck size={9} strokeWidth={2.5} /> : <HeartPlus size={9} strokeWidth={2.5} />}
          {medical === 'moksline' ? 'VAISTINĖ' : 'LIAUDIES VAIST.'}
        </span>
      )}
    </div>
  )
}
