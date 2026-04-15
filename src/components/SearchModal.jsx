import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Search, X, Camera, Loader2, Sun, Droplets, Wind, Thermometer } from 'lucide-react'
import Anthropic from '@anthropic-ai/sdk'
import { fetchPlantPhotos } from '../utils/plantImage'
import { fetchPlantNames } from '../utils/plantNames'
import { resizeImage } from '../utils/imageResize'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

// Shared JSON prompt template
const PLANT_JSON_PROMPT = `Atsakyk TIKTAI JSON formatu (be jokio kito teksto):
{
  "name": "Tikras lietuviškas pavadinimas",
  "latinName": "Tikslus lotyniškas pavadinimas",
  "emoji": "vienas emoji reprezentuojantis augalą",
  "aiDescription": "2-3 sakinių aprašymas lietuviškai",
  "origin": "Trumpai iš kur kilęs, pvz. 'Pietų Amerika, tropiniai miškai'",
  "lightLevel": "žema|vidutinė|ryški",
  "lightScore": 1,
  "ppfd": { "min": 0, "max": 0 },
  "watering": {
    "intervalVasara": 0,
    "intervalZiema": 0,
    "metodas": "Trumpas aprašymas kada laistyti"
  },
  "fertilizing": {
    "intervalVasara": 0,
    "intervalZiema": 0,
    "tipas": "Trąšų tipas ir dozė"
  },
  "dormancy": {
    "reikia": false,
    "tipas": null
  },
  "care": {
    "water": "Laistymo aprašymas",
    "light": "Apšvietimo poreikis",
    "humidity": "Oro drėgmė %",
    "temperature": "Temperatūros diapazonas",
    "soil": "Žemės sudėtis"
  }
}

── ŠVIESA ──────────────────────────────────────────────────────
PPFD (μmol/m²/s) gairės:
  lightScore 1 (žema):     50–150   šešėlis, toli nuo lango
  lightScore 2 (vidutinė): 150–400  ryški netiesioginė, rytų langas
  lightScore 3 (ryški netiesioginė): 400–800   pietų langas be tiesioginės
  lightScore 3 (ryški + ≤4h tiesioginė): 500–1000
  lightScore 3 (pilna saulė >4h): 800–2000

── LAISTYMAS (intervalai dienomis) ────────────────────────────
  Sultingi / kaudeksiniai:   vasara 14–21d,  žiema 28–60d
  Paparčiai / epifitai:      vasara 3–7d,    žiema 7–14d
  Greitai augantys tropiniai: vasara 5–10d,  žiema 10–21d
  Vidutiniai tropiniai:      vasara 7–14d,   žiema 14–28d
  intervalZiema = null jei augalas žiemoja be laistymo

── TRĘŠIMAS (intervalai dienomis) ─────────────────────────────
  Sultingi / kaudeksiniai:   vasara 28d,  žiema null
  Paparčiai / epifitai:      vasara 28d,  žiema null
  Greitai augantys:          vasara 14d,  žiema 42d
  Vidutiniai:                vasara 21d,  žiema 56d

── ŽIEMOS MIEGAS ───────────────────────────────────────────────
  dormancy.reikia = true tik jei augalas:
    • meta lapus žiemą, ARBA
    • turi kaudeksą / gumbus ir žiemoja sausai, ARBA
    • aiškiai nurodytas ramybės periodas botanikos šaltiniuose
  dormancy.tipas: "full" (visiškas — nelaistyti) | "partial" (dalinis — retesnis laistymas) | null

── PRIVALOMA SAVIKONTROLĖ ─────────────────────────────────────
Prieš grąžinant patikrink:
1. Ar lightScore + ppfd min/max atitinka šviesos gaires?
2. Ar watering intervalai atitinka augalo tipą?
3. Ar fertilizing intervalai atitinka augalo tipą?
4. Ar žiemos intervalai logiški (sultingiems — ilgesni arba null)?
5. Ar dormancy.reikia atitinka augalo biologiją ir watering.intervalZiema?
6. Ar visi parametrai tarpusavyje nuoseklūs?
Jei neatitinka — pataisyk prieš grąžinant.

── PAVADINIMAS ─────────────────────────────────────────────────
Lauke "name": tikras lietuviškas arba sulietuvintas genties pavadinimas.
NIEKADA: angliškas ar lotyniškas pavadinimas lauke "name".

Jei augalas nerastas arba nematomas nuotraukoje: {"error": "Augalas nerastas"}`

function CareChip({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface rounded-2xl px-3 py-2 min-w-0">
      <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">{label}</span>
      <span className="text-xs font-medium text-gray-700 leading-tight">{value}</span>
    </div>
  )
}

async function parseAndEnrich(fullText) {
  const jsonMatch = fullText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Netinkamas atsakymas')
  const parsed = JSON.parse(jsonMatch[0])
  if (parsed.error) return { error: parsed.error }

  const [photos, namesData] = await Promise.all([
    fetchPlantPhotos(parsed.latinName),
    fetchPlantNames(parsed.latinName),
  ])
  return {
    ...parsed,
    image: photos[0] ?? null,
    inatLtName:   namesData?.inatLtName   ?? null,
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
  const [previewUrl, setPreview]  = useState(null) // photo search preview
  const abortRef  = useRef(null)
  const inputRef  = useRef(null)
  const fileRef   = useRef(null)

  useEffect(() => {
    if (!loading) { setDots(''); return }
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(t)
  }, [loading])

  // Auto-search if launched with a pre-filled query
  useEffect(() => {
    if (initialQuery.trim()) searchByText(initialQuery.trim())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Text search ──────────────────────────────────────────────
  const searchByText = async (q) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true); setResult(null); setError(null); setPreview(null)

    try {
      let fullText = ''
      const stream = await client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: `Rask informaciją apie augalą: "${q}".\n\n${PLANT_JSON_PROMPT}` }],
      })
      for await (const chunk of stream) {
        if (controller.signal.aborted) return
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') fullText += chunk.delta.text
      }
      if (controller.signal.aborted) return
      const data = await parseAndEnrich(fullText)
      if (data.error) setError(data.error)
      else setResult(data)
    } catch (e) {
      if (e.name === 'AbortError' || controller.signal.aborted) return
      setError('Klaida ieškant augalo. Patikrinkite API raktą.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  // ── Photo search ─────────────────────────────────────────────
  const searchByPhoto = async (file) => {
    setLoading(true); setResult(null); setError(null); setQuery('')
    try {
      const dataUrl  = await resizeImage(file, 1200, 0.9)
      const base64   = dataUrl.split(',')[1]
      setPreview(dataUrl)

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: `Identifikuok augalą šioje nuotraukoje (arba ant etiketės).\n\n${PLANT_JSON_PROMPT}` },
          ],
        }],
      })

      const fullText = response.content[0]?.text ?? ''
      const data = await parseAndEnrich(fullText)
      if (data.error) setError(data.error)
      else setResult(data)
    } catch (e) {
      setError('Nepavyko identifikuoti augalo. Bandykite aiškesnę nuotrauką.')
    } finally {
      setLoading(false)
    }
  }

  // ── Debounced text search ────────────────────────────────────
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResult(null); setError(null); setLoading(false); abortRef.current?.abort(); return }
    const timer = setTimeout(() => searchByText(q), 700)
    return () => clearTimeout(timer)
  }, [query])

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
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-app"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 320 }}
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

      <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-5 space-y-5">
        {/* Search input + photo button */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-white border border-gray-200 rounded-2xl px-4 gap-2">
            {loading
              ? <Loader2 size={18} className="animate-spin text-gray-400 flex-shrink-0" />
              : <Search size={18} className="text-gray-400 flex-shrink-0" />}
            <input
              ref={inputRef}
              type="text"
              placeholder="Pvz. Monstera, Ficus, Alavijas..."
              value={query}
              onChange={e => { setPreview(null); setQuery(e.target.value) }}
              className="flex-1 bg-transparent py-3.5 text-sm text-gray-800 placeholder-gray-500 outline-none"
              autoFocus
            />
            {(query || previewUrl) && (
              <button onClick={clear} className="text-gray-400 px-1 flex-shrink-0"><X size={14} /></button>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-13 h-13 flex-shrink-0 bg-white border border-gray-200 hover:bg-surface transition-colors rounded-2xl flex items-center justify-center text-gray-600"
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
              : <div className="text-4xl">🌿</div>

            }
            <p className="text-sm text-gray-500">
              {previewUrl ? `Identifikuojama${dots}` : `Ieškoma${dots}`}
            </p>
            {!previewUrl && <p className="text-xs text-gray-500 italic">{query}</p>}
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
            className="space-y-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {/* Hero or fallback */}
            {result.image ? (
              <div className="rounded-3xl overflow-hidden h-52 relative">
                <img src={result.image} alt={result.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-xl font-bold text-white leading-tight">{result.name}</h3>
                  <p className="text-xs text-white/70 italic mt-0.5">{result.latinName}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 bg-sage-50 rounded-3xl p-4">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-4xl shadow-ios">
                  {result.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">{result.name}</h3>
                  <p className="text-xs text-sage-600 italic mt-0.5">{result.latinName}</p>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="bg-surface rounded-3xl p-4">
              <p className="text-sm text-gray-700 leading-relaxed">{result.aiDescription}</p>
            </div>

            {/* iNaturalist names */}
            {(result.inatLtName || result.sinonimai?.length > 0 || result.englishNames?.length > 0) && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-4 space-y-2.5">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                  🌿 iNaturalist pavadinimai
                </p>
                {result.inatLtName && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide w-16 flex-shrink-0 pt-0.5">LT</span>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 rounded-lg px-2 py-0.5">{result.inatLtName}</span>
                      {result.sinonimai?.map((s, i) => (
                        <span key={i} className="text-xs text-emerald-700 bg-white border border-emerald-200 rounded-lg px-2 py-0.5">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {!result.inatLtName && result.sinonimai?.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide w-16 flex-shrink-0 pt-0.5">LT</span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.sinonimai.map((s, i) => (
                        <span key={i} className="text-xs text-emerald-700 bg-white border border-emerald-200 rounded-lg px-2 py-0.5">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {result.englishNames?.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide w-16 flex-shrink-0 pt-0.5">EN</span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.englishNames.map((n, i) => (
                        <span key={i} className="text-xs text-gray-600 bg-white border border-emerald-200 rounded-lg px-2 py-0.5">{n}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Care */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider px-1">Priežiūra</p>
              {result.ppfd?.min != null && result.ppfd?.max != null && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2">
                  <Sun size={18} className="text-amber-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Šviesos intensyvumas (PPFD)</p>
                    <p className="text-sm font-semibold text-amber-800">
                      {result.ppfd.min}–{result.ppfd.max} <span className="text-xs font-normal text-amber-600">μmol/m²/s</span>
                    </p>
                  </div>
                  {result.lightScore != null && (
                    <div className="flex gap-0.5 flex-shrink-0">
                      {[1,2,3].map(i => (
                        <div key={i} className={`w-2 h-2 rounded-full ${i <= result.lightScore ? 'bg-amber-400' : 'bg-amber-100'}`} />
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {result.care?.water       && <CareChip label="Laistymas"  value={result.care.water} />}
                {result.care?.light       && <CareChip label="Šviesa"     value={result.care.light} />}
                {result.care?.humidity    && <CareChip label="Drėgmė"     value={result.care.humidity} />}
                {result.care?.temperature && <CareChip label="Temp."      value={result.care.temperature} />}
                {result.care?.soil        && <CareChip label="Žemė"       value={result.care.soil} />}
              </div>
            </div>

            {/* Actions — contextual if duplicate, standard otherwise */}
            <div className="space-y-3 pt-1 pb-4">
              {duplicate ? (
                <DuplicateBanner
                  duplicate={duplicate}
                  result={result}
                  onAddToDashboard={onAddToDashboard}
                  onViewPlant={onViewPlant}
                  onPromote={onPromote}
                  onClose={onClose}
                />
              ) : (
                <>
                  <button
                    onClick={() => { onAddToDashboard(result); onClose() }}
                    className="w-full py-4 rounded-3xl text-sm font-semibold text-white bg-sage-500 hover:bg-sage-600 transition-colors shadow-ios"
                  >
                    🛍️ Pirkau, turiu!
                  </button>
                  <button
                    onClick={() => { onAddToWishlist(result); onClose() }}
                    className="w-full py-4 rounded-3xl text-sm font-semibold text-blush-600 bg-blush-50 hover:bg-blush-100 transition-colors"
                  >
                    ✨ Pridėti į „Noriu"
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl">🌱</div>
            <p className="text-sm text-gray-500">Pradėkite rašyti augalo pavadinimą</p>
            <p className="text-xs text-gray-400">arba nufotografuokite augalą / etiketę 📷</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function DuplicateBanner({ duplicate, result, onAddToDashboard, onViewPlant, onPromote, onClose }) {
  const { kategorija } = duplicate

  const configs = {
    auginama: {
      bg: 'bg-sage-50', border: 'border-sage-200', text: 'text-sage-800',
      message: `${duplicate.emoji ?? '🌿'} Jau augini šį augalą`,
      primary: { label: 'Pridėti dar vieną', action: () => { onAddToDashboard(result); onClose() } },
    },
    nori: {
      bg: 'bg-blush-50', border: 'border-blush-200', text: 'text-blush-800',
      message: `${duplicate.emoji ?? '🌿'} Jau norų sąraše`,
      primary: { label: '🛍️ Įsigijau!', action: () => { onPromote?.(duplicate.id); } },
    },
    istorija: {
      bg: 'bg-surface', border: 'border-gray-200', text: 'text-gray-700',
      message: `${duplicate.emoji ?? '🌿'} Šis augalas pas tave mirė...`,
      primary: { label: '🌱 Bandyti dar kartą', action: () => { onAddToDashboard(result); onClose() } },
    },
  }

  const cfg = configs[kategorija] ?? configs.auginama

  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-4 space-y-3`}>
      <p className={`text-sm font-semibold ${cfg.text}`}>{cfg.message}</p>
      <div className="flex gap-2">
        <button
          onClick={cfg.primary.action}
          className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white bg-gray-800 active:bg-gray-900 transition-colors"
        >
          {cfg.primary.label}
        </button>
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
