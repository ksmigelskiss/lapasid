import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Search, X, Camera, Sun, Droplets, Thermometer, Wind, MapPin, Leaf, Snowflake } from 'lucide-react'
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

function DotScore({ value, max = 3, color }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={`w-2 h-2 rounded-full ${i < value ? color : 'bg-gray-200'}`} />
      ))}
    </div>
  )
}

function InfoRow({ icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-6 flex-shrink-0 flex items-center justify-center text-gray-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-700 mt-0.5 leading-snug">{value}</p>
      </div>
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

  // Auto-search if launched with a pre-filled query
  useEffect(() => {
    if (initialQuery.trim()) searchByText(initialQuery.trim())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleKeyDown = e => {
    if (e.key === 'Enter' && query.trim() && !loading) searchByText(query.trim())
  }

  // ── Text search ──────────────────────────────────────────────
  const searchByText = async (q) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true); setResult(null); setError(null); setPreview(null)
    setStatusMsg('Ieškau augalo...')

    try {
      let fullText = ''
      let gotFirstToken = false
      const stream = await client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: `Rask informaciją apie augalą: "${q}".\n\n${PLANT_JSON_PROMPT}` }],
      })
      for await (const chunk of stream) {
        if (controller.signal.aborted) return
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          if (!gotFirstToken) { gotFirstToken = true; setStatusMsg('Radau, renkuoju duomenis...') }
          fullText += chunk.delta.text
        }
      }
      if (controller.signal.aborted) return
      setStatusMsg('Žiūriu kur gyvena, kaip laistyti...')
      const data = await parseAndEnrich(fullText)
      if (data.error) setError(data.error)
      else setResult(data)
    } catch (e) {
      if (e.name === 'AbortError' || controller.signal.aborted) return
      setError('Klaida ieškant augalo. Patikrinkite API raktą.')
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setStatusMsg('') }
    }
  }

  // ── Photo search ─────────────────────────────────────────────
  const searchByPhoto = async (file) => {
    setLoading(true); setResult(null); setError(null); setQuery('')
    setStatusMsg('Žiūriu į nuotrauką...')
    try {
      const dataUrl  = await resizeImage(file, 1200, 0.9)
      const base64   = dataUrl.split(',')[1]
      setPreview(dataUrl)
      setStatusMsg('Identifikuoju augalą...')

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
      setStatusMsg('Žiūriu kur gyvena, kaip laistyti...')
      const data = await parseAndEnrich(fullText)
      if (data.error) setError(data.error)
      else setResult(data)
    } catch (e) {
      setError('Nepavyko identifikuoti augalo. Bandykite aiškesnę nuotrauką.')
    } finally {
      setLoading(false); setStatusMsg('')
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
            className="space-y-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {/* Hero */}
            {result.image ? (
              <div className="rounded-3xl overflow-hidden h-52 relative -mx-4">
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
              <div className="bg-sage-50 rounded-3xl p-4 flex items-center gap-4">
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

            {/* Quick stats */}
            <div className="bg-surface rounded-2xl p-4 space-y-0">
              {result.origin && (
                <InfoRow
                  icon={<MapPin size={13} />}
                  label="Kilmė"
                  value={result.origin}
                />
              )}
              {result.lightScore != null && (
                <div className="flex gap-3 py-2.5 border-b border-gray-50">
                  <div className="w-6 flex-shrink-0 flex items-center justify-center text-gray-400"><Sun size={13} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Šviesa</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <DotScore value={result.lightScore} color="bg-amber-400" />
                      <span className="text-xs text-gray-500">{result.lightLevel}</span>
                      {result.ppfd?.min != null && (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                          {result.ppfd.min}–{result.ppfd.max} μmol/m²/s
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {result.watering?.intervalVasara != null && (
                <InfoRow
                  icon={<Droplets size={13} />}
                  label="Laistymas"
                  value={[
                    `Vasara kas ${result.watering.intervalVasara} d.`,
                    result.watering.intervalZiema ? `žiema kas ${result.watering.intervalZiema} d.` : 'žiemą nelaistyti',
                    result.watering.metodas,
                  ].filter(Boolean).join(' · ')}
                />
              )}
              {result.fertilizing?.intervalVasara != null && (
                <InfoRow
                  icon={<Leaf size={13} />}
                  label="Tręšimas"
                  value={[
                    `Vasara kas ${result.fertilizing.intervalVasara} d.`,
                    result.fertilizing.intervalZiema ? `žiema kas ${result.fertilizing.intervalZiema} d.` : 'žiemą netręšti',
                    result.fertilizing.tipas,
                  ].filter(Boolean).join(' · ')}
                />
              )}
              {result.dormancy?.reikia && (
                <InfoRow
                  icon={<Snowflake size={13} />}
                  label="Žiemos miegas"
                  value={result.dormancy.tipas === 'full' ? 'Visiškas (nelaistyti)' : 'Dalinis (rečiau laistyti)'}
                />
              )}
              {result.care?.humidity && (
                <InfoRow icon={<Wind size={13} />} label="Drėgmė" value={result.care.humidity} />
              )}
              {result.care?.temperature && (
                <InfoRow icon={<Thermometer size={13} />} label="Temperatūra" value={result.care.temperature} />
              )}
              {result.care?.soil && (
                <InfoRow icon={<span className="text-[11px]">🪨</span>} label="Žemė" value={result.care.soil} />
              )}
            </div>

            {/* Description */}
            {result.aiDescription && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest px-1">Apie augalą</p>
                <div className="bg-surface rounded-2xl p-4">
                  <p className="text-sm text-gray-700 leading-relaxed">{result.aiDescription}</p>
                </div>
              </div>
            )}

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
