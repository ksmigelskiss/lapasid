import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls, useMotionValue, animate } from 'framer-motion'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { useDetailHost } from '../../contexts/DetailHostContext'
import { X, Camera, Trash2, Loader2, MoreHorizontal, MapPin, ChevronLeft, ChevronRight, ChevronDown, Copy } from 'lucide-react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../utils/firebase'
import { ZonePicker } from '../ZoneManager'
import PlantTimeline, { FAB, AddEventSheet } from '../PlantTimeline'
import BarcodeLifeline from '../brand/BarcodeLifeline'
import PlantImage from '../brand/PlantImage'
import { makeId, today } from '../../utils/plantTransform'
import { getPlantEnrichmentState } from '../../utils/plantState'
import { heroIllustrationFor, heroThumbFor, heroIsDefaultFor } from '../../utils/catalog'
import { fetchPlantNames } from '../../utils/plantNames'
import { resizeImage } from '../../utils/imageService'
import { getPlantMood } from '../../utils/plantMood'
import PlantChat from '../PlantChat'
import { PlantAvatar } from '../icons/ChatIcons'
import { StatusMenu, STATUS_ICON } from '../StatusPicker'
import { getStatusMeta } from '../../constants/plant'
import PhotoSheet from './PhotoSheet'
import StatusTransitionSheet from './StatusTransitionSheet'
import NotesContent, { mkNoteId, noteToday, loadNotes } from './NotesContent'
import HeroSafetyStrip from './HeroSafetyStrip'
import { ProfileContent } from './ProfileContent'

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
