import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import PlantImage from '../components/brand/PlantImage'
import PublicPlantCard from '../components/PublicPlantCard'

/**
 * Vieša augalų biblioteka (1 segmentas) — pradinis puslapis neprisijungusiems.
 * Globalaus katalogo grid + paieška, vizualiai kaip Biblioteka. Duomenys iš
 * /api/catalog/public (be auth). BE asmeninių filtrų, BE nori/auginu.
 */
export default function PublicLibrary({ onLogin }) {
  const [entries, setEntries]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [q, setQ]               = useState('')
  const [selected, setSelected] = useState(null) // pilnas įrašas (slug fetch)

  // Sąrašas + paieška (debounce). Tuščia užklausa → pilnas sąrašas.
  useEffect(() => {
    const url = q.trim()
      ? `/api/catalog/public?q=${encodeURIComponent(q.trim())}`
      : '/api/catalog/public?list=1'
    const t = setTimeout(() => {
      fetch(url)
        .then(r => r.json())
        .then(d => setEntries(d.entries ?? []))
        .catch(() => setEntries([]))
        .finally(() => setLoading(false))
    }, q.trim() ? 250 : 0)
    return () => clearTimeout(t)
  }, [q])

  const openCard = (slug) => {
    fetch(`/api/catalog/public?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => { if (d.entry) setSelected(d.entry) })
      .catch(() => {})
  }

  const isToxic = (e) =>
    (Array.isArray(e.savybes?.pavojai) && e.savybes.pavojai.length > 0) ||
    e.savybes?.pavojingumas?.yra === true

  return (
    <div className="flex flex-col h-full bg-app">
      {/* Header su login mygtuku */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-bone-400/40 flex-shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="font-display font-semibold text-forest-800">LapasID</span>
          <span className="text-forest-400 text-xs hidden sm:inline">augalų biblioteka</span>
        </div>
        <button
          onClick={onLogin}
          className="px-4 h-8 inline-flex items-center rounded-btn text-sm font-semibold text-forest-700 bg-bone-50 border border-bone-400/40 hover:bg-bone-300/40 transition-colors"
        >
          Prisijungti
        </button>
      </div>

      {/* Paieška */}
      <div className="px-5 py-3 flex-shrink-0">
        <div className="flex items-center gap-2 bg-bone-50 border border-bone-400/40 rounded-2xl px-4 h-9 focus-within:border-forest-400/60 transition-colors">
          <Search size={16} className="text-forest-400 flex-shrink-0" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Ieškoti augalo..."
            className="flex-1 text-sm text-forest-700 placeholder-forest-400 outline-none bg-transparent"
          />
          {q && <button onClick={() => setQ('')} className="text-forest-400 text-xs">✕</button>}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-5 pb-10">
        {loading ? (
          <p className="text-center text-forest-400 text-sm py-20">Kraunama…</p>
        ) : entries.length === 0 ? (
          <p className="text-center text-forest-400 text-sm py-20">Nieko nerasta</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {entries.map(e => (
              <button key={e.slug} onClick={() => openCard(e.slug)} className="text-left group">
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-bone-50 border border-bone-400/40">
                  <PlantImage
                    url={e.heroIllustration ?? e.image}
                    thumbUrl={e.heroThumb}
                    size="card"
                    alt={e.lietuviškas}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                  />
                  {isToxic(e) && (
                    <span className="absolute top-1.5 left-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-terracotta-200 text-terracotta-700 text-[11px]" title="Toksiškas">⚠</span>
                  )}
                </div>
                <p className="mt-1.5 text-sm font-medium text-forest-800 truncate">{e.lietuviškas}</p>
                {e.lotyniskas && <p className="text-xs italic text-forest-400 truncate">{e.lotyniskas}</p>}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && <PublicPlantCard entry={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
