import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useDragControls, useMotionValue, animate } from 'framer-motion'
import { X, Camera, Image as ImageIcon, Search, Sun, Droplets, Thermometer, Wind, Flower2, RefreshCw, Star, Bookmark, Globe, MessageCircle, Pencil, Trash2, Loader2, MoreHorizontal, Leaf, Skull, Snowflake, MapPin, ChevronRight } from 'lucide-react'
import { ZonePicker } from './ZoneManager'
import PlantTimeline, { FAB, AddEventSheet } from './PlantTimeline'
import { getWateringForecast } from '../utils/wateringForecast'
import { fetchPlantNames } from '../utils/plantNames'
import { fetchPhotos, resizeImage } from '../utils/imageService'
import { getPlantMood } from '../utils/plantMood'
import PlantChat from './PlantChat'
import { PlantAvatar } from './icons/ChatIcons'
import { WateringCard, FertilizingCard, DormancyCard } from './ForecastCards'
import { StatusButton, StatusMenu } from './StatusPicker'
import { STATUS_OPTIONS, getStatusMeta } from '../constants/plant'

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

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' })
}


function PhotoSheet({ plant, onClose, onSave, onToggleHistoryPhoto }) {
  const historyPhotos   = (plant.timeline ?? []).filter(e => e.type === 'photo' && e.imageUrl)
  const useHistory      = plant.useHistoryPhoto !== false
  const [photos, setPhotos]     = useState([])   // online photos
  const [idx, setIdx]           = useState(0)
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    onClose()
    try { onSave(await resizeImage(file)) } catch {}
  }

  const handleSearch = async () => {
    setLoading(true)
    setSearched(false)
    const found = await fetchPhotos(plant.lotyniskas)
    setPhotos(found)
    setIdx(0)
    setLoading(false)
    setSearched(true)
  }

  const current = photos[idx] ?? null
  const hasPrev = idx > 0
  const hasNext = idx < photos.length - 1

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} onPointerDown={onClose}
      />
      <motion.div
        className="relative w-full max-w-[430px] bg-white rounded-t-4xl px-4 pt-3 pb-8"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex justify-center pb-3">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider text-center mb-3">Pakeisti nuotrauką</p>

        <div className="space-y-2">
          {/* History auto-sync toggle */}
          {historyPhotos.length > 0 && (
            <button
              onClick={onToggleHistoryPhoto}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-colors ${
                useHistory ? 'bg-sage-500 text-white' : 'bg-surface-2 text-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <Camera size={20} className={useHistory ? 'text-white' : 'text-gray-400'} />
                <div className="text-left">
                  <p className="text-sm font-semibold">Naudoti iš istorijos</p>
                  <p className={`text-xs mt-0.5 ${useHistory ? 'text-white/70' : 'text-gray-400'}`}>
                    {useHistory ? 'Naujos istorijos nuotraukos → profilis' : 'Išjungta — profilis fiksuotas'}
                  </p>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full flex items-center transition-colors px-0.5 ${useHistory ? 'bg-white/30' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${useHistory ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>
          )}

          {/* Online photo browser */}
          {!searched && !loading && (
            <button
              className="w-full flex items-center gap-4 bg-surface hover:bg-surface-2 rounded-2xl px-4 py-3.5"
              onClick={handleSearch}
            >
              <span className="text-gray-500"><Search size={22} /></span>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-gray-800">Rasti internete (iNaturalist)</p>
                <p className="text-xs text-gray-500 italic">{plant.lotyniskas}</p>
              </div>
            </button>
          )}

          {loading && (
            <div className="flex items-center gap-3 bg-surface rounded-2xl px-4 py-3.5">
              <span className="text-gray-400"><Loader2 size={22} className="animate-spin" /></span>
              <p className="text-sm text-gray-500">Ieškoma nuotraukų...</p>
            </div>
          )}

          {searched && photos.length === 0 && (
            <div className="bg-red-50 rounded-2xl px-4 py-3 text-center">
              <p className="text-sm text-red-500">Nerasta nuotraukų internete</p>
            </div>
          )}

          {searched && current && (
            <div className="space-y-2">
              {/* Preview */}
              <div className="relative rounded-2xl overflow-hidden bg-surface-2" style={{ height: 200 }}>
                <img src={current} alt="" className="w-full h-full object-cover" />
                {/* Prev / Next */}
                <div className="absolute inset-0 flex items-center justify-between px-2">
                  <button
                    disabled={!hasPrev}
                    onClick={() => setIdx(i => i - 1)}
                    className="w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white text-base disabled:opacity-20"
                  >‹</button>
                  <button
                    disabled={!hasNext}
                    onClick={() => setIdx(i => i + 1)}
                    className="w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white text-base disabled:opacity-20"
                  >›</button>
                </div>
                {/* Counter */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                  <span className="text-[10px] text-white bg-black/40 rounded-full px-2 py-0.5">
                    {idx + 1} / {photos.length}
                  </span>
                </div>
              </div>
              <button
                onClick={() => { onSave(current); onClose() }}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white bg-sage-500"
              >
                Naudoti šią nuotrauką
              </button>
            </div>
          )}

          {/* From history */}
          {historyPhotos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2 mt-1">Iš istorijos</p>
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {historyPhotos.map(e => (
                  <button
                    key={e.id}
                    onClick={() => { onSave(e.imageUrl, true); onClose() }}
                    className="flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden border-2 border-transparent active:border-sage-400 transition-all"
                  >
                    <img src={e.imageUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* From camera / gallery */}
          <label className="flex items-center gap-4 bg-surface hover:bg-surface-2 rounded-2xl px-4 py-3.5 cursor-pointer">
            <span className="text-gray-500"><Camera size={22} /></span>
            <span className="text-sm font-medium text-gray-800">Fotografuoti</span>
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} />
          </label>
          <label className="flex items-center gap-4 bg-surface hover:bg-surface-2 rounded-2xl px-4 py-3.5 cursor-pointer">
            <span className="text-gray-500"><ImageIcon size={22} /></span>
            <span className="text-sm font-medium text-gray-800">Pasirinkti iš galerijos</span>
            <input type="file" accept="image/*" className="hidden"
              onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} />
          </label>

          <button className="w-full py-3.5 rounded-2xl text-sm font-medium text-gray-500 bg-surface-2" onClick={onClose}>
            Atšaukti
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function Section({ title, children, id }) {
  return (
    <div id={id} className="space-y-2">
      <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">{title}</p>
      {children}
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

// ── Profile tab content ────────────────────────────────────────

export function ProfileContent({ plant, section, onAction, onClose, className }) {

  return (
    <div className={className ?? "px-5 pt-5 pb-10 space-y-6"}>

      {/* ── Watering overdue reminder ── */}
      <WateringCard plant={plant} section={section} />

      {/* ── Fertilizing forecast / reminder ── */}
      <FertilizingCard plant={plant} section={section} />

      {/* ── Dormancy reminder ── */}
      <DormancyCard plant={plant} section={section} />


      {/* ── Toxicity warning ── */}
      {plant.toksiskas && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-3.5 flex gap-3">
          <Skull size={22} className="flex-shrink-0 text-red-500 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-600">Toksiška augalas!</p>
            <p className="text-xs text-red-500 mt-0.5 leading-snug">{plant.toksiskumo_info}</p>
          </div>
        </div>
      )}

      {/* ── Quick stats card ── */}
      <div className="bg-surface rounded-2xl p-4 space-y-3">
        {plant.kilme && (
          <div className="flex items-start gap-2">
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-700 w-20 flex-shrink-0"><MapPin size={12} className="text-gray-400" /> Kilmė</span>
            <span className="text-xs text-gray-700 leading-snug">{plant.kilme}</span>
          </div>
        )}
        {plant.tipas && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700 w-20 flex-shrink-0">Tipas</span>
            <span className="text-xs text-gray-700">{plant.tipas}</span>
          </div>
        )}
        {plant.augimo_greitis && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700 w-20 flex-shrink-0">Augimas</span>
            <span className="text-xs text-gray-700">{plant.augimo_greitis}</span>
          </div>
        )}
        {plant.sunkumas != null && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700 w-20 flex-shrink-0">Sunkumas</span>
            <Stars value={plant.sunkumas} />
          </div>
        )}
        {plant.sviesa?.taskai != null && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-700 w-20 flex-shrink-0"><Sun size={12} className="text-gray-400" /> Šviesa</span>
            <div className="flex items-center gap-2 flex-wrap">
              <DotScore value={plant.sviesa.taskai} color="bg-amber-400" />
              <span className="text-xs text-gray-500">{plant.sviesa.lygis}</span>
              {plant.sviesa?.ppfd && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5 leading-none">
                  {plant.sviesa.ppfd.min}–{plant.sviesa.ppfd.max} μmol/m²/s
                </span>
              )}
            </div>
          </div>
        )}
        {plant.vanduo?.taskai != null && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-700 w-20 flex-shrink-0"><Droplets size={12} className="text-gray-400" /> Vanduo</span>
            <div className="flex items-center gap-2">
              <DotScore value={plant.vanduo.taskai} color="bg-blue-400" />
              <span className="text-xs text-gray-500">{plant.vanduo.lygis}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Description + origin ── */}
      {plant.aprasymas && (
        <Section title="Apie augalą">
          <p className="text-sm text-gray-600 leading-relaxed">{plant.aprasymas}</p>
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
                  // iNaturalist: only shown when API confirmed an exact taxon match
                  ...(plant.inatTaxonId
                    ? [{ label: 'iNaturalist', href: `https://www.inaturalist.org/taxa/${plant.inatTaxonId}` }]
                    : []),
                ]
                return links.map(({ label, href }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-sage-500 hover:text-sage-700 underline underline-offset-2 transition-colors">
                    {label}
                  </a>
                ))
              })()}
            </div>
          )}
        </Section>
      )}

      {/* ── Care ── */}
      {plant.prieziura && (
        <Section title="Priežiūra" id="prieziura-section">
          <div className="bg-surface rounded-2xl divide-y divide-gray-100">
            <InfoRow icon={<Sun size={15} />}         label="Šviesa"      value={plant.prieziura.sviesa} />
            <InfoRow icon={<Droplets size={15} />}    label="Laistymas"   value={plant.prieziura.laistymas} />
            <InfoRow icon={<Thermometer size={15} />} label="Temperatūra" value={plant.prieziura.temperatura} />
            <InfoRow icon={<Wind size={15} />}        label="Drėgmė"      value={plant.prieziura.dregme} />
          </div>
        </Section>
      )}

      {/* ── Substrate / repotting / winter ── */}
      {(plant.substratas || plant.persodinimas || plant.ziemojimas) && (
        <Section title="Substratas ir sezoniškumas">
          <div className="bg-surface rounded-2xl divide-y divide-gray-100">
            <InfoRow icon={<Flower2 size={15} />}   label="Substratas"   value={plant.substratas} />
            <InfoRow icon={<RefreshCw size={15} />} label="Persodinimas" value={plant.persodinimas} />
            <InfoRow icon={<Snowflake size={15} />}  label="Žiemojimas"   value={plant.ziemojimas} />
          </div>
        </Section>
      )}

      {/* ── Propagation ── */}
      {plant.dauginimas?.length > 0 && (
        <Section title="Dauginimas">
          <div className="space-y-1.5">
            {plant.dauginimas.map((d, i) => (
              <div key={i} className="flex items-start gap-2.5 bg-sage-50 rounded-xl px-3 py-2.5">
                <span className="text-sage-400 font-bold text-sm mt-0.5 flex-shrink-0">·</span>
                <p className="text-sm text-gray-700">{d}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Problems ── */}
      {plant.problemos?.length > 0 && (
        <Section title="Problemų diagnostika">
          <div className="space-y-2">
            {plant.problemos.map((p, i) => (
              <div key={i} className="bg-red-50/60 rounded-2xl overflow-hidden border border-red-100/60">
                <div className="px-3 py-2 bg-red-50 border-b border-red-100/60">
                  <p className="text-xs font-bold text-red-500 uppercase tracking-wide">Simptomas</p>
                  <p className="text-sm font-semibold text-red-700 mt-0.5">{p.simptomas}</p>
                </div>
                <div className="px-3 py-2 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Priežastis</p>
                    <p className="text-xs text-gray-600 mt-0.5 leading-snug">{p.priezastis}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Sprendimas</p>
                    <p className="text-xs text-gray-600 mt-0.5 leading-snug">{p.sprendimas}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Interesting facts ── */}
      {plant.idomybes?.length > 0 && (
        <Section title="Įdomybės">
          <div className="space-y-2">
            {plant.idomybes.map((fact, i) => (
              <div key={i} className="flex items-start gap-3 bg-amber-50 rounded-xl px-3 py-2.5">
                <Leaf size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 leading-snug">{fact}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── History: death + lesson ── */}
      {section === 'istorija' && (
        <Section title="Augalo istorija">
          <div className="space-y-2">
            {plant.deathReason && (
              <div className="bg-red-50 rounded-2xl p-3">
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Priežastis</p>
                <p className="text-sm text-red-700">{plant.deathReason}</p>
              </div>
            )}
            {plant.lesson && (
              <div className="bg-amber-50 rounded-2xl p-3">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Pamoka</p>
                <p className="text-sm text-amber-800">{plant.lesson}</p>
              </div>
            )}
          </div>
        </Section>
      )}


      {/* ── Actions ── */}
      {onAction && (
        <div className="flex flex-col gap-2 pt-1">
          {section === 'nori' && (<>
            <button onClick={() => { onAction('buy', plant); onClose() }}
              className="w-full py-3.5 rounded-2xl text-sm font-medium text-white bg-sage-500 hover:bg-sage-600 transition-colors">
              Pirkau, turiu!
            </button>
            <button onClick={() => onAction('pirkinys', plant)}
              className={`w-full py-3 rounded-2xl text-sm font-medium transition-colors ${
                plant.pirkinys
                  ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                  : 'bg-surface-2 text-gray-500 hover:bg-surface-2'
              }`}>
              {plant.pirkinys ? 'Pirkimo sąraše ✓' : 'Pridėti į pirkimo sąrašą'}
            </button>
          </>)}
          {section === 'istorija' && (<>
            <button onClick={() => { onAction('tryAgain', plant); onClose() }}
              className="w-full py-3.5 rounded-2xl text-sm font-medium text-white bg-sage-500 hover:bg-sage-600 transition-colors">
              Bandyti vėl
            </button>
            <button onClick={() => onAction('pirkinys', plant)}
              className={`w-full py-3 rounded-2xl text-sm font-medium transition-colors ${
                plant.pirkinys
                  ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                  : 'bg-surface-2 text-gray-500 hover:bg-surface-2'
              }`}>
              {plant.pirkinys ? 'Pirkimo sąraše ✓' : 'Noriu nusipirkti vėl'}
            </button>
          </>)}
          {(section === 'auginama' || section === 'nori' || section === 'istorija') && (
            <button onClick={() => onAction('delete', plant)}
              className="w-full py-3 rounded-2xl text-sm font-medium text-gray-400 hover:text-red-400 transition-colors">
              Ištrinti
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Notes tab content ──────────────────────────────────────────

function NoteCard({ note, expanded, onToggle, onEdit, onDelete, onShare, onToggleStar, onChat }) {
  return (
    <motion.div
      className="bg-surface rounded-2xl px-4 py-3.5 cursor-pointer active:bg-surface-2 transition-colors"
      onClick={onToggle}
      layout
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start gap-2">
        <p className={`flex-1 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}>
          {note.text}
        </p>
        <button
          onClick={e => { e.stopPropagation(); onToggleStar() }}
          className="flex-shrink-0 text-base leading-none mt-0.5 transition-transform active:scale-90"
        >
          {note.starred
            ? <Star size={14} className="text-amber-400 fill-amber-400" />
            : <Star size={14} className="text-gray-400" />
          }
        </button>
      </div>
      {expanded && (
        <div className="flex gap-4 mt-2.5 pt-2 border-t border-gray-200">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="flex items-center gap-1 text-xs text-sage-600 hover:text-sage-800 font-medium transition-colors"
          >
            <Pencil size={11} /> Redaguoti
          </button>
          <button
            onClick={e => { e.stopPropagation(); onChat() }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors"
          >
            <MessageCircle size={11} /> Aptarti
          </button>
          <button
            onClick={e => { e.stopPropagation(); onShare() }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors"
          >
            <Globe size={11} /> Į žinyną
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors ml-auto"
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
                className="flex-1 py-2.5 rounded-2xl text-sm text-white bg-sage-500 disabled:opacity-40">Išsaugoti</button>
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
            className="w-full bg-surface rounded-2xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none resize-none border border-transparent focus:border-sage-300 transition-colors"
            rows={5} value={newText} onChange={e => setNewText(e.target.value)}
            placeholder="Nauja mintis..." autoFocus
          />
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setNewText('') }}
              className="flex-1 py-2.5 rounded-2xl text-sm text-gray-500 bg-surface-2">Atšaukti</button>
            <button onClick={addNote} disabled={!newText.trim()}
              className="flex-1 py-2.5 rounded-2xl text-sm text-white bg-sage-500 disabled:opacity-40">Išsaugoti</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full py-3 rounded-2xl text-sm text-sage-500 bg-sage-50 hover:bg-sage-100 transition-colors">
          + Pridėti mintį
        </button>
      )}

      {notes.length === 0 && !adding && (
        <p className="text-xs text-gray-500 text-center leading-relaxed px-4 pt-1">
          Išsaugokite stebėjimus arba mintį iš pokalbio su AI spausdami <Bookmark size={12} className="inline align-text-bottom mx-0.5" />
        </p>
      )}
    </div>
  )
}

// ── Tab bar ────────────────────────────────────────────────────

function TabBar({ active, onChange, noteCount = 0 }) {
  return (
    <div className="flex border-b border-warm-border px-5 flex-shrink-0 bg-app">
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
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage-500 rounded-full"
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
        className="relative w-full max-w-[430px] bg-app rounded-t-4xl px-5 pb-8 pt-3"
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
  onClearTimeline,
  zones = [],
  onZoneChange,
  plants = [],
  onAddZone,
  onUpdateZone,
  onDeleteZone,
  onReorderZones,
  scrollToCare = false,
  visible = true,
}) {
  const [activeTab, setActiveTab]           = useState('profile')
  const [heroError, setHeroError]           = useState(false)
  const [showPhotoSheet, setShowPhoto]      = useState(false)
  const [showChat, setShowChat]             = useState(false)
  const [chatInitialQuery, setChatQuery]    = useState('')
  const [showStatusMenu, setStatusMenu]     = useState(false)
  const [pendingStatus, setPendingStatus]   = useState(null) // { newStatus, fromStatus }
  const [addingType, setAddingType]         = useState(null)
  const [editingName, setEditingName]       = useState(false)
  const [nameVal, setNameVal]               = useState('')
  const [showZonePicker, setShowZonePicker] = useState(false)
  const status                              = plant.status ?? 'healthy'
  const currentZone                         = zones.find(z => z.id === plant.zonaId) ?? null
  const mood                            = getPlantMood(plant)
  const fetchedRef                      = useRef(false)
  const scrollContainerRef              = useRef(null)

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

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" style={{ pointerEvents: visible ? '' : 'none' }}>
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="relative w-full max-w-[430px] bg-app flex flex-col"
        style={{ height: '100dvh', y }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.25 }}
        onDragEnd={handleDragEnd}
        initial={{ y: '100%' }}
        animate={{ y: visible ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      >
        {/* Drag handle — pointer-events only on the pill, not full width */}
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-center pb-2 pointer-events-none select-none" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
          <div
            onPointerDown={e => dragControls.start(e)}
            className="px-8 py-1 cursor-grab active:cursor-grabbing pointer-events-auto"
            style={{ touchAction: 'none' }}
          >
            <div className="w-10 h-1 bg-black/15 rounded-full" />
          </div>
        </div>

        {/* ── Hero ── */}
        {plant.image && !heroError ? (
          <div className="relative flex-shrink-0 overflow-hidden" style={{ height: 'calc(17rem + env(safe-area-inset-top))' }}>
            <img
              src={plant.image} alt={plant.lietuviškas}
              className="w-full h-full object-cover"
              onError={() => setHeroError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            <div className="absolute left-0 right-0 flex items-center justify-between px-4 z-30" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
              <button
                onClick={() => setShowPhoto(true)}
                className="w-11 h-11 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
              >
                <MoreHorizontal size={16} />
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="w-11 h-11 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  {section === 'auginama' && zones.length > 0 && (
                    <button
                      onClick={() => setShowZonePicker(true)}
                      className="inline-flex items-center gap-1 mb-1 px-2 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                    >
                      <MapPin size={9} className="text-white/80" />
                      <span className="text-[10px] text-white/90 font-medium">
                        {currentZone ? currentZone.name : 'Nepriskirta'}
                      </span>
                    </button>
                  )}
                  {editingName ? (
                    <input
                      autoFocus
                      value={nameVal}
                      onChange={e => setNameVal(e.target.value)}
                      onBlur={() => { onUpdateNames?.(plant.id, { 'lietuviškas': nameVal.trim() || plant.lietuviškas }); setEditingName(false) }}
                      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingName(false) }}
                      className="text-xl font-bold leading-tight bg-white/20 text-white rounded-lg px-2 py-0.5 outline-none w-full"
                    />
                  ) : (
                    <h2
                      className="text-xl font-bold text-white leading-tight cursor-text"
                      onClick={() => { setNameVal(plant.lietuviškas); setEditingName(true) }}
                    >{plant.lietuviškas}</h2>
                  )}
                  <p className="text-xs text-white/70 italic mt-0.5">{plant.lotyniskas}</p>
                  {(plant.inatLtName || plant.sinonimai?.length > 0 || plant.englishNames?.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {plant.inatLtName && plant.inatLtName !== plant.lietuviškas && (
                        <span className="text-[10px] text-white/80 bg-white/15 rounded px-1.5 py-0.5">{plant.inatLtName}</span>
                      )}
                      {plant.sinonimai?.filter(s => s !== plant.inatLtName).map((s, i) => (
                        <span key={i} className="text-[10px] text-white/80 bg-white/15 rounded px-1.5 py-0.5">{s}</span>
                      ))}
                      {plant.englishNames?.map((n, i) => (
                        <span key={i} className="text-[10px] text-white/60 bg-white/10 rounded px-1.5 py-0.5 italic">{n}</span>
                      ))}
                    </div>
                  )}
                </div>
                {section === 'auginama' && (
                  <div className="relative flex-shrink-0">
                    <StatusButton status={status} variant="dark" onClick={() => setStatusMenu(v => !v)} />
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
              </div>
            </div>
          </div>
        ) : (
          <div className={`flex-shrink-0 px-5 pb-4 ${
            section === 'istorija' ? 'bg-surface-2' :
            section === 'nori'     ? 'bg-blush-50' : 'bg-sage-50'
          }`} style={{ paddingTop: 'max(1.75rem, env(safe-area-inset-top))' }}>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setShowPhoto(true)}
                className="w-11 h-11 bg-white/60 rounded-full flex items-center justify-center text-gray-500"
              >
                <MoreHorizontal size={16} />
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="w-11 h-11 bg-white/60 rounded-full flex items-center justify-center text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-white/80 rounded-2xl flex items-center justify-center text-3xl shadow-ios flex-shrink-0">
                {plant.emoji ?? '🌿'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {editingName ? (
                      <input
                        autoFocus
                        value={nameVal}
                        onChange={e => setNameVal(e.target.value)}
                        onBlur={() => { onUpdateNames?.(plant.id, { 'lietuviškas': nameVal.trim() || plant.lietuviškas }); setEditingName(false) }}
                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingName(false) }}
                        className="text-lg font-bold text-gray-900 leading-tight bg-surface-2 rounded-lg px-2 py-0.5 outline-none w-full"
                      />
                    ) : (
                      <h2
                        className="text-lg font-bold text-gray-900 leading-tight cursor-text"
                        onClick={() => { setNameVal(plant.lietuviškas); setEditingName(true) }}
                      >{plant.lietuviškas}</h2>
                    )}
                    <p className="text-xs text-gray-500 italic mt-0.5">{plant.lotyniskas}</p>
                  </div>
                  {section === 'auginama' && (
                    <div className="relative flex-shrink-0">
                      <StatusButton status={status} variant="colored" onClick={() => setStatusMenu(v => !v)} />
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
                </div>
                {(plant.inatLtName || plant.sinonimai?.length > 0 || plant.englishNames?.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {plant.inatLtName && plant.inatLtName !== plant.lietuviškas && (
                      <span className="text-[10px] text-sage-700 bg-sage-100 rounded px-1.5 py-0.5">{plant.inatLtName}</span>
                    )}
                    {plant.sinonimai?.filter(s => s !== plant.inatLtName).map((s, i) => (
                      <span key={i} className="text-[10px] text-sage-700 bg-sage-100 rounded px-1.5 py-0.5">{s}</span>
                    ))}
                    {plant.englishNames?.map((n, i) => (
                      <span key={i} className="text-[10px] text-gray-500 bg-white border border-gray-200 rounded px-1.5 py-0.5 italic">{n}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
                  onAddEvent={event => onAddTimelineEvent?.(plant.id, event)}
                  onDeleteEvent={eventId => onDeleteTimelineEvent?.(plant.id, eventId)}
                  onClearTimeline={() => onClearTimeline?.(plant.id)}
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

        {/* Floating AI bubble — bottom-left, profile tab only */}
        {section === 'auginama' && activeTab === 'profile' && (
          <button
            onClick={() => setShowChat(true)}
            className="absolute bottom-5 right-4 z-20 active:scale-90 transition-transform"
          >
            <div className="animate-idle-float opacity-90">
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
            onSave={(url, fromHistory = false) => { onImageSave?.(plant.id, url, fromHistory); setShowPhoto(false) }}
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
    </div>
  )
}
