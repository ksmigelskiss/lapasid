import { useState } from 'react'
import { Sun, Droplets, Thermometer, Wind, Flower2, RefreshCw, Leaf, Snowflake, MapPin, Share2, Copy, Check, Link2 } from 'lucide-react'
import { doc, setDoc } from 'firebase/firestore'
import { db, auth } from '../../utils/firebase'
import PlantImage from '../brand/PlantImage'
import PlantSavybesPills, { PlantSafetyCallout } from '../brand/PlantSavybesPills'
import BrandLoader from '../brand/BrandLoader'
import { ensureArray } from '../../utils/plantTransform'
import { getPlantEnrichmentState, getEnrichmentFailureReason } from '../../utils/plantState'
import { getFertilizingSummary } from '../../utils/fertilizingForecast'
import { WateringCard, FertilizingCard, DormancyCard } from '../ForecastCards'

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
