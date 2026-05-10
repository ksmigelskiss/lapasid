import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useDetailHost } from '../contexts/DetailHostContext'
import { ArrowLeft, Search, X, Camera, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchPhotos, resizeImage } from '../utils/imageService'
import { fetchPlantNames } from '../utils/plantNames'
import { fromAIResult } from '../hooks/usePlants'
import { getCatalogEntry, saveToCatalog } from '../utils/catalog'
import { ProfileContent } from './PlantDetail'
import { auth } from '../utils/firebase'
import PaywallSheet from './PaywallSheet'

// Calls server-side proxy — Anthropic API key never in browser
// Throws { code: 'limit_reached', limitType } when free tier is exhausted
async function claudeCall(body) {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null)
  const headers = { 'Content-Type': 'application/json' }
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`

  const res = await fetch('/api/claude', {
    method:  'POST',
    headers,
    body:    JSON.stringify({ ...body, limitType: 'searches' }),
  })

  if (res.status === 403) {
    const err = await res.json().catch(() => ({}))
    if (err.error === 'limit_reached') {
      const e = new Error('limit_reached')
      e.code = 'limit_reached'
      e.limitType = err.limitType ?? 'searches'
      throw e
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Phase 1: fast preview (name, stats, description, facts) ──────
const TOOL_PREVIEW = {
  name: 'plant_preview',
  description: 'Pateik pagrindinę augalo informaciją greitai.',
  input_schema: {
    type: 'object',
    properties: {
      name:            { type: 'string',  description: 'Tikras lietuviškas pavadinimas. NIEKADA angliškas ar lotyniškas.' },
      latinName:       { type: 'string',  description: 'Tikslus lotyniškas pavadinimas' },
      emoji:           { type: 'string',  description: 'Vienas emoji' },
      tipas:           { type: 'string',  description: 'Augalo tipas (pvz. Sultingas, Tropinis daugiametis...)' },
      augimo_greitis:  { type: 'string',  enum: ['lėtas', 'vidutinis', 'greitas'] },
      sunkumas:        { type: 'integer', minimum: 1, maximum: 5 },
      toksiskas:       { type: 'boolean' },
      toksiskumo_info: { type: ['string', 'null'] },
      aprasymas:       { type: 'string',  description: '4-6 sakinių aprašymas — kilmė, išvaizda, kodėl populiarus' },
      kilme:           { type: 'string' },
      sviesa: {
        type: 'object',
        properties: {
          taskai: { type: 'integer', minimum: 1, maximum: 3 },
          lygis:  { type: 'string', enum: ['žema', 'vidutinė', 'ryški'] },
          ppfd:   { type: 'object', properties: { min: { type: 'integer' }, max: { type: 'integer' } }, required: ['min', 'max'] },
        },
        required: ['taskai', 'lygis', 'ppfd'],
      },
      vanduo: {
        type: 'object',
        properties: {
          taskai: { type: 'integer', minimum: 1, maximum: 3 },
          lygis:  { type: 'string', enum: ['mažai', 'vidutiniškai', 'daug'] },
        },
        required: ['taskai', 'lygis'],
      },
      idomybes: { type: 'array', items: { type: 'string' }, description: '2-3 įdomūs faktai' },
    },
    required: ['name', 'latinName', 'emoji', 'tipas', 'augimo_greitis', 'sunkumas',
               'toksiskas', 'aprasymas', 'kilme', 'sviesa', 'vanduo', 'idomybes'],
  },
}

// ── Phase 2: full details (care, watering, problems, etc.) ────────
const TOOL_DETAILS = {
  name: 'plant_details',
  description: 'Pateik išsamią augalo priežiūros informaciją.',
  input_schema: {
    type: 'object',
    properties: {
      laistymasIntervalas: {
        type: 'object',
        properties: {
          vasara:  { type: 'integer' },
          ziema:   { type: ['integer', 'null'] },
          metodas: { type: 'string' },
        },
        required: ['vasara', 'ziema', 'metodas'],
      },
      tresimas: {
        type: 'object',
        properties: {
          intervalVasara: { type: 'integer' },
          intervalZiema:  { type: ['integer', 'null'] },
          tipas:          { type: 'string' },
        },
        required: ['intervalVasara', 'intervalZiema', 'tipas'],
      },
      dormancyInfo: {
        type: 'object',
        properties: {
          reikia: { type: 'boolean' },
          tipas:  { enum: ['full', 'partial', null] },
        },
        required: ['reikia', 'tipas'],
      },
      prieziura: {
        type: 'object',
        properties: {
          sviesa:      { type: 'string' },
          laistymas:   { type: 'string' },
          temperatura: { type: 'string' },
          dregme:      { type: 'string' },
        },
        required: ['sviesa', 'laistymas', 'temperatura', 'dregme'],
      },
      substratas:   { type: 'string' },
      persodinimas: { type: 'string' },
      ziemojimas:   { type: 'string' },
      dauginimas:   { type: 'array', items: { type: 'string' } },
      problemos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            simptomas:  { type: 'string' },
            priezastis: { type: 'string' },
            sprendimas: { type: 'string' },
          },
          required: ['simptomas', 'priezastis', 'sprendimas'],
        },
      },
    },
    required: ['laistymasIntervalas', 'tresimas', 'dormancyInfo', 'prieziura',
               'substratas', 'persodinimas', 'ziemojimas', 'dauginimas', 'problemos'],
  },
}

const PLANT_SYSTEM = `Esi augalų ekspertas. Visada ieškok tiksliai nurodyto augalo.

SVARBU — laukas "name": PRIVALO būti tikras lietuviškas pavadinimas (žodynas/Vikipedija). NIEKADA lotyniškas ar angliškas. Hibridams be atskiro pavadinimo — naudok genties lietuvišką (pvz. Nepenthes → "Ąsotenė").

Nuotraukų atpažinimas: identifikuok TIK pagrindinį nuotraukos augalą — tą, kuris užima daugiausiai kadro arba yra fokuse. Visiškai ignoruok fone ar šonuose matomus kitus augalus. Aprašyme ir visuose laukuose rašyk tik apie pagrindinį augalą.

Šviesa: taskai 1 (žema) 50–150 μmol/m²/s; 2 (vidutinė) 150–400; 3 (ryški) 400–2000
Vanduo: 1 (mažai) sultingi; 2 (vidutiniškai) tropiniai; 3 (daug) paparčiai
Laistymas (dienomis): sultingi vasara 14–21, vidutiniai 7–14, paparčiai 3–7`



async function fetchDetails(latinName, name) {
  // Pirma tikriname katalogą — jei jau yra priežiūros duomenys, nemokami
  const cached = await getCatalogEntry(latinName)
  if (cached?.laistymasIntervalas) {
    // Grąžiname tik priežiūros duomenis — ne nuotrauką (kiekvienas vartotojas gauna savą iš iNaturalist)
    const { image: _img, updatedAt: _ts, lotyniskas: _lt, lietuviškas: _liet, ...careData } = cached
    return careData
  }

  const r = await claudeCall({
    maxTokens:  2048,
    system:     PLANT_SYSTEM,
    tools:      [TOOL_DETAILS],
    toolChoice: { type: 'tool', name: 'plant_details' },
    messages:   [{ role: 'user', content: `Pateik išsamią priežiūros informaciją apie augalą "${latinName}" (${name}).` }],
  })
  const block   = r.content.find(b => b.type === 'tool_use' && b.name === 'plant_details')
  const details = block?.input ?? {}

  // Išsaugome į katalogą — kitas vartotojas gaus iš cache
  if (details.laistymasIntervalas) {
    saveToCatalog({ lotyniskas: latinName, lietuviškas: name, ...details }).catch(() => {})
  }

  return details
}

async function enrich(parsed) {
  const [photos, namesData] = await Promise.all([
    fetchPhotos(parsed.latinName),
    fetchPlantNames(parsed.latinName),
  ])
  const inatLtName = namesData?.inatLtName ?? null
  return {
    ...parsed,
    // iNaturalist Lithuanian names are curated — use as primary name if available
    name:         inatLtName ?? parsed.name,
    image:        photos[0] ?? null,
    photos,
    inatLtName,
    inatTaxonId:  namesData?.inatTaxonId  ?? null,
    sinonimai:    namesData?.sinonimai    ?? [],
    englishNames: namesData?.englishNames ?? [],
  }
}


export default function SearchModal({ onAddToWishlist, onAddToDashboard, onClose, plants = [], onViewPlant, onPromote, onUpdatePlant, initialQuery = '', autoCamera = false }) {
  // Desktop split panel: portaliuojam į RightPanel container'į.
  const isDesktop = useIsDesktop()
  const host = useDetailHost()
  const useDesktopPanel = isDesktop && !!host?.container

  useEffect(() => {
    if (!useDesktopPanel || !host) return
    host.open()
    return () => host.close()
  }, [useDesktopPanel]) // eslint-disable-line react-hooks/exhaustive-deps

  // ESC keyboard shortcut — uždaryti modal'ą iš paneles desktop'e
  useEffect(() => {
    if (!useDesktopPanel) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [useDesktopPanel, onClose])

  const [query, setQuery]         = useState(initialQuery)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState(null)
  const [dots, setDots]           = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [previewUrl, setPreview]  = useState(null) // photo search preview
  const [savingPhase2, setSavingPhase2]     = useState(false)
  const [photoIdx, setPhotoIdx]             = useState(0)
  const [paywallOpen, setPaywallOpen]       = useState(false)
  const [paywallLimitType, setPaywallLimitType] = useState(null)

  // Reset gallery index when a new result arrives
  useEffect(() => { setPhotoIdx(0) }, [result])
  const abortRef  = useRef(null)
  const inputRef  = useRef(null)
  const fileRef   = useRef(null)

  useEffect(() => {
    if (!loading) { setDots(''); return }
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(t)
  }, [loading])

  // Cycle status messages during Phase 1 loading
  useEffect(() => {
    if (!loading) return
    const steps = [
      [1200, 'Renkuoju informaciją...'],
      [3000, 'Tikrinu kilmę ir pavadinimą...'],
      [5500, 'Žiūriu šviesos ir vandens poreikius...'],
      [8000, 'Identifikuoju augalą...'],
    ]
    const timers = steps.map(([delay, msg]) => setTimeout(() => setStatusMsg(msg), delay))
    return () => timers.forEach(clearTimeout)
  }, [loading])

  // Auto-search if launched with a pre-filled query
  useEffect(() => {
    if (initialQuery.trim()) searchByText(initialQuery.trim())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-open camera picker if launched from camera button
  useEffect(() => {
    if (autoCamera) {
      const t = setTimeout(() => fileRef.current?.click(), 100)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleKeyDown = e => {
    if (e.key === 'Enter' && query.trim() && !loading) searchByText(query.trim())
  }

  // ── Text search — Phase 1 (preview) + Phase 2 (details) ────────
  const searchByText = async (q) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true); setResult(null); setError(null); setPreview(null)
    setStatusMsg('Ieškau augalo...')

    try {
      // ── Phase 1: fast preview ──────────────────────────────────
      const r1 = await claudeCall({
        maxTokens:  1024,
        system:     PLANT_SYSTEM,
        tools:      [TOOL_PREVIEW],
        toolChoice: { type: 'tool', name: 'plant_preview' },
        messages:   [{ role: 'user', content: `Rask informaciją apie augalą: "${q}"` }],
      })
      if (controller.signal.aborted) return

      const previewBlock = r1.content.find(b => b.type === 'tool_use' && b.name === 'plant_preview')
      if (!previewBlock) { setError('Augalas nerastas'); setLoading(false); setStatusMsg(''); return }

      const enriched = await enrich(previewBlock.input)
      if (controller.signal.aborted) return

      setResult(enriched)
      setLoading(false)
      setStatusMsg('')
    } catch (e) {
      if (e.name === 'AbortError' || controller.signal.aborted) return
      if (e.code === 'limit_reached') {
        setLoading(false); setStatusMsg('')
        setPaywallLimitType(e.limitType); setPaywallOpen(true)
        return
      }
      console.error('[SearchModal] error:', e)
      setError('Klaida ieškant augalo.')
      setLoading(false)
      setStatusMsg('')
    }
  }

  // ── Photo search — Phase 1 (preview) + Phase 2 (details) ───────
  const searchByPhoto = async (file) => {
    setLoading(true); setResult(null); setError(null); setQuery('')
    setStatusMsg('Žiūriu į nuotrauką...')
    try {
      const dataUrl = await resizeImage(file, 1200, 0.9)
      const base64  = dataUrl.split(',')[1]
      setPreview(dataUrl)

      const userMsg = {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text',  text: 'Identifikuok augalą šioje nuotraukoje (arba ant etiketės) ir pateik jo informaciją.' },
        ],
      }

      // ── Phase 1: fast preview ──────────────────────────────────
      const r1 = await claudeCall({
        maxTokens:  1024,
        system:     PLANT_SYSTEM,
        tools:      [TOOL_PREVIEW],
        toolChoice: { type: 'tool', name: 'plant_preview' },
        messages:   [userMsg],
      })

      const previewBlock = r1.content.find(b => b.type === 'tool_use' && b.name === 'plant_preview')
      if (!previewBlock) { setError('Nepavyko identifikuoti augalo.'); setLoading(false); setStatusMsg(''); return }

      const enriched = await enrich(previewBlock.input)
      setResult(enriched)
      setLoading(false)
      setStatusMsg('')
    } catch (e) {
      if (e.code === 'limit_reached') {
        setLoading(false); setStatusMsg('')
        setPaywallLimitType(e.limitType); setPaywallOpen(true)
        return
      }
      console.error('[SearchModal photo] error:', e)
      setError('Nepavyko identifikuoti augalo. Bandykite aiškesnę nuotrauką.')
      setLoading(false)
      setStatusMsg('')
    }
  }

  const clear = () => {
    abortRef.current?.abort()
    setQuery(''); setResult(null); setError(null); setLoading(false); setPreview(null)
    inputRef.current?.focus()
  }

  // ── Duplicate detection ──────────────────────────────────────
  const norm = s => s?.trim().toLowerCase() ?? ''
  const duplicate = result
    ? plants.find(p => norm(p.lotyniskas) === norm(result.latinName))
    : null

  const tree = (
    <div className={useDesktopPanel ? "absolute inset-0 flex justify-center" : "fixed inset-0 z-50 flex justify-center"}>
    <motion.div
      className={useDesktopPanel ? "w-full h-full flex flex-col bg-app" : "w-full max-w-[430px] flex flex-col bg-app"}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Header — X close top-right (suvienodintas su kitais top-level modal'ais) */}
      <div className="safe-top" />
      <div className="flex items-center gap-3 px-4 py-3 border-b border-warm-border">
        <h2 className="text-base font-semibold text-gray-900 flex-1">Rasti augalą</h2>
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          aria-label="Uždaryti"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none px-4 py-5 space-y-5">
        {/* Search input + photo button */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-white border border-gray-200 rounded-2xl px-4 gap-2">
            <Search size={18} className="text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              placeholder="Pvz. Monstera, Ficus, Alavijas..."
              value={query}
              onChange={e => { setPreview(null); setQuery(e.target.value); setResult(null); setError(null) }}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent py-3.5 text-sm text-gray-800 placeholder-gray-500 outline-none"
              autoComplete="nope"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              autoFocus
            />
            {(query || previewUrl) && (
              <button onClick={clear} className="text-gray-400 px-1 flex-shrink-0"><X size={14} /></button>
            )}
          </div>
          <button
            onClick={() => { if (query.trim() && !loading) searchByText(query.trim()) }}
            disabled={!query.trim() || loading}
            className="flex-shrink-0 bg-sage-500 disabled:opacity-40 hover:bg-sage-600 transition-colors rounded-2xl flex items-center justify-center text-white"
            style={{ width: 52, height: 52 }}
          >
            {loading
              ? <img src="/plant_pot.png" className="w-7 h-7 object-contain animate-spin" alt="" />
              : <Search size={18} />
            }
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-shrink-0 bg-white border border-gray-200 hover:bg-surface transition-colors rounded-2xl flex items-center justify-center text-gray-600"
            style={{ width: 52, height: 52 }}
          >
            <Camera size={22} />
          </button>
          <input
            ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files[0]; if (f) { searchByPhoto(f); e.target.value = '' } }}
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            {previewUrl
              ? <img src={previewUrl} alt="" className="w-28 h-28 object-cover rounded-2xl opacity-70" />
              : <img src="/plant_pot.png" className="w-16 h-16 object-contain animate-spin" alt="" />
            }
            <p className="text-sm text-gray-600 font-medium">{statusMsg}{dots}</p>
            {!previewUrl && <p className="text-xs text-gray-400 italic">{query}</p>}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-50 rounded-3xl p-5 text-center">
            <div className="flex justify-center mb-2 text-red-300"><Search size={32} /></div>
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <p className="text-xs text-red-400 mt-1">Bandykite kitą pavadinimą arba aiškesnę nuotrauką</p>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {/* Hero gallery — mobile bleeds (-mx-4) iki ekrano krašto; desktop'e
                lieka rounded card su parent padding'u (kad neišlystų už panel'ės) */}
            {result.image ? (
              <div className={`rounded-3xl overflow-hidden h-56 relative mb-0 ${useDesktopPanel ? '' : '-mx-4'}`}>
                {/* Cross-fade image swap */}
                <AnimatePresence mode="sync" initial={false}>
                  <motion.img
                    key={result.photos?.[photoIdx] ?? result.image}
                    src={result.photos?.[photoIdx] ?? result.image}
                    alt={result.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent pointer-events-none" />

                {/* Prev / Next arrows */}
                {(result.photos?.length ?? 0) > 1 && (
                  <>
                    <button
                      onClick={() => setPhotoIdx(i => Math.max(0, i - 1))}
                      disabled={photoIdx === 0}
                      className="absolute left-3 top-1/2 -translate-y-[calc(50%+1.5rem)] w-8 h-8 bg-black/35 backdrop-blur-sm rounded-full flex items-center justify-center text-white disabled:opacity-20 transition-opacity active:scale-90"
                    >
                      <ChevronLeft size={16} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => setPhotoIdx(i => Math.min((result.photos?.length ?? 1) - 1, i + 1))}
                      disabled={photoIdx >= (result.photos?.length ?? 1) - 1}
                      className="absolute right-3 top-1/2 -translate-y-[calc(50%+1.5rem)] w-8 h-8 bg-black/35 backdrop-blur-sm rounded-full flex items-center justify-center text-white disabled:opacity-20 transition-opacity active:scale-90"
                    >
                      <ChevronRight size={16} strokeWidth={2.5} />
                    </button>
                    <div className="absolute top-3 right-3 bg-black/35 backdrop-blur-sm rounded-full px-2 py-0.5">
                      <span className="text-[11px] text-white/90 font-medium">{photoIdx + 1} / {result.photos.length}</span>
                    </div>
                  </>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-xl font-bold text-white leading-tight">{result.name}</h3>
                  <p className="text-xs text-white/70 italic mt-0.5">{result.latinName}</p>
                  {(result.inatLtName || result.sinonimai?.length > 0 || result.englishNames?.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {result.inatLtName && (
                        <span className="text-[10px] text-white/80 bg-white/15 rounded px-1.5 py-0.5">{result.inatLtName}</span>
                      )}
                      {result.sinonimai?.filter(s => s !== result.inatLtName).map((s, i) => (
                        <span key={i} className="text-[10px] text-white/80 bg-white/15 rounded px-1.5 py-0.5">{s}</span>
                      ))}
                      {result.englishNames?.map((n, i) => (
                        <span key={i} className="text-[10px] text-white/60 bg-white/10 rounded px-1.5 py-0.5 italic">{n}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-sage-50 rounded-3xl p-4 flex items-center gap-4 mb-0">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-4xl shadow-ios flex-shrink-0">
                  {result.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">{result.name}</h3>
                  <p className="text-xs text-sage-600 italic mt-0.5">{result.latinName}</p>
                  {(result.inatLtName || result.sinonimai?.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {result.inatLtName && <span className="text-[10px] text-sage-700 bg-sage-100 rounded px-1.5 py-0.5">{result.inatLtName}</span>}
                      {result.sinonimai?.filter(s => s !== result.inatLtName).map((s, i) => (
                        <span key={i} className="text-[10px] text-sage-600 bg-white border border-sage-200 rounded px-1.5 py-0.5">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Profile content — same component as PlantDetail, no extra padding */}
            <ProfileContent plant={fromAIResult(result)} section="nori" onAction={null} onClose={onClose} className="pt-5 pb-2 space-y-6" />

            {/* Actions */}
            <div className="space-y-3 pt-1 pb-4">
              {duplicate ? (
                <DuplicateBanner
                  duplicate={duplicate}
                  result={result}
                  onAddToDashboard={onAddToDashboard}
                  onViewPlant={onViewPlant}
                  onPromote={onPromote}
                  onUpdatePlant={onUpdatePlant}
                  onClose={onClose}
                  onSavingChange={setSavingPhase2}
                />
              ) : (
                <>
                  <SaveButton
                    label="Pirkau, turiu!"
                    result={result}
                    className="w-full py-4 rounded-3xl text-sm font-semibold text-white bg-sage-500 hover:bg-sage-600 disabled:opacity-60 transition-colors shadow-ios"
                    onSave={onAddToDashboard}
                    onClose={onClose}
                    onSavingChange={setSavingPhase2}
                  />
                  <SaveButton
                    label="Pridėti į biblioteką"
                    result={result}
                    className="w-full py-4 rounded-3xl text-sm font-semibold text-blush-600 bg-blush-50 hover:bg-blush-100 disabled:opacity-60 transition-colors"
                    onSave={onAddToWishlist}
                    onClose={onClose}
                    onSavingChange={setSavingPhase2}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="text-center py-16 space-y-3">
            <img src="/plant_pot.png" className="w-16 h-16 object-contain mx-auto animate-idle-float" alt="" />
            <p className="text-sm text-gray-500">Įveskite augalo pavadinimą ir spauskite Enter</p>
            <p className="text-xs text-gray-400">arba nufotografuokite augalą / etiketę</p>
          </div>
        )}
      </div>
    </motion.div>

    <AnimatePresence>
      {savingPhase2 && <SavingOverlay key="saving" />}
    </AnimatePresence>
    <PaywallSheet open={paywallOpen} limitType={paywallLimitType} onClose={() => setPaywallOpen(false)} />
    </div>
  )

  if (useDesktopPanel) return createPortal(tree, host.container)
  return tree
}

// ── Full-screen Phase 2 loading overlay ──────────────────────────
function SavingOverlay() {
  const [msgIndex, setMsgIndex] = useState(0)
  const msgs = [
    'Traukiu išmintį iš interneto...',
    'Klausiu augalų mokslininkų...',
    'Renkuoju priežiūros paslaptis...',
    'Skaičiuoju laistymo intervalus...',
    'Sudarinėju ligų diagnostiką...',
    'Beveik jau turiu viską...',
  ]
  useEffect(() => {
    const t = setInterval(() => setMsgIndex(i => (i + 1) % msgs.length), 1800)
    return () => clearInterval(t)
  }, [])

  const steps = [
    { label: 'Pagrindai', done: true },
    { label: 'Priežiūra',  active: true },
    { label: 'Išsaugota',  done: false },
  ]

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-3xl p-8 mx-6 flex flex-col items-center gap-5 shadow-2xl w-full max-w-[300px]"
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
      >
        <img src="/plant_pot.png" className="w-16 h-16 object-contain animate-spin" alt="" />
        <div className="text-center">
          <p className="text-base font-bold text-gray-900">Kantrybės...</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIndex}
              className="text-sm text-gray-500 mt-1.5 min-h-[20px]"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.22 }}
            >
              {msgs[msgIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center w-full">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  s.done   ? 'bg-sage-500' :
                  s.active ? 'bg-sage-300 animate-pulse' :
                             'bg-gray-200'
                }`} />
                <span className={`text-[10px] font-medium ${
                  s.done   ? 'text-sage-600' :
                  s.active ? 'text-sage-500' :
                             'text-gray-400'
                }`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-10 h-px mb-3.5 mx-1 ${s.done ? 'bg-sage-200' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Save button: fetches Phase 2 details on click, then saves ────
function SaveButton({ label, result, className, onSave, onClose, onSavingChange }) {
  const [saving, setSaving] = useState(false)

  const handleClick = async () => {
    setSaving(true)
    onSavingChange?.(true)
    try {
      const details = await fetchDetails(result.latinName, result.name)
      onSave({ ...result, ...details })
      onClose()
    } catch (e) {
      console.error('[SaveButton] Phase 2 error:', e)
      // Fall back to saving Phase 1 data
      onSave(result)
      onClose()
    } finally {
      setSaving(false)
      onSavingChange?.(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={saving} className={className}>
      {label}
    </button>
  )
}

// ── Update button: fetches Phase 2 and patches existing plant ────
function UpdateButton({ label, result, existingId, className, onUpdate, onClose, onSavingChange }) {
  const [saving, setSaving] = useState(false)

  const handleClick = async () => {
    setSaving(true)
    onSavingChange?.(true)
    try {
      const details = await fetchDetails(result.latinName, result.name)
      const merged  = { ...result, ...details }
      const full    = fromAIResult(merged)
      // Strip identity/personal fields — only update reference data
      const { id: _id, kategorija: _kat, komentaras: _kom, data_prideta: _dat, status: _st } = full
      const patch = { ...full }
      delete patch.id; delete patch.kategorija; delete patch.komentaras
      delete patch.data_prideta; delete patch.status
      onUpdate(existingId, patch)
      onClose()
    } catch (e) {
      console.error('[UpdateButton] Phase 2 error:', e)
      onClose()
    } finally {
      setSaving(false)
      onSavingChange?.(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={saving} className={className}>
      {label}
    </button>
  )
}

function DuplicateBanner({ duplicate, result, onAddToDashboard, onViewPlant, onPromote, onUpdatePlant, onClose, onSavingChange }) {
  const { kategorija } = duplicate

  // ── nori: custom layout with 3 actions ──────────────────────────
  if (kategorija === 'nori') {
    return (
      <div className="bg-blush-50 border border-blush-200 rounded-2xl p-4 space-y-2">
        <p className="text-sm font-semibold text-blush-800">Jau norų sąraše</p>
        <button
          onClick={() => { onPromote?.(duplicate.id); onClose() }}
          className="w-full py-3 rounded-2xl text-sm font-semibold text-white bg-gray-800 active:bg-gray-900 transition-colors"
        >
          Įsigijau!
        </button>
        <div className="flex gap-2">
          {onUpdatePlant && (
            <UpdateButton
              label="Atnaujinti įrašą"
              result={result}
              existingId={duplicate.id}
              className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-gray-700 bg-white border border-gray-200 active:bg-surface disabled:opacity-50 transition-colors"
              onUpdate={onUpdatePlant}
              onClose={onClose}
              onSavingChange={onSavingChange}
            />
          )}
          <button
            onClick={() => { onViewPlant?.(duplicate) }}
            className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-gray-700 bg-white border border-gray-200 active:bg-surface transition-colors"
          >
            Peržiūrėti
          </button>
        </div>
      </div>
    )
  }

  const configs = {
    auginama: {
      bg: 'bg-sage-50', border: 'border-sage-200', text: 'text-sage-800',
      message: `Jau augini šį augalą`,
      primary: { label: 'Pridėti dar vieną', onSave: onAddToDashboard },
    },
    istorija: {
      bg: 'bg-surface', border: 'border-gray-200', text: 'text-gray-700',
      message: `Šis augalas pas tave mirė...`,
      primary: { label: 'Bandyti dar kartą', onSave: onAddToDashboard },
    },
  }

  const cfg = configs[kategorija] ?? configs.auginama

  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-4 space-y-3`}>
      <p className={`text-sm font-semibold ${cfg.text}`}>{cfg.message}</p>
      <div className="flex gap-2">
        {cfg.primary.onSave ? (
          <SaveButton
            label={cfg.primary.label}
            result={result}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white bg-gray-800 active:bg-gray-900 disabled:opacity-60 transition-colors"
            onSave={cfg.primary.onSave}
            onClose={onClose}
            onSavingChange={onSavingChange}
          />
        ) : (
          <button
            onClick={cfg.primary.action}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white bg-gray-800 active:bg-gray-900 transition-colors"
          >
            {cfg.primary.label}
          </button>
        )}
        <button
          onClick={() => { onViewPlant?.(duplicate) }}
          className="flex-1 py-3 rounded-2xl text-sm font-semibold text-gray-700 bg-white border border-gray-200 active:bg-surface transition-colors"
        >
          Peržiūrėti
        </button>
      </div>
    </div>
  )
}
