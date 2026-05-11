import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls, useMotionValue, animate } from 'framer-motion'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useDetailHost } from '../contexts/DetailHostContext'
import { X, Camera, Image as ImageIcon, Search, Sun, Droplets, Thermometer, Wind, Flower2, RefreshCw, Star, Bookmark, Globe, MessageCircle, Pencil, Trash2, Loader2, MoreHorizontal, Leaf, Skull, Snowflake, MapPin, ChevronRight, ChevronDown, Share2, Copy, Check, Link2 } from 'lucide-react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../utils/firebase'
import { ZonePicker } from './ZoneManager'
import PlantTimeline, { FAB, AddEventSheet } from './PlantTimeline'
import { getWateringForecast } from '../utils/wateringForecast'
import { fetchPlantNames } from '../utils/plantNames'
import { fetchPhotos, resizeImage } from '../utils/imageService'
import { getPlantMood } from '../utils/plantMood'
import PlantChat from './PlantChat'
import { PlantAvatar } from './icons/ChatIcons'
import { WateringCard, FertilizingCard, DormancyCard } from './ForecastCards'
import { StatusButton, StatusMenu, STATUS_ICON } from './StatusPicker'
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
                useHistory ? 'bg-forest-600 text-bone' : 'bg-surface-2 text-gray-600'
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
                    className="w-9 h-9 bg-black/40 backdrop-blur-sm rounded-btn flex items-center justify-center text-white text-base disabled:opacity-20"
                  >‹</button>
                  <button
                    disabled={!hasNext}
                    onClick={() => setIdx(i => i + 1)}
                    className="w-9 h-9 bg-black/40 backdrop-blur-sm rounded-btn flex items-center justify-center text-white text-base disabled:opacity-20"
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
                className="w-full py-3 rounded-2xl text-sm font-semibold text-bone bg-forest-600"
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
    <div id={id} className="space-y-2.5">
      <div className="flex items-center gap-3">
        <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em]">{title}</p>
        <div className="flex-1 h-px bg-bone-400/40" />
      </div>
      {children}
    </div>
  )
}

function InfoRow({ icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-2.5 border-b border-bone-400/30 last:border-0">
      <div className="w-6 flex-shrink-0 flex items-center justify-center text-forest-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em]">{label}</p>
        <p className="text-sm text-forest-700 mt-1 leading-snug">{value}</p>
      </div>
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

export function ProfileContent({ plant, section, onAction, onClose, collectionId, onTogglePassport, className }) {

  return (
    <div className={className ?? "px-5 pt-5 pb-10 space-y-6"}>

      {/* ── Watering overdue reminder ── */}
      <WateringCard plant={plant} section={section} />

      {/* ── Fertilizing forecast / reminder ── */}
      <FertilizingCard plant={plant} section={section} />

      {/* ── Dormancy reminder ── */}
      <DormancyCard plant={plant} section={section} />


      {/* ── Toxicity warning — Brandbook terracotta callout (severe). ── */}
      {plant.toksiskas && (
        <div className="bg-white/55 backdrop-blur-xl border-2 border-terracotta/50 rounded-2xl p-3.5 flex gap-3">
          <Skull size={22} className="flex-shrink-0 text-terracotta mt-0.5" />
          <div>
            <p className="font-mono text-[10px] font-medium text-terracotta-600 uppercase tracking-[0.16em]">Pavojinga</p>
            <p className="font-display text-sm font-bold text-terracotta-600 tracking-tight mt-0.5">Toksiška augalas!</p>
            <p className="text-xs text-forest-600 mt-1 leading-snug">{plant.toksiskumo_info}</p>
          </div>
        </div>
      )}

      {/* ── Quick stats — editorial table (mono caps label + Bricolage value). ── */}
      <div className="divide-y divide-bone-400/30">
        {plant.kilme && (
          <div className="flex items-start gap-3 py-2.5">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em] w-24 flex-shrink-0"><MapPin size={11} className="text-forest-400" /> Kilmė</span>
            <span className="text-sm text-forest-700 leading-snug flex-1">{plant.kilme}</span>
          </div>
        )}
        {plant.tipas && (
          <div className="flex items-center gap-3 py-2.5">
            <span className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em] w-24 flex-shrink-0">Tipas</span>
            <span className="text-sm text-forest-700">{plant.tipas}</span>
          </div>
        )}
        {plant.augimo_greitis && (
          <div className="flex items-center gap-3 py-2.5">
            <span className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em] w-24 flex-shrink-0">Augimas</span>
            <span className="text-sm text-forest-700">{plant.augimo_greitis}</span>
          </div>
        )}
        {plant.sunkumas != null && (
          <div className="flex items-center gap-3 py-2.5">
            <span className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em] w-24 flex-shrink-0">Sunkumas</span>
            <Stars value={plant.sunkumas} />
          </div>
        )}
        {plant.sviesa?.taskai != null && (
          <div className="flex items-center gap-3 py-2.5">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em] w-24 flex-shrink-0"><Sun size={11} className="text-terracotta-400" /> Šviesa</span>
            <div className="flex items-center gap-2 flex-wrap">
              <DotScore value={plant.sviesa.taskai} color="bg-terracotta-400" />
              <span className="text-sm text-forest-700">{plant.sviesa.lygis}</span>
              {plant.sviesa?.ppfd && (
                <span className="font-mono text-[10px] font-medium text-terracotta-600 bg-terracotta-50 border border-terracotta-200/60 rounded-md px-1.5 py-0.5 leading-none">
                  {plant.sviesa.ppfd.min}–{plant.sviesa.ppfd.max} μmol/m²/s
                </span>
              )}
            </div>
          </div>
        )}
        {plant.vanduo?.taskai != null && (
          <div className="flex items-center gap-3 py-2.5">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em] w-24 flex-shrink-0"><Droplets size={11} className="text-forest-400" /> Vanduo</span>
            <div className="flex items-center gap-2">
              <DotScore value={plant.vanduo.taskai} color="bg-forest-400" />
              <span className="text-sm text-forest-700">{plant.vanduo.lygis}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Description + external links ── */}
      {plant.aprasymas && (
        <Section title="Apie augalą">
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

      {/* ── Care ── */}
      {plant.prieziura && (
        <Section title="Priežiūra" id="prieziura-section">
          <div className="divide-y divide-bone-400/30">
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
          <div className="divide-y divide-bone-400/30">
            <InfoRow icon={<Flower2 size={15} />}   label="Substratas"   value={plant.substratas} />
            <InfoRow icon={<RefreshCw size={15} />} label="Persodinimas" value={plant.persodinimas} />
            <InfoRow icon={<Snowflake size={15} />}  label="Žiemojimas"   value={plant.ziemojimas} />
          </div>
        </Section>
      )}

      {/* ── Propagation — editorial bullets (be konteinerio fono). ── */}
      {plant.dauginimas?.length > 0 && (
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
      {plant.problemos?.length > 0 && (
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
      {plant.idomybes?.length > 0 && (
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

      {/* ── Actions ── */}
      {onAction && (
        <div className="flex flex-col gap-2 pt-1">
          {section === 'nori' && (
            <button onClick={() => onAction('buy', plant)}
              className="w-full py-3.5 rounded-2xl text-sm font-medium text-white bg-forest-600 hover:bg-forest-700 transition-colors">
              Pirkau, turiu!
            </button>
          )}
          {section === 'istorija' && (<>
            <button onClick={() => { onAction('tryAgain', plant); onClose() }}
              className="w-full py-3.5 rounded-2xl text-sm font-medium text-white bg-forest-600 hover:bg-forest-700 transition-colors">
              Bandyti vėl
            </button>
            <button onClick={() => { onAction('wantAgain', plant); onClose() }}
              className="w-full py-3 rounded-2xl text-sm font-medium bg-surface-2 text-gray-600 hover:bg-surface-2 transition-colors">
              Noriu nusipirkti vėl
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
      className="border border-bone-400/40 rounded-2xl px-4 py-3.5 cursor-pointer active:bg-bone-300/40 transition-colors"
      onClick={onToggle}
      layout
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start gap-2">
        <p className={`flex-1 text-sm text-forest-700 leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}>
          {note.text}
        </p>
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
      setEditingName(false)
      setPendingStatus(null)
      setAddingType(null)
    }
  }, [visible])

  useEffect(() => {
    setShowZonePicker(false)
    setShowPhoto(false)
    setStatusMenu(false)
    setShowChat(false)
    setEditingName(false)
    setPendingStatus(null)
    setAddingType(null)
  }, [plant.id])

  // ESC keyboard shortcut — uždaryti PlantDetail desktop'e. JEI atvertas sub-modal'as
  // (ZonePicker, photo sheet, status menu, chat, editing, status transition, adding)
  // — jo paties ESC handler'is uždaro jį, o mūsų handler'is praleidžia (kad nepasitiktų
  // dvigubas close — top sub-modal first, parent second).
  useEffect(() => {
    if (!useDesktopPanel || !visible) return
    const handler = (e) => {
      if (e.key !== 'Escape') return
      const subModalOpen = showZonePicker || showPhotoSheet || showStatusMenu
        || showChat || editingName || pendingStatus || addingType
      if (subModalOpen) return
      onClose?.()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [useDesktopPanel, visible, showZonePicker, showPhotoSheet, showStatusMenu, showChat, editingName, pendingStatus, addingType, onClose])

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
        ? "absolute inset-0 bg-app flex flex-col"
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

      {/* Sheet */}
      <motion.div
        className={useDesktopPanel
          ? "relative w-full h-full bg-app flex flex-col"
          : "relative w-full max-w-[430px] bg-app flex flex-col"}
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

        {/* ── Hero — editorial layout: toolbar / photo / text block on bone ── */}
        <div className="flex-shrink-0">
          {/* Top toolbar — kompaktiškas, ant bone, virš foto */}
          <div
            className="flex items-center justify-between px-4 pb-2"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
          >
            <button
              onClick={() => setShowPhoto(true)}
              className="flex items-center justify-center text-forest-400 active:text-forest-700 transition-colors px-1 py-2"
              aria-label="Pakeisti nuotrauką"
            >
              <MoreHorizontal size={20} />
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-bone-300/60 hover:bg-bone-400/60 rounded-btn flex items-center justify-center text-forest-700 transition-colors"
              aria-label="Uždaryti"
            >
              <X size={16} />
            </button>
          </div>

          {/* Photo — clean rectangle, no overlay. Emoji fallback if no image. */}
          {plant.image && !heroError ? (
            <button
              onClick={() => setShowPhoto(true)}
              className="block w-full aspect-[4/3] overflow-hidden bg-bone-300"
              aria-label="Pakeisti nuotrauką"
            >
              <img
                src={plant.image} alt={plant.lietuviškas}
                className="w-full h-full object-cover"
                onError={() => setHeroError(true)}
              />
            </button>
          ) : (
            <button
              onClick={() => setShowPhoto(true)}
              className="w-full aspect-[4/3] flex items-center justify-center text-8xl bg-bone-300"
              aria-label="Pridėti nuotrauką"
            >
              {plant.emoji ?? '🌿'}
            </button>
          )}

          {/* Editorial title block — ant bone, magazine ritmu */}
          <div className="px-5 pt-4 pb-4">
            {/* Metadata row: lokacija + status (mono caps) */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {section === 'auginama' && zones.length > 0 && (
                <button
                  onClick={() => setShowZonePicker(v => !v)}
                  className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500 hover:text-forest-700 transition-colors"
                >
                  <MapPin size={11} className="text-forest-400" />
                  {currentZone ? currentZone.name : 'Nepriskirta'}
                </button>
              )}
              {section === 'auginama' && zones.length > 0 && (
                <span className="text-forest-300" aria-hidden>·</span>
              )}
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
                    {getStatusMeta(status).label}
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
            </div>

            {/* Title — Bricolage 600 ant bone, scaled */}
            {editingName ? (
              <input
                autoFocus
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onBlur={() => { onUpdateNames?.(plant.id, { 'lietuviškas': nameVal.trim() || plant.lietuviškas }); setEditingName(false) }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingName(false) }}
                className="font-display text-2xl font-semibold tracking-tight leading-tight text-forest-800 bg-bone-300/40 rounded-lg px-2 py-0.5 outline-none w-full mt-2"
              />
            ) : (
              <h2
                className="font-display text-2xl font-semibold tracking-tight text-forest-800 leading-tight cursor-text mt-2"
                onClick={() => { setNameVal(plant.lietuviškas); setEditingName(true) }}
              >{plant.lietuviškas}</h2>
            )}
            {plant.lotyniskas && (
              <p className="text-sm text-forest-500 italic mt-1">{plant.lotyniskas}</p>
            )}

            {/* Synonyms — inline editorial, ne chips (žymiai readable'esnis) */}
            {(plant.inatLtName || plant.sinonimai?.length > 0 || plant.englishNames?.length > 0) && (
              (() => {
                const ltSyns = [
                  plant.inatLtName && plant.inatLtName !== plant.lietuviškas ? plant.inatLtName : null,
                  ...(plant.sinonimai?.filter(s => s !== plant.inatLtName) ?? []),
                ].filter(Boolean)
                const enSyns = plant.englishNames ?? []
                return (
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
                )
              })()
            )}
          </div>
        </div>

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
    </div>
  )

  if (useDesktopPanel) {
    if (!visible) return null
    return createPortal(tree, host.container)
  }
  return tree
}
