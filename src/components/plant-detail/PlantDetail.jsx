import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls, useMotionValue, animate } from 'framer-motion'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { useDetailHost } from '../../contexts/DetailHostContext'
import { X, Camera, Sun, Droplets, Thermometer, Wind, Flower2, RefreshCw, Star, Bookmark, Globe, MessageCircle, Pencil, Trash2, Loader2, MoreHorizontal, Leaf, Snowflake, MapPin, ChevronLeft, ChevronRight, ChevronDown, Share2, Copy, Check, Link2, User, Cat, Apple, BadgeCheck, HeartPlus } from 'lucide-react'
import { doc, setDoc } from 'firebase/firestore'
import { db, auth } from '../../utils/firebase'
import { ZonePicker } from '../ZoneManager'
import PlantTimeline, { FAB, AddEventSheet } from '../PlantTimeline'
import BarcodeLifeline from '../brand/BarcodeLifeline'
import PlantSavybesPills, { PlantSafetyCallout } from '../brand/PlantSavybesPills'
import PlantImage from '../brand/PlantImage'
import BrandLoader from '../brand/BrandLoader'
import { ensureArray, makeId, today } from '../../utils/plantTransform'
import { getPlantEnrichmentState, getEnrichmentFailureReason } from '../../utils/plantState'
import { getFertilizingSummary } from '../../utils/fertilizingForecast'
import { heroIllustrationFor, heroThumbFor, heroIsDefaultFor } from '../../utils/catalog'
import { fetchPlantNames } from '../../utils/plantNames'
import { resizeImage } from '../../utils/imageService'
import { getPlantMood } from '../../utils/plantMood'
import PlantChat from '../PlantChat'
import { PlantAvatar } from '../icons/ChatIcons'
import { WateringCard, FertilizingCard, DormancyCard } from '../ForecastCards'
import { StatusMenu, STATUS_ICON } from '../StatusPicker'
import { getStatusMeta } from '../../constants/plant'
import PhotoSheet from './PhotoSheet'

// ── Small helpers ──────────────────────────────────────────────

function DotScore({ value, max = 3, color }) {
  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={`w-2 h-2 rounded-full ${i < value ? color : 'bg-gray-200'}`} />
      ))}
    </div>
  )
}

function Stars({ value, max = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`text-sm ${i < value ? 'text-amber-400' : 'text-gray-300'}`}>★</span>
      ))}
    </div>
  )
}

function Section({ title, children, id }) {
  return (
    <div id={id} className="space-y-2.5">
      <div className="flex items-center gap-3">
        <p className="font-mono text-[11px] font-semibold text-forest-700 uppercase tracking-[0.18em]">{title}</p>
        <div className="flex-1 h-px bg-bone-400/60" />
      </div>
      {children}
    </div>
  )
}

// Salvage'ina korumpuotus duomenis: kartais Firestore'e plant.substratas
// (ar pan.) tampa indexed-char objektu `{"0":"P","1":"u",...}` (kažkur
// per ankstesnę refresh iteraciją {...string} spread'as suskaldė).
// Jei aptinkam šitą pattern'ą — surenkam atgal į string'ą display'ui.
// Tikras fix'as — refresh'as overwrite'ina su nauja string vert. iš AI.
function safeStringValue(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'object' && !Array.isArray(v)) {
    const keys = Object.keys(v)
    if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
      // Indexed-char objektas — reconstruct'inam string'ą
      const sorted = keys.map(Number).sort((a, b) => a - b)
      return sorted.map(i => v[i]).join('')
    }
    return ''  // kitas objekto formatas — nerodom (nei JSON'o, nei [object Object])
  }
  return String(v)
}

function InfoRow({ icon, label, value }) {
  const text = safeStringValue(value)
  if (!text) return null
  return (
    <div className="flex gap-3 py-2.5 border-b border-bone-400/30 last:border-0">
      <div className="w-6 flex-shrink-0 flex items-center justify-center text-forest-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em]">{label}</p>
        <p className="text-sm text-forest-700 mt-1 leading-snug">{text}</p>
      </div>
    </div>
  )
}

// CareRow — vieninga priežiūros eilutė: lygis (DotScore + lygio žodis + ppfd)
// VIRŠUJE + narrative proza apačioje. Sujungia anksčiau dubliuotus struktūrinį
// (●●○) ir narrative blokus į vieną (UX dedup 2026-05-29).
function CareRow({ icon, label, score, value }) {
  const text = safeStringValue(value)
  if (!score && !text) return null
  return (
    <div className="flex gap-3 py-2.5 border-b border-bone-400/30 last:border-0">
      <div className="w-6 flex-shrink-0 flex items-center justify-center text-forest-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em]">{label}</p>
        {score && <div className="flex items-center gap-2 flex-wrap mt-1">{score}</div>}
        {text && <p className="text-sm text-forest-700 mt-1 leading-snug">{text}</p>}
      </div>
    </div>
  )
}

// Skeleton placeholder for enrichment-in-progress sections (2026-06-01).
// Naudoja animate-pulse + bone-300/60 bg — matches PlantImage SW cache and
// EnrichmentProgress patterns. Lines parametras controls how many shimmer
// bars (typical: 2 = short blok, 3 = aprasymas-tipo paragraph).
function SkeletonLines({ lines = 2, className = '' }) {
  return (
    <div className={`space-y-2 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded bg-bone-300/60"
          style={{ width: i === lines - 1 ? '70%' : '100%' }}
        />
      ))}
    </div>
  )
}

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
function HeroSafetyStrip({ plant, section }) {
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

// ── Augalo pasas sekcija ───────────────────────────────────────

function PassportSection({ plant, collectionId, onToggle }) {
  const isPublic    = plant.isPublic === true
  const passportUrl = `${window.location.origin}/p/${plant.id}`
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleToggle = async () => {
    setSaving(true)
    try {
      await onToggle(plant, !isPublic)
    } finally {
      setSaving(false)
    }
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(passportUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const share = () => {
    if (navigator.share) {
      navigator.share({ title: plant.lietuviškas, url: passportUrl })
    } else {
      copyUrl()
    }
  }

  return (
    <div className="border border-bone-400/40 rounded-2xl p-4 space-y-3">
      {/* Toggle row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link2 size={16} className="text-forest-400 flex-shrink-0" />
          <div>
            <p className="font-display text-sm font-bold text-forest-700 tracking-tight">Augalo pasas</p>
            <p className="font-mono text-[10px] text-forest-500 uppercase tracking-[0.14em] mt-0.5">Viešas profilis · priežiūros info</p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
            isPublic ? 'bg-forest-600' : 'bg-bone-400'
          } ${saving ? 'opacity-50' : ''}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-bone rounded-full shadow-sm transition-transform duration-200 ${
            isPublic ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* URL + share — tik kai įjungta */}
      {isPublic && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-bone-50 rounded-xl px-3 py-2 border border-bone-400/40">
            <span className="font-mono text-xs text-forest-600 flex-1 truncate">{passportUrl}</span>
            <button onClick={copyUrl} className="flex-shrink-0 p-1 rounded-lg active:bg-bone-300 transition-colors">
              {copied
                ? <Check size={14} className="text-forest-600" />
                : <Copy size={14} className="text-forest-400" />
              }
            </button>
          </div>
          <button
            onClick={share}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-forest-600 text-bone rounded-xl text-sm font-bold"
          >
            <Share2 size={14} />
            Dalintis nuoroda
          </button>
        </div>
      )}
    </div>
  )
}

// ── Profile tab content ────────────────────────────────────────

export function ProfileContent({ plant: rawPlant, section, onAction, onClose, collectionId, onTogglePassport, onUpdateNames, className }) {
  // LEGACY READ-TIME SAFETY NET — kai kurie SENI catalog/plant įrašai
  // (saved'inti prieš normalizeAIResponse boundary refaktorą) turi array
  // laukus kaip JSON-string'us. Naujieji save'ai per fetchDetails →
  // normalizeAIResponse jau gauna švarius array'us. Šis layer'is — TIK
  // legacy data fallback'as. Backfill script'as ateityje gali jį panaikinti.
  const plant = {
    ...rawPlant,
    idomybes:     ensureArray(rawPlant?.idomybes),
    problemos:    ensureArray(rawPlant?.problemos),
    dauginimas:   ensureArray(rawPlant?.dauginimas),
    sinonimai:    ensureArray(rawPlant?.sinonimai),
    englishNames: ensureArray(rawPlant?.englishNames),
    photos:       ensureArray(rawPlant?.photos),
  }

  // Synonyms — inline editorial proza
  // Step 6g filter — drop'inam DESCRIPTOR-style entries.
  // Probleminis case: „žolės pavidalo" iš data/plants.json scrape (Polygal'ui
  // klaidingai label'inta kaip LT pavadinimas; realiai tai būdvardinis
  // aprašymas „grass-shaped", ne sinonimas).
  //
  // CRITERIA — 2+ žodžiai IR visi lowercase:
  //   ✓ Paprastoji putokšlė   → KEEP (capital first)
  //   ✓ Common Milkwort       → KEEP (capital words)
  //   ✓ alijošius             → KEEP (single lowercase OK — folk name e.g. Aloe)
  //   ✓ milkwort              → KEEP (single lowercase OK — English name)
  //   ✗ žolės pavidalo        → DROP (2+ words, all lowercase = descriptor)
  //   ✗ vingrio pavidalo      → DROP (same pattern)
  //
  // Long-term fix — pataisyti scripts/build-lt-names.mjs source data
  // (data/plants.json turi descriptor entries kaip „names").
  const isProperLtName = (s) => {
    if (!s) return false
    const words = s.trim().split(/\s+/)
    if (words.length === 1) return true  // single word — any case OK
    // Multi-word: bent vienas turi prasidėti uppercase
    return words.some(w => w[0] !== w[0].toLowerCase())
  }
  const ltSyns = [
    plant.inatLtName && plant.inatLtName !== plant.lietuviškas ? plant.inatLtName : null,
    ...(plant.sinonimai?.filter(s => s !== plant.inatLtName) ?? []),
  ].filter(Boolean).filter(isProperLtName)
  const enSyns = plant.englishNames ?? []
  const hasSyns = ltSyns.length > 0 || enSyns.length > 0

  // Variant B Step 6g — enrichment state'as (Variant E signals)
  const enrichmentState = getPlantEnrichmentState(plant)
  const isEnriching = enrichmentState === 'enriching'
  const isFailed    = enrichmentState === 'failed'

  // Step 6h — retry handler + Step 6s — re-enrich shared helper
  // reEnrichPlant: bump enrichmentStartedAt + clear enrichmentError →
  // POST /api/save-plant. Server idempotency check po Step 6s upgrade
  // mato startedAt > completedAt → processPlant pradeda naują ciklą.
  // Listener'is auto-updates plant doc'ą kai server'is baigia (su nauju
  // phase2CompletedAt + naujais aprasymas/care/narrative laukais).
  const [retrying, setRetrying] = useState(false)

  const reEnrichPlant = async () => {
    const idToken = await auth.currentUser?.getIdToken().catch(() => null)
    if (!idToken || !collectionId) {
      console.warn('[re-enrich] missing auth/collectionId')
      return false
    }
    // 1. Bump startedAt + clear error per setDoc merge:true.
    //    Tas Firestore listener auto-rerender'ins kortelę kaip 'enriching'.
    try {
      await setDoc(doc(db, 'collections', collectionId, 'plants', plant.id), {
        enrichmentStartedAt: new Date().toISOString(),
        enrichmentError: null,
      }, { merge: true })
    } catch (e) {
      console.warn('[re-enrich] firestore startedAt bump failed:', e?.message)
    }
    // 2. POST /api/save-plant — server'is matys startedAt > completedAt → run.
    try {
      const res = await fetch('/api/save-plant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          latinName: plant.lotyniskas,
          name:      plant.lietuviškas,
          baseResult: {
            latinName: plant.lotyniskas,
            name: plant.lietuviškas,
            image: plant.image,
            aprasymas: plant.aprasymas,
            aprasymasLang: plant.aprasymasLang,
            kilme: plant.kilme,
            savybes: plant.savybes,
            sources: plant.sources,
          },
          colId:     collectionId,
          plantId:   plant.id,
          kategorija: plant.kategorija ?? 'auginama',
        }),
      })
      if (!res.ok) {
        console.warn('[re-enrich] HTTP', res.status)
        return false
      }
      console.log('[re-enrich] dispatched — listener updatins UI po server completion')
      return true
    } catch (e) {
      console.warn('[re-enrich] POST failed:', e?.message)
      return false
    }
  }

  // Failed-banner retry button (PlantDetail viduje) — staying in detail
  const handleRetry = async () => {
    if (retrying) return
    setRetrying(true)
    try { await reEnrichPlant() } finally { setRetrying(false) }
  }

  return (
    <div className={className ?? "px-5 pt-4 pb-10 space-y-6"}>

      {/* Step 6g — enrichment loading / failed banner.
          'enriching' — forest green, BrandLoader, normal pending copy.
          'failed'    — terracotta, error reason, retry CTA (Step 6h
                        prijungs retry handler'į). */}
      {isEnriching && (
        <div className="rounded-2xl bg-forest-50 border border-forest-200/60 p-3 flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5"><BrandLoader inline size={20} /></div>
          <div className="flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] font-medium text-forest-700">
              ⌛ renkam priežiūros informaciją…
            </p>
            <p className="text-[12px] text-forest-500 mt-1.5 leading-relaxed">
              AI dirba foniniame režime (apie 10-30 sek). Gali uždaryti — grįžęs rasi pilną informaciją.
            </p>
          </div>
        </div>
      )}
      {isFailed && (
        <div className="rounded-2xl bg-terracotta-50 border border-terracotta-200/60 p-3 space-y-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] font-medium text-terracotta-700">
              ⚠ nepavyko surinkti
            </p>
            <p className="text-[12px] text-forest-500 mt-1.5 leading-relaxed">
              {getEnrichmentFailureReason(plant)}. Šis augalas išsisaugojo su pagrindine info, bet AI priežiūros surinkti neišėjo.
            </p>
          </div>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full h-10 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {retrying ? (
              <>
                <BrandLoader inline size={16} />
                <span>bandom dar kartą…</span>
              </>
            ) : (
              <span>Bandyti dar kartą</span>
            )}
          </button>
        </div>
      )}

      {/* ── Title block — Bricolage 600 + Latin + synonyms inline. Scroll'inasi
            su content (vietoj static hero block — taupo scroll erdvę). ── */}
      <div>
        {/* Vardas — read-only. Reference modelis: vardai catalog-owned, user
            nebekeičia (tik foto/istorija/užrašus). Taisymai vyksta katalogE. */}
        <h2 className="font-display text-2xl font-semibold tracking-tight text-forest-800 leading-tight">
          {plant.lietuviškas}
        </h2>
        {plant.lotyniskas && (
          <p className="text-sm text-forest-500 italic mt-1">{plant.lotyniskas}</p>
        )}
        {hasSyns && (
          <p className="text-[12.5px] text-forest-400 mt-3 leading-relaxed">
            Taip pat:{' '}
            {ltSyns.map((s, i) => (
              <span key={`lt-${i}`}>
                {i > 0 && ', '}
                <span className="text-forest-600">{s}</span>
              </span>
            ))}
            {ltSyns.length > 0 && enSyns.length > 0 && ' · '}
            {enSyns.map((n, i) => (
              <span key={`en-${i}`}>
                {i > 0 && ', '}
                <span className="text-forest-500 italic">{n}</span>
              </span>
            ))}
          </p>
        )}
      </div>

      {/* ── Watering overdue reminder ── */}
      <WateringCard plant={plant} section={section} />

      {/* ── Fertilizing forecast / reminder ── */}
      <FertilizingCard plant={plant} section={section} />

      {/* ── Dormancy reminder ── */}
      <DormancyCard plant={plant} section={section} />


      {/* Step 6r — stiprus toxicity callout JE PRIEŠ pills (anksciau buvo po,
            su duplicate narrative). Dabar callout = single source of narrative
            stiprus žmonėms atveju; pills below renders be teksto. */}
      <PlantSafetyCallout plant={plant} />

      {/* ── Savybes pill'ai (granuliariai toksiškumas + valgomumas + vaistinis).
            Narrative suppressed kai stiprus žmonėms case — eina į callout. ── */}
      <PlantSavybesPills plant={plant} />

      {/* ── Quick stats — editorial table (mono caps label + Bricolage value). ── */}
      <div className="divide-y divide-bone-400/30">
        {plant.kilme ? (
          <div className="flex items-start gap-3 py-2.5">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em] w-24 flex-shrink-0"><MapPin size={11} className="text-forest-400" /> Kilmė</span>
            <span className="text-sm text-forest-700 leading-snug flex-1">{plant.kilme}</span>
          </div>
        ) : isEnriching ? (
          <div className="flex items-start gap-3 py-2.5">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em] w-24 flex-shrink-0"><MapPin size={11} className="text-forest-400" /> Kilmė</span>
            <div className="flex-1"><SkeletonLines lines={2} /></div>
          </div>
        ) : null}
        {plant.tipas && (
          <div className="flex items-center gap-3 py-2.5">
            <span className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em] w-24 flex-shrink-0">Tipas</span>
            <span className="text-sm text-forest-700">{plant.tipas}</span>
          </div>
        )}
        {plant.sunkumas != null && (
          <div className="flex items-center gap-3 py-2.5">
            <span className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em] w-24 flex-shrink-0">Sunkumas</span>
            <Stars value={plant.sunkumas} />
          </div>
        )}
      </div>

      {/* ── Description + external links — su skeleton kol Phase 2 enrich vyksta */}
      {!plant.aprasymas && isEnriching && (
        <Section title="Apie augalą">
          <SkeletonLines lines={3} />
        </Section>
      )}
      {plant.aprasymas && (
        <Section title="Apie augalą">
          {/* Step 6k — honest provenance marker. UI'us nemaskuoja AI synthesis
              kaip Wiki content. Subtle mono pill po antraštės. */}
          {plant.aprasymasSource && (
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-forest-400 mb-2 -mt-1">
              {plant.aprasymasSource === 'wikipedia-en' ? 'ⓘ Wikipedia + AI vertimas' : 'ⓘ AI sintezė'}
            </p>
          )}
          <p className="text-sm text-forest-700 leading-relaxed">{plant.aprasymas}</p>
          {plant.lotyniskas && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {(() => {
                const fullName = plant.lotyniskas
                const genus    = fullName.split(' ')[0]
                const links = [
                  {
                    label: 'Wikipedia LT',
                    href: plant.wikiLtFound
                      ? `https://lt.wikipedia.org/wiki/${encodeURIComponent(fullName)}`
                      : `https://lt.wikipedia.org/w/index.php?search=${encodeURIComponent(genus)}`,
                  },
                  {
                    label: 'Wikipedia EN',
                    href: plant.wikiEnFound
                      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(fullName)}`
                      : `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(genus)}`,
                  },
                  ...(plant.inatTaxonId
                    ? [{ label: 'iNaturalist', href: `https://www.inaturalist.org/taxa/${plant.inatTaxonId}` }]
                    : []),
                ]
                return links.map(({ label, href }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-500 hover:text-forest-700 underline underline-offset-2 transition-colors">
                    {label}
                  </a>
                ))
              })()}
            </div>
          )}
        </Section>
      )}

      {/* ── Care — vieningas profilis: lygis (●●○) + narrative + tręšimas vienoje
            vietoje (UX dedup — anksčiau šviesa/vanduo dubliavosi struktūrinėj meta
            lentelėj IR čia; tręšimas tik forecast kortelėj). ── */}
      {/* Skeleton state — kai enrichment dar vyksta ir priežiūros duomenų nėra */}
      {!plant.prieziura && plant.sviesa?.taskai == null && plant.vanduo?.taskai == null && isEnriching && (
        <Section title="Priežiūra" id="prieziura-section">
          <div className="space-y-3 py-1">
            <SkeletonLines lines={2} />
            <SkeletonLines lines={2} />
            <SkeletonLines lines={2} />
          </div>
        </Section>
      )}
      {(plant.prieziura || plant.sviesa?.taskai != null || plant.vanduo?.taskai != null) && (
        <Section title="Priežiūra" id="prieziura-section">
          <div>
            <CareRow
              icon={<Sun size={15} />}
              label="Šviesa"
              score={plant.sviesa?.taskai != null && (
                <>
                  <DotScore value={plant.sviesa.taskai} color="bg-terracotta-400" />
                  <span className="text-sm text-forest-700">{plant.sviesa.lygis}</span>
                  {plant.sviesa?.ppfd && (
                    <span className="font-mono text-[10px] font-medium text-terracotta-600 bg-terracotta-50 border border-terracotta-200/60 rounded-md px-1.5 py-0.5 leading-none">
                      {plant.sviesa.ppfd.min}–{plant.sviesa.ppfd.max} μmol/m²/s
                    </span>
                  )}
                </>
              )}
              value={plant.prieziura?.sviesa}
            />
            <CareRow
              icon={<Droplets size={15} />}
              label="Vanduo"
              score={plant.vanduo?.taskai != null && (
                <>
                  <DotScore value={plant.vanduo.taskai} color="bg-forest-400" />
                  <span className="text-sm text-forest-700">{plant.vanduo.lygis}</span>
                </>
              )}
              value={plant.prieziura?.laistymas}
            />
            {(() => {
              // Tręšimas — derived iš kategorijos (autoritetinė lentelė). Gyvena ČIA
              // (referencija); viršaus forecast kortelė rodo tik „kada".
              const fs = getFertilizingSummary(plant)
              const txt = fs.vasaraDays == null
                ? `${fs.tip}.`
                : `Augimo sezonu (pavasaris–ruduo) kas ~${fs.vasaraDays} d.${fs.skipWinter ? ', žiemą nutraukti' : ''}. ${fs.tip}.`
              return <CareRow icon={<Leaf size={15} />} label="Tręšimas" value={txt} />
            })()}
            <CareRow icon={<Thermometer size={15} />} label="Temperatūra" value={plant.prieziura?.temperatura} />
            <CareRow icon={<Wind size={15} />}        label="Drėgmė"      value={plant.prieziura?.dregme} />
          </div>
        </Section>
      )}

      {/* ── Substrate / repotting / winter ── */}
      {(plant.substratas || plant.persodinimas || plant.ziemojimas) && (
        <Section title="Substratas ir sezoniškumas">
          <div className="divide-y divide-bone-400/30">
            <InfoRow icon={<Flower2 size={15} />}   label="Substratas"   value={plant.substratas} />
            <InfoRow icon={<RefreshCw size={15} />} label="Persodinimas" value={plant.persodinimas} />
            <InfoRow icon={<Snowflake size={15} />}  label="Žiemojimas"   value={plant.ziemojimas} />
          </div>
        </Section>
      )}

      {/* ── Propagation — editorial bullets (be konteinerio fono). ── */}
      {Array.isArray(plant.dauginimas) && plant.dauginimas.length > 0 && (
        <Section title="Dauginimas">
          <ul className="space-y-2">
            {plant.dauginimas.map((d, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-forest-400 font-bold text-sm mt-0.5 flex-shrink-0 leading-snug">·</span>
                <p className="text-sm text-forest-700 leading-snug">{d}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── Problems — editorial diagnostic table. Mono caps labels +
            Bricolage Bold symptom (terracotta = warning). ── */}
      {Array.isArray(plant.problemos) && plant.problemos.length > 0 && (
        <Section title="Problemų diagnostika">
          <div className="space-y-4">
            {plant.problemos.map((p, i) => (
              <div key={i} className="space-y-2.5">
                <div>
                  <p className="font-mono text-[10px] font-medium text-terracotta-600 uppercase tracking-[0.16em]">Simptomas</p>
                  <p className="font-display text-sm font-bold text-terracotta-600 tracking-tight mt-0.5">{p.simptomas}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pl-3 border-l-2 border-terracotta/30">
                  <div>
                    <p className="font-mono text-[9.5px] font-medium text-forest-500 uppercase tracking-[0.16em]">Priežastis</p>
                    <p className="text-[12.5px] text-forest-700 mt-1 leading-snug">{p.priezastis}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[9.5px] font-medium text-forest-500 uppercase tracking-[0.16em]">Sprendimas</p>
                    <p className="text-[12.5px] text-forest-700 mt-1 leading-snug">{p.sprendimas}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Interesting facts — editorial bullets (be amber kortelės). ── */}
      {Array.isArray(plant.idomybes) && plant.idomybes.length > 0 && (
        <Section title="Įdomybės">
          <ul className="space-y-2">
            {plant.idomybes.map((fact, i) => (
              <li key={i} className="flex items-start gap-3">
                <Leaf size={14} className="text-forest-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-forest-700 leading-snug">{fact}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── History: death + lesson — editorial blokai su terracotta accent. ── */}
      {section === 'istorija' && (
        <Section title="Augalo istorija">
          <div className="space-y-4">
            {(plant.diedDate || plant.removedDate) && (
              <div className="pl-3 border-l-2 border-forest-300/60">
                <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em]">
                  {plant.historyKind === 'removed' ? 'Nebeauginu nuo' : 'Numirė'}
                </p>
                <p className="text-sm text-forest-700 mt-1 tabular-nums">{plant.diedDate || plant.removedDate}</p>
              </div>
            )}
            {plant.deathReason && (
              <div className="pl-3 border-l-2 border-terracotta/40">
                <p className="font-mono text-[10px] font-medium text-terracotta-600 uppercase tracking-[0.16em]">Priežastis</p>
                <p className="text-sm text-forest-700 mt-1">{plant.deathReason}</p>
              </div>
            )}
            {plant.lesson && (
              <div className="pl-3 border-l-2 border-forest-400/50">
                <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em]">Pamoka</p>
                <p className="text-sm text-forest-700 mt-1">{plant.lesson}</p>
              </div>
            )}
          </div>
        </Section>
      )}


      {/* ── Augalo pasas ── */}
      {section === 'auginama' && onTogglePassport && (
        <PassportSection plant={plant} collectionId={collectionId} onToggle={onTogglePassport} />
      )}

      {/* ── Actions — TIK primary CTA'ai (nori/istorija). Sekundariniai
          (Dublikuoti, Ištrinti) perkelti į „..." meniu toolbar'yje. ── */}
      {onAction && (section === 'nori' || section === 'istorija') && (
        <div className="flex flex-col gap-2 pt-1">
          {section === 'nori' && (
            <button onClick={() => onAction('buy', plant)}
              className="w-full py-3.5 rounded-2xl text-sm font-medium text-white bg-forest-600 hover:bg-forest-700 transition-colors">
              Pirkau, turiu!
            </button>
          )}
          {section === 'istorija' && (
            <button onClick={() => { onAction('tryAgain', plant); onClose() }}
              className="w-full py-3.5 rounded-2xl text-sm font-medium text-white bg-forest-600 hover:bg-forest-700 transition-colors">
              Bandyti vėl
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Notes tab content ──────────────────────────────────────────

// Pirma non-empty eilutė kaip title (su markdown žymeklių stripping'u).
// Tas pats pattern'as kaip Zinynas.jsx — vientisas note display'us per visą app'ą.
function extractNoteTitle(text) {
  if (!text) return ''
  const firstLine = text.split('\n').find(l => l.trim().length > 0) || ''
  return firstLine
    .replace(/^#+\s*/, '')           // ## heading marks
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1')     // italic
    .replace(/`(.+?)`/g, '$1')       // code
    .replace(/^[-*]\s+/, '')         // list bullet
    .trim()
    .slice(0, 120)
}

// Body = visas tekstas po pirmos non-empty eilutės (su išlaikytais line breaks).
function extractNoteBody(text) {
  if (!text) return ''
  const lines = text.split('\n')
  const firstNonEmptyIdx = lines.findIndex(l => l.trim().length > 0)
  if (firstNonEmptyIdx < 0) return ''
  return lines.slice(firstNonEmptyIdx + 1).join('\n').trim()
}

function NoteCard({ note, expanded, onToggle, onEdit, onDelete, onShare, onToggleStar, onChat }) {
  const title = extractNoteTitle(note.text) || '(tuščia)'
  const body  = extractNoteBody(note.text)

  return (
    <motion.div
      className="border border-bone-400/40 rounded-2xl px-4 py-3.5 cursor-pointer active:bg-bone-300/40 transition-colors"
      onClick={onToggle}
      layout
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className={`font-display text-sm font-semibold tracking-tight text-forest-800 leading-snug ${expanded ? '' : 'truncate'}`}>
            {title}
          </p>
          {body && (
            <p className={`text-[13px] text-forest-600 leading-relaxed whitespace-pre-wrap mt-1 ${expanded ? '' : 'line-clamp-2'}`}>
              {body}
            </p>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onToggleStar() }}
          className="flex-shrink-0 text-base leading-none mt-0.5 transition-transform active:scale-90"
        >
          {note.starred
            ? <Star size={14} className="text-terracotta-400 fill-terracotta-400" />
            : <Star size={14} className="text-forest-300" />
          }
        </button>
      </div>
      {expanded && (
        <div className="flex gap-4 mt-2.5 pt-2 border-t border-bone-400/40">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="flex items-center gap-1 text-xs text-forest-600 hover:text-forest-800 font-medium transition-colors"
          >
            <Pencil size={11} /> Redaguoti
          </button>
          <button
            onClick={e => { e.stopPropagation(); onChat() }}
            className="flex items-center gap-1 text-xs text-forest-500 hover:text-forest-700 font-medium transition-colors"
          >
            <MessageCircle size={11} /> Aptarti
          </button>
          <button
            onClick={e => { e.stopPropagation(); onShare() }}
            className="flex items-center gap-1 text-xs text-forest-500 hover:text-forest-700 font-medium transition-colors"
          >
            <Globe size={11} /> Į žinyną
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="flex items-center gap-1 text-xs text-terracotta-500 hover:text-terracotta-600 font-medium transition-colors ml-auto"
          >
            <Trash2 size={11} /> Ištrinti
          </button>
        </div>
      )}
    </motion.div>
  )
}

function mkNoteId() { return Math.random().toString(36).slice(2, 10) }
function noteToday() { return new Date().toISOString().slice(0, 10) }

// Migrate old komentaras string → array if uzrasai doesn't exist yet
function loadNotes(plant) {
  if (plant.uzrasai) return plant.uzrasai
  if (!plant.komentaras?.trim()) return []
  return plant.komentaras.split('\n\n')
    .map(t => t.trim()).filter(Boolean)
    .map(text => ({ id: mkNoteId(), text, starred: false, date: noteToday() }))
}

function NotesContent({ plant, onUzrasaiSave, onSaveToZinynas, onChatAbout }) {
  const [adding, setAdding]         = useState(false)
  const [newText, setNewText]       = useState('')
  const [expandedId, setExpanded]   = useState(null)
  const [editingId, setEditingId]   = useState(null)
  const [editText, setEditText]     = useState('')

  const notes = loadNotes(plant)
  const sorted = [...notes].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0))

  const persist = (arr) => onUzrasaiSave?.(plant.id, arr)

  const addNote = () => {
    const trimmed = newText.trim()
    if (!trimmed) return
    const note = { id: mkNoteId(), text: trimmed, starred: false, date: noteToday() }
    persist([note, ...notes])
    setNewText(''); setAdding(false)
  }

  const saveEdit = () => {
    const trimmed = editText.trim()
    if (!trimmed) return
    persist(notes.map(n => n.id === editingId ? { ...n, text: trimmed } : n))
    setEditingId(null)
  }

  const deleteNote = (id) => {
    persist(notes.filter(n => n.id !== id))
    setExpanded(null)
  }

  const toggleStar = (id) => {
    persist(notes.map(n => n.id === id ? { ...n, starred: !n.starred } : n))
  }

  return (
    <div className="px-5 py-5 space-y-2">
      {sorted.map(note =>
        editingId === note.id ? (
          <div key={note.id} className="space-y-2">
            <textarea
              className="w-full bg-surface rounded-2xl px-4 py-3 text-sm text-gray-800 outline-none resize-none border border-sage-200 transition-colors"
              rows={5} value={editText} onChange={e => setEditText(e.target.value)} autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setEditingId(null)}
                className="flex-1 py-2.5 rounded-2xl text-sm text-gray-500 bg-surface-2">Atšaukti</button>
              <button onClick={saveEdit} disabled={!editText.trim()}
                className="flex-1 py-2.5 rounded-2xl text-sm text-bone bg-forest-600 disabled:opacity-40">Išsaugoti</button>
            </div>
          </div>
        ) : (
          <NoteCard
            key={note.id}
            note={note}
            expanded={expandedId === note.id}
            onToggle={() => setExpanded(expandedId === note.id ? null : note.id)}
            onEdit={() => { setEditText(note.text); setEditingId(note.id); setExpanded(null) }}
            onDelete={() => deleteNote(note.id)}
            onToggleStar={() => toggleStar(note.id)}
            onChat={() => { onChatAbout?.(note.text); setExpanded(null) }}
            onShare={() => {
              onSaveToZinynas?.({ text: note.text, source: 'plant_note', plantId: plant.id, plantName: plant.lietuviškas || plant.lotyniskas })
              setExpanded(null)
            }}
          />
        )
      )}

      {adding ? (
        <div className="space-y-2">
          <textarea
            className="w-full bg-bone-50 rounded-2xl px-4 py-3 text-sm text-forest-700 placeholder-forest-400 outline-none resize-none border border-bone-400/40 focus:border-forest-400 transition-colors"
            rows={5} value={newText} onChange={e => setNewText(e.target.value)}
            placeholder="Nauja mintis..." autoFocus
          />
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setNewText('') }}
              className="flex-1 py-2.5 rounded-2xl text-sm text-forest-600 bg-bone-300/60">Atšaukti</button>
            <button onClick={addNote} disabled={!newText.trim()}
              className="flex-1 py-2.5 rounded-2xl text-sm font-bold text-bone bg-forest-600 disabled:opacity-40">Išsaugoti</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full py-3 rounded-2xl text-sm font-semibold text-forest-600 border border-bone-400/40 hover:bg-bone-300/40 transition-colors">
          + Pridėti mintį
        </button>
      )}

      {notes.length === 0 && !adding && (
        <p className="text-xs text-forest-500 text-center leading-relaxed px-4 pt-1">
          Išsaugokite stebėjimus arba mintį iš pokalbio su AI spausdami <Bookmark size={12} className="inline align-text-bottom mx-0.5" />
        </p>
      )}
    </div>
  )
}

// ── Tab bar ────────────────────────────────────────────────────

function TabBar({ active, onChange, noteCount = 0 }) {
  return (
    <div className="flex border-b border-bone-400/40 px-5 flex-shrink-0">
      {[
        { key: 'profile',  label: 'Augalas' },
        { key: 'timeline', label: 'Istorija' },
        { key: 'uzrasai',  label: 'Užrašai' },
      ].map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`relative py-3 mr-5 text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            active === tab.key ? 'text-sage-600' : 'text-gray-500'
          }`}
        >
          {tab.label}
          {tab.key === 'uzrasai' && noteCount > 0 && (
            <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ${
              active === tab.key ? 'bg-sage-100 text-sage-600' : 'bg-gray-100 text-gray-400'
            }`}>
              {noteCount}
            </span>
          )}
          {active === tab.key && (
            <motion.div
              layoutId="tab-underline"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-forest-600 rounded-full"
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

// ── Status transition sheets ───────────────────────────────────

function sheetDaysBetween(isoA, isoB) {
  return Math.round((new Date(isoA + 'T00:00:00') - new Date(isoB + 'T00:00:00')) / 86400000)
}

function computeRecoverySummary(timeline, fromStatus) {
  // Find most recent statusChange that started the sick/quarantine period
  const startEvent = timeline.find(e =>
    e.type === 'statusChange' && ['sick', 'quarantine'].includes(e.toStatus)
  )
  if (!startEvent) return null
  const startIdx = timeline.indexOf(startEvent)
  const today = new Date().toISOString().slice(0, 10)
  const days = sheetDaysBetween(today, startEvent.date)
  // Events during the period (between startEvent and now = indexes 0..startIdx-1)
  const during = timeline.slice(0, startIdx)
  const treatments = during.filter(e => e.type === 'treatment')
  return { days, treatments, startEvent }
}

function BottomSheet({ onClose, children }) {
  const dragControls = useDragControls()
  const y = useMotionValue(0)
  const handleDragEnd = (_, info) => {
    if (info.velocity.y > 400 || info.offset.y > 100) onClose()
    else animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 })
  }
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center">
      <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-[430px] bg-bone-50 rounded-t-4xl px-5 pb-8 pt-3"
        style={{ y }}
        drag="y" dragControls={dragControls} dragListener={false}
        dragConstraints={{ top: 0 }} dragElastic={{ top: 0, bottom: 0.25 }}
        onDragEnd={handleDragEnd}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      >
        <div onPointerDown={e => dragControls.start(e)}
          className="flex justify-center pb-3 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: 'none' }}>
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        {children}
      </motion.div>
    </div>
  )
}

function StatusTransitionSheet({ plant, newStatus, fromStatus, onConfirm, onQuarantine, onClose }) {
  const [disease, setDisease] = useState('')
  const [issue, setIssue]     = useState('')

  // Simple statuses that don't need a sheet — confirm immediately
  const isSickOrQ = s => s === 'sick' || s === 'quarantine'
  const skipSheet = newStatus === fromStatus || (newStatus === 'healthy' && !isSickOrQ(fromStatus))
  useEffect(() => { if (skipSheet) onConfirm({}) }, [skipSheet]) // eslint-disable-line
  if (skipSheet) return null

  // Returning to healthy from sick/quarantine
  if (newStatus === 'healthy' && (fromStatus === 'sick' || fromStatus === 'quarantine')) {
    const summary = computeRecoverySummary(plant.timeline ?? [], fromStatus)
    return (
      <BottomSheet onClose={onClose}>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-2">🎉</div>
            <h3 className="text-lg font-bold text-gray-900">
              {plant.lietuviškas} pasveiko!
            </h3>
            {summary && (
              <p className="text-sm text-gray-500 mt-1">
                Ligo {summary.days} {summary.days === 1 ? 'dieną' : 'dienas'}
              </p>
            )}
          </div>
          {summary?.treatments.length > 0 && (
            <div className="bg-surface rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Gydymo eiga</p>
              {summary.treatments.map((t, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-sm">💊</span>
                  <div>
                    {t.preparatas && <p className="text-xs font-medium text-gray-700">{t.preparatas}</p>}
                    {t.tikslas && <p className="text-xs text-gray-500">{t.tikslas}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {summary?.startEvent?.disease && (
            <div className="bg-green-50 rounded-2xl p-3">
              <p className="text-xs text-green-700">
                <span className="font-semibold">Liga:</span> {summary.startEvent.disease}
              </p>
            </div>
          )}
          <button onClick={() => onConfirm({})}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white bg-green-500">
            Puiku!
          </button>
        </div>
      </BottomSheet>
    )
  }

  // Switching to quarantine
  if (newStatus === 'quarantine') {
    return (
      <BottomSheet onClose={onClose}>
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Karantinas</h3>
            <p className="text-xs text-gray-500 mt-0.5">Augalas bus perkeltas į Reanimaciją</p>
          </div>
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <p className="text-sm text-red-700 leading-snug">
              Prieš tęsiant — patraukite augalą į atskirą vietą toli nuo kitų augalų.
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
              Įtariama liga ar priežastis
            </label>
            <input type="text" placeholder="pvz. erkutės, šaknų puvinys..."
              value={disease} onChange={e => setDisease(e.target.value)}
              className="w-full bg-surface rounded-2xl px-4 py-3 text-sm outline-none border border-transparent focus:border-red-200"
              autoFocus />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl text-sm font-medium text-gray-500 bg-surface-2">
              Atšaukti
            </button>
            <button onClick={() => onConfirm({ isolated: true, disease: disease.trim() })}
              className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white bg-red-500">
              Karantinuoju
            </button>
          </div>
        </div>
      </BottomSheet>
    )
  }

  // Switching to sick
  if (newStatus === 'sick') {
    return (
      <BottomSheet onClose={onClose}>
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Dėmesio</h3>
            <p className="text-xs text-gray-500 mt-0.5">Augalas bus perkeltas į Ligonius</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
              Kas per sutrikimas ar liga?
            </label>
            <input type="text" placeholder="pvz. dėmės ant lapų, kenkėjai..."
              value={issue} onChange={e => setIssue(e.target.value)}
              className="w-full bg-surface rounded-2xl px-4 py-3 text-sm outline-none border border-transparent focus:border-orange-200"
              autoFocus />
          </div>
          <button onClick={onQuarantine}
            className="w-full flex items-center justify-between px-4 py-3 bg-red-50 border border-red-200 rounded-2xl">
            <div className="flex items-center gap-2">
              <div className="text-left">
                <p className="text-xs font-bold text-red-700">Karantinuoti</p>
                <p className="text-[10px] text-red-400">Reikia izoliuoti nuo kitų augalų</p>
              </div>
            </div>
            <span className="text-red-300 text-xs">›</span>
          </button>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl text-sm font-medium text-gray-500 bg-surface-2">
              Atšaukti
            </button>
            <button onClick={() => onConfirm({ issue: issue.trim() })}
              className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white bg-orange-500">
              Pažymėti
            </button>
          </div>
        </div>
      </BottomSheet>
    )
  }

  // All other transitions — confirm silently
  return null
}

// ── Main component ─────────────────────────────────────────────

export default function PlantDetail({
  plant,
  section,
  onClose,
  onAction,
  onCommentSave,
  onUzrasaiSave,
  onStatusChange,
  onUpdateNames,
  onImageSave,
  onSaveChat,
  onSaveToZinynas,
  onAddTimelineEvent,
  onDeleteTimelineEvent,
  zones = [],
  onZoneChange,
  plants = [],
  onAddZone,
  onUpdateZone,
  onDeleteZone,
  onReorderZones,
  scrollToCare = false,
  visible = true,
  role = 'owner',
  isAdmin = false,
  collectionId = null,
}) {
  // Desktop split panel: render'inam į RightPanel'ą per createPortal,
  //   ne fullscreen overlay'ų. Mobile (<1024px) lieka kaip buvo.
  const isDesktop = useIsDesktop()
  const host = useDetailHost()
  const useDesktopPanel = isDesktop && !!host?.container

  // Desktop'e — atidarom/uždarom host'ą sekant `visible` flag (App.jsx
  // laiko PlantDetail mount'inta su lastDetailRef, todėl unmount įvyksta retai;
  // visible=false reiškia, kad uždaryta).
  useEffect(() => {
    if (!useDesktopPanel || !host) return
    if (!visible) return
    host.open()
    return () => host.close()
  }, [useDesktopPanel, visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const [activeTab, setActiveTab]           = useState('profile')
  const [timelineMode, setTimelineMode]     = useState('events') // 'events' | 'photos' — timeline filtras
  const [heroError, setHeroError]           = useState(false)
  const [heroCollapsed, setHeroCollapsed]   = useState(false)

  // 2026-06-01 — outer scope isEnriching derivation. Anksčiau hero render'yje
  // (line ~1929) buvo referencuojamas `isEnriching` iš ProfileContent vidinės
  // funkcijos scope'o → out-of-scope ReferenceError kai augalas neturi heroIllus
  // (e.g. Sansevieria pre-enrich). `!heroIllus` true → JS skaitydavo isEnriching
  // → crash. Su heroIllus → short-circuit. Dabar derive'iname outer scope'e ir
  // ProfileContent vis tiek turi savo lokalų (line 562) — nemodifikuojam ten.
  const outerEnrichmentState = getPlantEnrichmentState(plant)
  const outerIsEnriching = outerEnrichmentState === 'enriching'
  // Hero gallery cycling — naudoja plant.photos array'ą (discovery photos
  // iš search'o: Brave + iNat + Wikidata + Wikipedia). Resetinasi į 0 kai
  // pasikeičia plant.id (kitas augalas).
  const [heroPhotoIdx, setHeroPhotoIdx]     = useState(0)
  // 2026-06-02 — photo zoom modal'as, perkeltas iš PlantCard'o (kur dashboard
  // long-press dabar atveria CareWateringSheet). Long-press ant PlantDetail
  // hero foto → zoom view su full-screen image + close X.
  const [heroZoomed, setHeroZoomed]         = useState(false)
  const heroLongPressTimerRef               = useRef(null)
  const heroDidLongPressRef                 = useRef(false)
  const heroPressStartPosRef                = useRef(null)
  const onHeroPressStart = (e) => {
    heroDidLongPressRef.current = false
    heroPressStartPosRef.current = { x: e.clientX, y: e.clientY }
    heroLongPressTimerRef.current = setTimeout(() => {
      heroDidLongPressRef.current = true
      setHeroZoomed(true)
      navigator.vibrate?.(30)
    }, 450)
  }
  const onHeroPressMove = (e) => {
    if (!heroLongPressTimerRef.current) return
    const dx = e.clientX - (heroPressStartPosRef.current?.x ?? e.clientX)
    const dy = e.clientY - (heroPressStartPosRef.current?.y ?? e.clientY)
    if (dx * dx + dy * dy > 100) {
      clearTimeout(heroLongPressTimerRef.current)
      heroLongPressTimerRef.current = null
    }
  }
  const onHeroPressEnd = () => {
    clearTimeout(heroLongPressTimerRef.current)
    heroLongPressTimerRef.current = null
  }
  const [showPhotoSheet, setShowPhoto]      = useState(false)
  const [showChat, setShowChat]             = useState(false)
  const [chatInitialQuery, setChatQuery]    = useState('')
  const [showStatusMenu, setStatusMenu]     = useState(false)
  const [pendingStatus, setPendingStatus]   = useState(null) // { newStatus, fromStatus }
  const [addingType, setAddingType]         = useState(null)
  const [showZonePicker, setShowZonePicker] = useState(false)
  // Step 6s — action menu state'as (MoreHorizontal dropdown). Šitas
  // OUTER wrapper'is render'ina menu mygtuką + dropdown'ą, todėl state
  // turi gyventi čia (ne ProfileContent'e, kur prieš tai klaidingai
  // padariau — krašu „showActionMenu is not defined" runtime error'as).
  const [showActionMenu, setShowActionMenu] = useState(false)

  // 2026-06-01 — re-enrich helpers (reEnrichPlant + handleMenuReEnrich*)
  // PAŠALINTI. Funkcijos perkeltos į admin panel (LibraryEditorV2 sticky
  // toolbar). User-side action menu nebeturi AI re-enrich entry'ų. Retry
  // banner'is naudoja ProfileContent'o vidinį reEnrichPlant (line ~575),
  // kuris likęs failure-recovery atveju.

  // App.jsx laiko PlantDetail mount'intą per lastDetailRef (greitam reopen),
  // todėl sub-modal state'ai (ZonePicker, photo sheet, status menu) PERSIST'INA
  // tarp uždarymo / kito augalo atidarymo. Reset'inam, kai:
  //   - užsidaro (visible=false) — kad nebeliktų atviro sub-modal'o
  //   - keičiasi plantas (plant.id) — kad ne paveldėtų ankstesnio plant'o sub-state
  useEffect(() => {
    if (!visible) {
      setShowZonePicker(false)
      setShowPhoto(false)
      setStatusMenu(false)
      setShowChat(false)
      setPendingStatus(null)
      setAddingType(null)
    }
  }, [visible])

  useEffect(() => {
    setShowZonePicker(false)
    setShowPhoto(false)
    setStatusMenu(false)
    setShowChat(false)
    setPendingStatus(null)
    setAddingType(null)
  }, [plant.id])

  // ESC keyboard shortcut — uždaryti PlantDetail desktop'e. JEI atvertas sub-modal'as
  // ARBA fokusas ant input/textarea (name editing, notes editing) — praleidžiam,
  // kad input'o local ESC handler'is suveiktų pirmas.
  useEffect(() => {
    if (!useDesktopPanel || !visible) return
    const handler = (e) => {
      if (e.key !== 'Escape') return
      const subModalOpen = showZonePicker || showPhotoSheet || showStatusMenu
        || showChat || pendingStatus || addingType
      if (subModalOpen) return
      const a = document.activeElement
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return
      onClose?.()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [useDesktopPanel, visible, showZonePicker, showPhotoSheet, showStatusMenu, showChat, pendingStatus, addingType, onClose])

  const status                              = plant.status ?? 'healthy'
  const currentZone                         = zones.find(z => z.id === plant.zonaId) ?? null
  const mood                            = getPlantMood(plant)
  const fetchedRef                      = useRef(false)
  const scrollContainerRef              = useRef(null)

  // Augalo paso įjungimas/išjungimas
  const togglePassport = async (p, enabled) => {
    onUpdateNames?.(p.id, { isPublic: enabled })
    if (enabled && collectionId) {
      const tl = p.timeline ?? []
      const lastWatered    = tl.find(e => e.type === 'watering')?.date    ?? null
      const lastFertilized = tl.find(e => e.type === 'fertilizing')?.date ?? null
      await setDoc(doc(db, 'plant-passports', p.id), {
        collectionId,
        isPublic: true,
        snapshot: {
          lotyniskas:           p.lotyniskas   ?? null,
          lietuviškas:          p.lietuviškas  ?? null,
          emoji:                p.emoji        ?? null,
          image:                p.image        ?? null,
          sviesa:               p.sviesa       ?? null,
          vanduo:               p.vanduo       ?? null,
          laistymasIntervalas:  p.laistymasIntervalas ?? null,
          aprasymas:            p.aprasymas    ?? null,
          kilme:                p.kilme        ?? null,
          lastWatered,
          lastFertilized,
        },
        updatedAt: new Date().toISOString(),
      }, { merge: true })
    } else {
      await setDoc(doc(db, 'plant-passports', p.id), { isPublic: false }, { merge: true })
    }
  }

  useEffect(() => {
    if (!scrollToCare) return
    const t = setTimeout(() => {
      const el = scrollContainerRef.current
      if (!el) return
      const target = el.querySelector('#prieziura-section')
      if (target) el.scrollTo({ top: target.offsetTop - 12, behavior: 'smooth' })
    }, 120)
    return () => clearTimeout(t)
  }, [scrollToCare, plant.id])

  // Hero collapse — kai vartotojas scroll'ina content'ą per ~60px, foto/chart
  // hero zona susikrečia iš aspect-3/2 į aspect-3/1 (atlaisvina ~33% teksto
  // erdvės). Hysteresis (40/60) saugo nuo flickering'o ties threshold'u.
  // requestAnimationFrame'as taupo paint'us — scroll event veikia <16ms.
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    let raf = null
    const handler = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = null
        const y = el.scrollTop
        setHeroCollapsed(prev => prev ? y > 40 : y > 60)
      })
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => {
      el.removeEventListener('scroll', handler)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [activeTab])

  // Reset hero photo index kai pasikeičia augalas (per portalą)
  useEffect(() => { setHeroPhotoIdx(0) }, [plant.id])

  // Tab switch ARBA augalo pakeitimas resetuoja scroll į viršų → expand'ina
  // hero atgal. Skip jei scrollToCare aktyvus — ten dedicated useEffect
  // (aukščiau) smooth'iai scroll'ina į priežiūros sekciją, nereikia pirma
  // flick'inti top'o.
  useEffect(() => {
    if (scrollToCare) return
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollTop = 0
    setHeroCollapsed(false)
  }, [activeTab, plant.id, scrollToCare])

  // Fetch iNaturalist names if not yet fetched for this plant
  useEffect(() => {
    if (fetchedRef.current) return
    if (!plant.lotyniskas) return
    // Re-fetch if never fetched, or fetched with old schema (missing wikiLtFound)
    if (plant.inatFetched && plant.wikiLtFound !== undefined) return
    fetchedRef.current = true
    console.log('[plantNames] fetching for:', plant.lotyniskas)
    fetchPlantNames(plant.lotyniskas).then(data => {
      onUpdateNames?.(plant.id, {
        inatFetched:  true,
        inatTaxonId:  data?.inatTaxonId  ?? null,
        wikiLtFound:  data?.wikiLtFound  ?? false,
        wikiEnFound:  data?.wikiEnFound  ?? false,
        inatLtName:   data?.inatLtName   ?? null,
        sinonimai:    data?.sinonimai    ?? [],
        englishNames: data?.englishNames ?? [],
      })
    })
  }, [plant.id, plant.lotyniskas]) // eslint-disable-line react-hooks/exhaustive-deps

  const dragControls = useDragControls()
  const y = useMotionValue(0)

  const handleDragEnd = (_, info) => {
    if (info.velocity.y > 400 || info.offset.y > 120) {
      onClose()
    } else {
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 })
    }
  }

  const tree = (
    <div
      className={useDesktopPanel
        ? "absolute inset-0 flex flex-col"
        : "fixed inset-0 z-[70] flex items-end justify-center"}
      style={useDesktopPanel ? undefined : { pointerEvents: visible ? '' : 'none' }}
    >
      {/* Backdrop — tik mobile; desktop'e panel pati yra "modal" konteineris */}
      {!useDesktopPanel && (
        <motion.div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: visible ? 1 : 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        />
      )}

      {/* Sheet — abi platformos glass (Tier 3 frost), isolation izoliuoja
          stacking context'ą kad backdrop-blur recomputes nelistų į page paint. */}
      <motion.div
        className={useDesktopPanel
          ? "relative w-full h-full bg-bone-50 flex flex-col isolate"
          : "relative w-full max-w-[430px] bg-bone-50 flex flex-col isolate"}
        style={useDesktopPanel ? { height: '100%' } : { height: '100dvh', y }}
        {...(useDesktopPanel ? {
          // Desktop'e — slide iš dešinės (panel'ėje atrodo, kaip kad kortelė
          // įvažiuotų iš ekrano krašto). Be drag, be dynamiško y.
          initial: { x: '100%' },
          animate: { x: visible ? 0 : '100%' },
          transition: { type: 'spring', damping: 32, stiffness: 320 },
        } : {
          drag: 'y',
          dragControls,
          dragListener: false,
          dragConstraints: { top: 0 },
          dragElastic: { top: 0, bottom: 0.25 },
          onDragEnd: handleDragEnd,
          initial: { y: '100%' },
          animate: { y: visible ? 0 : '100%' },
          transition: { type: 'spring', damping: 32, stiffness: 320 },
        })}
      >
        {/* Drag handle — tik mobile; desktop'e nereikia (uždarom per X mygtuką) */}
        {!useDesktopPanel && (
          <div className="absolute top-0 left-0 right-0 z-20 flex justify-center pb-2 pointer-events-none select-none" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
            <div
              onPointerDown={e => dragControls.start(e)}
              className="px-8 py-1 cursor-grab active:cursor-grabbing pointer-events-auto"
              style={{ touchAction: 'none' }}
            >
              <div className="w-10 h-1 bg-black/15 rounded-full" />
            </div>
          </div>
        )}

        {/* ── Hero — minimal: toolbar (su zone+status inline) + photo. Title
            blokas perkeltas į „Augalas" tab content scrollable area. ── */}
        <div className="flex-shrink-0">
          {/* Toolbar — zone + status inline mono caps, X dešinėje */}
          <div
            className="flex items-center gap-3 px-4 pb-2"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
          >
            <div className="relative">
              <button
                onClick={() => setShowActionMenu(v => !v)}
                className="flex items-center justify-center text-forest-400 active:text-forest-700 transition-colors px-1 py-2 flex-shrink-0"
                aria-label="Veiksmai"
              >
                <MoreHorizontal size={20} />
              </button>
              {/* Step 6s — Action menu (dropdown'as analogiškas StatusMenu).
                  Šiandien turi: pakeisti nuotrauką + re-enrich. Ateityje gali
                  būti pridėta: eksportas, share, delete, etc. */}
              {showActionMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowActionMenu(false)} />
                  <div className="absolute left-0 top-full mt-2 bg-bone rounded-2xl shadow-[0_12px_32px_rgba(28,58,42,0.18)] border border-bone-400/50 overflow-hidden z-[200] min-w-[220px]">
                    <p className="font-mono text-[9.5px] font-medium text-forest-500 uppercase tracking-[0.18em] px-3 pt-2.5 pb-1.5">Veiksmai</p>
                    <div className="px-1 pb-1 space-y-px">
                      {/* 2026-06-01 — Zone + Status entries pašalinti. Abu chip'ai
                          dabar visada matomi toolbar'yje (zone su „Nepriskirta"
                          placeholder, status visada), tad ... menu dublikatas
                          nereikalingas. */}
                      {/* 2026-06-01 — user-side AI update actions PAŠALINTOS.
                          „Atnaujinti AI duomenis", „Atnaujinti tik tekstą",
                          „Atnaujinti paveikslėlį" perkeltos į admin panel
                          (LibraryEditorV2). User'iai nebenori manual AI
                          re-enrich'o — catalog overlay (F1) auto-propagate'ina
                          admin'o atnaujinimus visiems. Liko TIK „Pakeisti
                          nuotrauką" (asmeninė foto, ne AI). */}
                      <button
                        onClick={() => { setShowActionMenu(false); setShowPhoto(true) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-forest-600 hover:bg-bone-300/60 transition-colors"
                      >
                        <Camera size={14} className="flex-shrink-0" />
                        <span className="font-display text-sm font-semibold tracking-tight">Pakeisti nuotrauką</span>
                      </button>
                      {/* 2026-06-02 — sekundariniai veiksmai (Dublikuoti, Ištrinti)
                          perkelti iš content'o į „..." meniu (iOS pattern, švaresnės
                          kortelės). Dublikuoti tik auginama (naujas egzempliorius). */}
                      {section === 'auginama' && (
                        <button
                          onClick={() => { setShowActionMenu(false); onAction?.('duplicate', plant) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-forest-600 hover:bg-bone-300/60 transition-colors"
                        >
                          <Copy size={14} className="flex-shrink-0" />
                          <span className="font-display text-sm font-semibold tracking-tight">Dublikuoti</span>
                        </button>
                      )}
                      <button
                        onClick={() => { setShowActionMenu(false); onAction?.('delete', plant) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-terracotta-500 hover:bg-terracotta-50 transition-colors"
                      >
                        <Trash2 size={14} className="flex-shrink-0" />
                        <span className="font-display text-sm font-semibold tracking-tight">Ištrinti</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Zone — clickable, atidaro ZonePicker.
                2026-06-01: VISADA matomas (kaip ir status chip), su „Nepriskirta"
                placeholder'iu kai zonos nepriskirta. Visual TODO indikatorius +
                visada visible access path'as (... menu „Priskirti zoną" entry
                nebereikalingas). */}
            {section === 'auginama' && zones.length > 0 && (
              <button
                onClick={() => setShowZonePicker(v => !v)}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500 hover:text-forest-700 transition-colors min-w-0"
              >
                <MapPin size={11} className="text-forest-400 flex-shrink-0" />
                <span className="truncate">{currentZone ? currentZone.name : 'Nepriskirta'}</span>
              </button>
            )}

            {section === 'auginama' && zones.length > 0 && (
              <span className="text-forest-300 flex-shrink-0" aria-hidden>·</span>
            )}

            {/* Status — clickable, atidaro StatusMenu (dropdown).
                2026-06-01: status chip'as VISADA matomas (net 'healthy' state'e),
                kad būtų aiškus glance reference + dropdown'o anchor'as visada
                egzistuoja. Zone chip default-hide lieka (Nepriskirta = placeholder),
                bet status (Sveikas/Dėmesio/Karantinas/Numirė) nešioja realią
                semantinę informaciją — visada verta rodyti. */}
            {section === 'auginama' && (
              <div className="relative">
                <button
                  onClick={() => setStatusMenu(v => !v)}
                  className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] transition-colors ${
                    status === 'quarantine' || status === 'sick'
                      ? 'text-terracotta-600 hover:text-terracotta-700'
                      : status === 'numire'
                        ? 'text-forest-800 hover:text-forest-900'
                        : 'text-forest-600 hover:text-forest-700'
                  }`}
                >
                  {(() => {
                    const StatusIcon = STATUS_ICON[status]
                    return StatusIcon ? <StatusIcon size={11} /> : null
                  })()}
                  <span>{getStatusMeta(status).label}</span>
                  <ChevronDown size={10} className="opacity-60" />
                </button>
                {showStatusMenu && (
                  <StatusMenu
                    status={status}
                    section={section}
                    onClose={() => setStatusMenu(false)}
                    onSelect={key => {
                      setStatusMenu(false)
                      if (key === 'numire') { onAction?.('died', plant); onClose?.() }
                      else setPendingStatus({ newStatus: key, fromStatus: status })
                    }}
                  />
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="ml-auto w-10 h-10 bg-bone-300/60 hover:bg-bone-400/60 rounded-btn flex items-center justify-center text-forest-700 transition-colors flex-shrink-0"
              aria-label="Uždaryti"
            >
              <X size={16} />
            </button>
          </div>

          {/* Hero zone — Istorija tab'as automatiškai rodo BarcodeLifeline vietoj
              nuotraukos. Kitose tab'ose — clean foto. Hero collapse'inasi
              scroll'inant content'ą (aspect 3/2 → 3/1, atlaisvina vietos tekstui).
              motion.div animuoja `aspectRatio` smooth'iai (Framer interpoliuoja
              numeric ratio reikšmę). */}
          <motion.div
            className="w-full overflow-hidden"
            initial={false}
            animate={{ aspectRatio: heroCollapsed ? '3 / 1' : '3 / 2' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {(() => {
              if (activeTab === 'timeline') {
                return (
                  <div className="w-full h-full">
                    <BarcodeLifeline events={plant.timeline ?? []} />
                  </div>
                )
              }
              // Gallery — watercolor iliustracija PIRMA tik kai ji yra default
              // šitam augalui (stock catalog foto / be foto). Jei user turi
              // NUOSAVĄ foto (užrakintą ar asmeninę) — ji PIRMA, iliustracija
              // prieinama „sekanti" strėlyte. Iliustracija = transparent PNG,
              // render'inama ant cream bg (object-contain), real foto = cover.
              const heroIllus = heroIllustrationFor(plant.lotyniskas)
              const heroDefault = !!heroIllus && heroIsDefaultFor(plant)
              // 2026-06-01: kol watercolor dar piešiamas Phase 2 Gemini'u
              // (~20-40s), ant hero foto rodom subtle loading badge'ą.
              // Vėliau pakeisim tinkama animacija per atskirą polish sprint'ą.
              const heroIllusLoading = !heroIllus && outerIsEnriching
              const gallery = (heroDefault
                ? [heroIllus, plant.image, ...(plant.photos ?? [])]
                : [plant.image, heroIllus, ...(plant.photos ?? [])])
                .filter(Boolean)
                .filter((u, i, a) => a.indexOf(u) === i)
              const hasGallery = gallery.length > 1
              const currentPhoto = gallery[heroPhotoIdx] ?? gallery[0] ?? plant.image
              const isIllustration = currentPhoto === heroIllus
              // 2026-06-02 — thumbUrl detail hero'ui: cached grid thumb rodom IŠKART
              // (progressive LQIP PlantImage'e), full swap'inasi → jokio „pop" po
              // kortelės atidarymo. Watercolor → heroThumb; user foto → imageThumb.
              const currentThumb = isIllustration
                ? heroThumbFor(plant.lotyniskas)
                : (currentPhoto === plant.image ? (plant.imageThumb ?? null) : null)

              if (!currentPhoto) {
                return (
                  <div className="w-full h-full flex items-center justify-center text-8xl bg-bone-300">
                    {plant.emoji ?? '🌿'}
                  </div>
                )
              }
              // Navigacija resetina heroError — kad sugedusi foto (pvz. dead
              // Brave URL galerijoje) NEužstrigtų: rodyklės LIEKA, placeholder
              // rodomas hero viduje, user gali nueiti toliau.
              const goPhoto = (delta) => { setHeroError(false); setHeroPhotoIdx(i => Math.max(0, Math.min(gallery.length - 1, i + delta))) }
              return (
                <div className={`block w-full h-full overflow-hidden relative ${isIllustration ? '' : 'bg-bone-300'}`}
                     style={isIllustration ? { background: '#fefdfa' } : undefined}
                     onPointerDown={onHeroPressStart}
                     onPointerMove={onHeroPressMove}
                     onPointerUp={onHeroPressEnd}
                     onPointerCancel={onHeroPressEnd}>
                  {heroError ? (
                    <div className="w-full h-full flex items-center justify-center text-8xl bg-bone-300">
                      {plant.emoji ?? '🌿'}
                    </div>
                  ) : (
                    // 2026-06-02 — key={object-fit režimas}, NE key={currentPhoto}.
                    // key={currentPhoto} (pašalintas 2026-06-01) flicker'indavo
                    // KIEKVIENĄ galerijos cycle'ą. Bet BE jokio key, kai pridedi foto
                    // (watercolor→foto), SWR rodo SENĄ watercolor su NAUJU object-cover
                    // className → watercolor apkarpomas, bg patamsėja („tarp layerių").
                    // key={isIllustration} remount'ina TIK toggle'inant illus↔foto
                    // (švarus object-fit), o cyclining tarp foto lieka sklandus (SWR).
                    <PlantImage
                      key={isIllustration ? 'illus' : 'photo'}
                      url={currentPhoto} thumbUrl={currentThumb} alt={plant.lietuviškas} size="detail" eager
                      className={`w-full h-full ${isIllustration ? 'object-contain' : 'object-cover'}`}
                      onError={() => setHeroError(true)}
                    />
                  )}

                  {/* ── Camera quick action (bottom-left) ────────────────────
                      2026-06-01 — tiesioginis „add to history" flow'as:
                      device camera → resize → addTimelineEvent({type:'photo'}).
                      Jei useHistoryPhoto !== false (default), nauja foto auto-
                      becomes hero per addTimelineEvent logiką (žr. usePlants.js
                      line 577). NEatidarom „Pakeisti nuotrauką" sheet'o —
                      vienas tap = vienas snap = istorijos event'as + hero
                      automatiškai atsinaujins. Pilną sheet flow'ą lieka ...
                      menu „Pakeisti nuotrauką" — kai user nori EXPLICIT
                      replace, ne add-to-history. */}
                  {section === 'auginama' && (
                    <label
                      className="absolute bottom-3 left-3 w-10 h-10 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md flex items-center justify-center text-white transition-colors z-10 cursor-pointer"
                      aria-label="Pridėti nuotrauką į istoriją"
                    >
                      <Camera size={16} />
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0]
                          e.target.value = ''
                          if (!file) return
                          try {
                            const imageUrl = await resizeImage(file)
                            onAddTimelineEvent?.(plant.id, {
                              id: makeId(),
                              type: 'photo',
                              date: today(),
                              imageUrl,
                            })
                          } catch (err) {
                            console.warn('[hero-camera] failed', err)
                          }
                        }}
                      />
                    </label>
                  )}

                  {/* Watercolor loading badge — kol Gemini piešia iliustraciją
                      (Phase 2 enrichment), rodom subtle pill apačioje. Vartotojas
                      žino, kad watercolor ateis netrukus. Animacija — vėliau. */}
                  {heroIllusLoading && !heroError && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/45 backdrop-blur-md rounded-full px-3 py-1.5 inline-flex items-center gap-1.5 text-bone text-[11px] font-mono uppercase tracking-[0.14em] pointer-events-none">
                      <Loader2 size={11} className="animate-spin" strokeWidth={2.5} />
                      Piešiu iliustraciją...
                    </div>
                  )}
                  {hasGallery && (
                    <>
                      <button
                        onClick={() => goPhoto(-1)}
                        disabled={heroPhotoIdx === 0}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-sm text-white flex items-center justify-center disabled:opacity-30 transition"
                        aria-label="Ankstesnė nuotrauka"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() => goPhoto(1)}
                        disabled={heroPhotoIdx >= gallery.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-sm text-white flex items-center justify-center disabled:opacity-30 transition"
                        aria-label="Kita nuotrauka"
                      >
                        <ChevronRight size={16} />
                      </button>
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/45 backdrop-blur-sm">
                        <span className="text-[11px] text-white/90 font-medium">{heroPhotoIdx + 1} / {gallery.length}</span>
                      </div>
                    </>
                  )}
                </div>
              )
            })()}
          </motion.div>
        </div>

        {/* Safety strip — kompaktinis savybes summary tarp hero + tab bar
            (2026-06-01). Rodom tik kai yra duomenų (pavojai / valgomumas /
            vaistinis). Brand new plant'uose dingsta automatiškai. */}
        <HeroSafetyStrip plant={plant} section={section} />

        {/* Tab bar */}
        <TabBar active={activeTab} onChange={setActiveTab} noteCount={loadNotes(plant).length} />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-none relative" ref={scrollContainerRef}>
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
              >
                <ProfileContent
                  plant={plant}
                  section={section}
                  onAction={onAction}
                  onClose={onClose}
                  collectionId={collectionId}
                  onTogglePassport={role !== 'viewer' && role !== 'member' ? togglePassport : null}
                  onUpdateNames={onUpdateNames}
                />
              </motion.div>
            )}
            {activeTab === 'timeline' && (
              <motion.div
                key="timeline"
                className="relative h-full"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
              >
                <PlantTimeline
                  plant={plant}
                  mode={timelineMode}
                  onModeChange={setTimelineMode}
                  onAddEvent={event => onAddTimelineEvent?.(plant.id, event)}
                  onDeleteEvent={eventId => onDeleteTimelineEvent?.(plant.id, eventId)}
                  onSetAsProfilePhoto={url => onImageSave?.(plant.id, url)}
                  zones={zones}
                />
              </motion.div>
            )}
            {activeTab === 'uzrasai' && (
              <motion.div
                key="uzrasai"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
              >
                <NotesContent
                  plant={plant}
                  onUzrasaiSave={onUzrasaiSave}
                  onSaveToZinynas={onSaveToZinynas}
                  onChatAbout={(text) => { setChatQuery(text); setShowChat(true) }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating AI bubble — bottom-left, profile tab only, not for viewers */}
        {section === 'auginama' && activeTab === 'profile' && role !== 'viewer' && (
          <button
            onClick={() => setShowChat(true)}
            className="absolute bottom-5 right-4 z-20 active:scale-90 transition-transform"
          >
            <div className="animate-idle-float">
              <PlantAvatar mood={mood.mood} size={70} />
            </div>
          </button>
        )}

        {/* Timeline FAB — bottom-right, timeline tab only, not for dead plants */}
        {activeTab === 'timeline' && section !== 'istorija' && (
          <FAB onSelect={type => setAddingType(type)} />
        )}

        {/* Add event sheet */}
        <AnimatePresence>
          {addingType && (
            <AddEventSheet
              key="add-sheet"
              type={addingType}
              onSave={event => onAddTimelineEvent?.(plant.id, event)}
              onClose={() => setAddingType(null)}
            />
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showPhotoSheet && (
          <PhotoSheet
            key="photo-sheet"
            plant={plant}
            onClose={() => setShowPhoto(false)}
            onSave={(url, fromHistory = false, thumb = null) => { onImageSave?.(plant.id, url, fromHistory, thumb); setShowPhoto(false) }}
            onCapture={async file => {
              // Capture → timeline (istorija). Jei „Auto", tampa profiliu (addTimelineEvent sync).
              try {
                const imageUrl = await resizeImage(file)
                onAddTimelineEvent?.(plant.id, { id: makeId(), type: 'photo', date: today(), imageUrl })
              } catch (err) { console.warn('[photo-capture] failed', err) }
            }}
            onRevert={() => onUpdateNames?.(plant.id, { image: null, imageThumb: null, useHistoryPhoto: false })}
            onToggleHistoryPhoto={() => onUpdateNames?.(plant.id, { useHistoryPhoto: plant.useHistoryPhoto !== false ? false : true })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChat && (
          <PlantChat
            key={`plant-chat-${chatInitialQuery}`}
            plant={plant}
            onClose={() => { setShowChat(false); setChatQuery('') }}
            initialQuery={chatInitialQuery}
            onSaveChat={onSaveChat}
            onSaveNote={(text) => {
              const newNote = { id: mkNoteId(), text, starred: false, date: noteToday() }
              const existing = loadNotes(plant)
              onUzrasaiSave?.(plant.id, [newNote, ...existing])
            }}
            desktopPopover={useDesktopPanel}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showZonePicker && (
          <ZonePicker
            key="zone-picker"
            zones={zones}
            plants={plants}
            currentZoneId={plant.zonaId}
            onSelect={zonaId => onZoneChange?.(plant.id, zonaId)}
            onClose={() => setShowZonePicker(false)}
            onAddZone={onAddZone}
            onUpdateZone={onUpdateZone}
            onDeleteZone={onDeleteZone}
            onReorderZones={onReorderZones}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingStatus && (
          <StatusTransitionSheet
            key="status-sheet"
            plant={plant}
            newStatus={pendingStatus.newStatus}
            fromStatus={pendingStatus.fromStatus}
            onConfirm={(meta) => {
              onStatusChange?.(plant.id, pendingStatus.newStatus, meta)
              setPendingStatus(null)
            }}
            onQuarantine={() => {
              setPendingStatus({ newStatus: 'quarantine', fromStatus: pendingStatus.fromStatus })
            }}
            onClose={() => setPendingStatus(null)}
          />
        )}
      </AnimatePresence>

      {/* 2026-06-02 — Photo zoom portal. Long-press ant hero foto → atveria
          full-screen zoom view. Anksčiau gyveno PlantCard'e (dashboard
          long-press), perkeltas čia, kai PlantCard'o long-press tapo
          „atverti CareWateringSheet". Retas use case'as bet retoms reikia. */}
      {createPortal(
        <AnimatePresence>
          {heroZoomed && (
            <motion.div
              className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/95"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onPointerDown={() => setHeroZoomed(false)}
            >
              <motion.img
                src={plant.image || plant.heroIllustration}
                alt={plant.lietuviškas}
                className="max-w-full max-h-[80dvh] object-contain pointer-events-none select-none"
                style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.88, opacity: 0 }}
                transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              />
              <div className="absolute bottom-16 left-0 right-0 text-center px-6 pointer-events-none">
                <p className="text-white font-bold text-base leading-tight">{plant.lietuviškas}</p>
                {plant.lotyniskas && <p className="text-white/50 text-sm italic mt-0.5">{plant.lotyniskas}</p>}
              </div>
              <button
                className="absolute top-14 right-4 w-9 h-9 rounded-btn bg-white/10 flex items-center justify-center"
                onPointerDown={e => { e.stopPropagation(); setHeroZoomed(false) }}
              >
                <X size={16} className="text-white" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )

  if (useDesktopPanel) {
    if (!visible) return null
    return createPortal(tree, host.container)
  }
  return tree
}
