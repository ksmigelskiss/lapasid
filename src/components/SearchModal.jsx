import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Search, X, Camera } from 'lucide-react'
import Anthropic from '@anthropic-ai/sdk'
import { fetchPhotos, resizeImage } from '../utils/imageService'
import { fetchPlantNames } from '../utils/plantNames'
import { fromAIResult } from '../hooks/usePlants'
import { ProfileContent } from './PlantDetail'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

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

Šviesa: taskai 1 (žema) 50–150 μmol/m²/s; 2 (vidutinė) 150–400; 3 (ryški) 400–2000
Vanduo: 1 (mažai) sultingi; 2 (vidutiniškai) tropiniai; 3 (daug) paparčiai
Laistymas (dienomis): sultingi vasara 14–21, vidutiniai 7–14, paparčiai 3–7`



async function fetchDetails(latinName, name) {
  const r = await client.messages.create({
    model:       'claude-sonnet-4-6',
    max_tokens:  2048,
    system:      PLANT_SYSTEM,
    tools:       [TOOL_DETAILS],
    tool_choice: { type: 'tool', name: 'plant_details' },
    messages:    [{ role: 'user', content: `Pateik išsamią priežiūros informaciją apie augalą "${latinName}" (${name}).` }],
  })
  const block = r.content.find(b => b.type === 'tool_use' && b.name === 'plant_details')
  return block?.input ?? {}
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
    inatLtName,
    inatTaxonId:  namesData?.inatTaxonId  ?? null,
    sinonimai:    namesData?.sinonimai    ?? [],
    englishNames: namesData?.englishNames ?? [],
  }
}


export default function SearchModal({ onAddToWishlist, onAddToDashboard, onClose, plants = [], onViewPlant, onPromote, initialQuery = '' }) {
  const [query, setQuery]         = useState(initialQuery)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState(null)
  const [dots, setDots]           = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [previewUrl, setPreview]  = useState(null) // photo search preview
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
      const r1 = await client.messages.create({
        model:       'claude-sonnet-4-6',
        max_tokens:  1024,
        system:      PLANT_SYSTEM,
        tools:       [TOOL_PREVIEW],
        tool_choice: { type: 'tool', name: 'plant_preview' },
        messages:    [{ role: 'user', content: `Rask informaciją apie augalą: "${q}"` }],
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
      console.error('[SearchModal] error:', e)
      setError('Klaida ieškant augalo. Patikrinkite API raktą.')
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
      const r1 = await client.messages.create({
        model:       'claude-sonnet-4-6',
        max_tokens:  1024,
        system:      PLANT_SYSTEM,
        tools:       [TOOL_PREVIEW],
        tool_choice: { type: 'tool', name: 'plant_preview' },
        messages:    [userMsg],
      })

      const previewBlock = r1.content.find(b => b.type === 'tool_use' && b.name === 'plant_preview')
      if (!previewBlock) { setError('Nepavyko identifikuoti augalo.'); setLoading(false); setStatusMsg(''); return }

      const enriched = await enrich(previewBlock.input)
      setResult(enriched)
      setLoading(false)
      setStatusMsg('')
    } catch (e) {
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
  const duplicate = result
    ? plants.find(p => p.lotyniskas?.toLowerCase() === result.latinName?.toLowerCase())
    : null

  return (
    <div className="fixed inset-0 z-50 flex justify-center">
    <motion.div
      className="w-full max-w-[430px] flex flex-col bg-app"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Header */}
      <div className="safe-top" />
      <div className="flex items-center gap-3 px-4 py-3 border-b border-warm-border">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-base font-semibold text-gray-900">Rasti augalą</h2>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none px-4 py-5 space-y-5">
        {/* Search input + photo button */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-white border border-gray-200 rounded-2xl px-4 gap-2">
            <Search size={18} className="text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Pvz. Monstera, Ficus, Alavijas..."
              value={query}
              onChange={e => { setPreview(null); setQuery(e.target.value); setResult(null); setError(null) }}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent py-3.5 text-sm text-gray-800 placeholder-gray-500 outline-none"
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
            {/* Hero */}
            {result.image ? (
              <div className="rounded-3xl overflow-hidden h-52 relative -mx-4 mb-0">
                <img src={result.image} alt={result.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
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
                  onClose={onClose}
                  fetchDetails={fetchDetails}
                />
              ) : (
                <>
                  <SaveButton
                    label="Pirkau, turiu!"
                    result={result}
                    className="w-full py-4 rounded-3xl text-sm font-semibold text-white bg-sage-500 hover:bg-sage-600 disabled:opacity-60 transition-colors shadow-ios"
                    onSave={onAddToDashboard}
                    onClose={onClose}
                  />
                  <SaveButton
                    label="Pridėti į biblioteką"
                    result={result}
                    className="w-full py-4 rounded-3xl text-sm font-semibold text-blush-600 bg-blush-50 hover:bg-blush-100 disabled:opacity-60 transition-colors"
                    onSave={onAddToWishlist}
                    onClose={onClose}
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
    </div>
  )
}

// ── Save button: fetches Phase 2 details on click, then saves ────
function SaveButton({ label, result, className, onSave, onClose }) {
  const [saving, setSaving] = useState(false)

  const handleClick = async () => {
    setSaving(true)
    try {
      const details = await fetchDetails(result.latinName, result.name)
      onSave({ ...result, ...details })
      onClose()
    } catch (e) {
      console.error('[SaveButton] Phase 2 error:', e)
      // Fall back to saving Phase 1 data
      onSave(result)
      onClose()
    }
  }

  return (
    <button onClick={handleClick} disabled={saving} className={className}>
      {saving
        ? <span className="flex items-center justify-center gap-2">
            <img src="/plant_pot.png" className="w-4 h-4 object-contain animate-spin" alt="" />
            Kraunama...
          </span>
        : label
      }
    </button>
  )
}

function DuplicateBanner({ duplicate, result, onAddToDashboard, onViewPlant, onPromote, onClose }) {
  const { kategorija } = duplicate

  const configs = {
    auginama: {
      bg: 'bg-sage-50', border: 'border-sage-200', text: 'text-sage-800',
      message: `Jau augini šį augalą`,
      primary: { label: 'Pridėti dar vieną', onSave: onAddToDashboard },
    },
    nori: {
      bg: 'bg-blush-50', border: 'border-blush-200', text: 'text-blush-800',
      message: `Jau norų sąraše`,
      primary: { label: 'Įsigijau!', action: () => { onPromote?.(duplicate.id) } },
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
