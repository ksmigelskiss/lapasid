import { useState, useCallback, useEffect, useRef, lazy, Suspense, useMemo } from 'react'
import { useCareLists } from './components/CareOverview'
import { AnimatePresence, motion } from 'framer-motion'
import Navigation from './components/Navigation'
import DeathModal from './components/DeathModal'
import DeleteModal from './components/DeleteModal'
import DuplicateBuyModal from './components/DuplicateBuyModal'
import Dashboard from './pages/Dashboard'
import { usePlants } from './hooks/usePlants'
import { useAuth } from './hooks/useAuth'
import { useIsDesktop } from './hooks/useIsDesktop'
import DesktopLayout from './components/desktop/DesktopLayout'
import DesktopHeader from './components/desktop/DesktopHeader'
import MobileHeader from './components/MobileHeader'
import { DetailHostProvider } from './contexts/DetailHostContext'
import LoginScreen from './components/LoginScreen'
import PendingApprovalScreen from './components/PendingApprovalScreen'
import BrandLoader from './components/brand/BrandLoader'
import DiscoveryToast from './components/DiscoveryToast'
import T4Icon from './components/brand/T4Icon'
import { fetchBestPhoto, uploadImage, uploadImageWithThumb } from './utils/imageService'
import { subscribeCatalog, resolvePlantView } from './utils/catalog'

// ChunkLoadError (senas SW aptarnauja seną HTML su naujais chunk hash'ais) → force reload.
// Prieš reload'ą išsaugom esamą tab'ą sessionStorage'e, kad po app restart'o
// vartotojas grįžtų į tą patį tab'ą (Biblioteka/Žinynas), o ne į default Dashboard.
// Kiti tinklo errori → retry kartą.
function lazyWithRetry(factory) {
  return lazy(() =>
    factory().catch(err => {
      const isChunkErr = err?.name === 'ChunkLoadError' || /Loading chunk|Failed to fetch dynamically/i.test(err?.message ?? '')
      if (isChunkErr) {
        // tab persistence — App.jsx skaito šitą per useState init'ą.
        try {
          const lastTab = sessionStorage.getItem('chunk-reload-tab')
          if (!lastTab) sessionStorage.setItem('chunk-reload-tab', sessionStorage.getItem('current-tab') || 'dashboard')
        } catch {}
        window.location.reload()
        return new Promise(() => {})
      }
      return factory() // retry kartą
    })
  )
}

const SearchModal = lazyWithRetry(() => import('./components/SearchModal'))
const PlantDetail = lazyWithRetry(() => import('./components/PlantDetail'))
const ProfileSheet = lazyWithRetry(() => import('./components/ProfileSheet'))
const Biblioteka  = lazyWithRetry(() => import('./pages/Biblioteka'))
const AdminPanel  = lazyWithRetry(() => import('./components/admin/AdminPanel'))
const Zinynas     = lazyWithRetry(() => import('./pages/Zinynas'))

export default function App() {
  const {
    user, collectionId, role, ownCollectionId, allCollections,
    loading: authLoading, authError, loadingMessage,
    viewerToken, isAdmin, pendingApproval,
    signInGoogle, signInFacebook, signOut, switchCollection, renameCollection,
  } = useAuth()

  // /admin route'as — gate'inta isAdmin flag'u. URL param patternas vienodas
  // su dev playground'ais (?playground=loaders, ?export=plants). Lazy load'as
  // — bundle'as auga tik admin'ams.
  const [showAdmin, setShowAdmin] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('admin') === '1'
  })

  const isDesktop = useIsDesktop()

  // Išsaugome invite tokeną localStorage — fallback jei processPendingInvite
  // neužspėja nuskaityti URL prieš sign-in redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token  = params.get('invite')
    if (token) {
      localStorage.setItem('pending-invite', token)
      // URL valomas processPendingInvite, ne čia — kad išliktų kol auth baigiasi
    }
  }, [])

  // Tab init — jei buvo chunk-reload (Biblioteka/Žinynas lazy import fail'ino,
  // visa app reload'inosi), restore'inam pasirinktą tab'ą iš sessionStorage'o,
  // kad vartotojas nepamatytų grąžinimo į Dashboard.
  const [tab, setTab] = useState(() => {
    try {
      const reloadTab = sessionStorage.getItem('chunk-reload-tab')
      if (reloadTab) {
        sessionStorage.removeItem('chunk-reload-tab')
        if (['dashboard', 'biblioteka', 'zinynas'].includes(reloadTab)) return reloadTab
      }
    } catch {}
    return 'dashboard'
  })
  const [mountedTabs, setMountedTabs] = useState(() => new Set([tab]))
  const [dashCareMode, setDashCareMode] = useState(false)
  const [dashCareConfidence, setDashCareConfidence] = useState(0)
  // Hero watercolor illustrations — LIVE catalog subscription palaiko module
  // cache'ą gyvai (PlantCard sync resolve'ina be prop threading'o). heroMapV
  // bump'as → cards re-render kai serveris parašo heroIllustration. Pakeitė
  // preload + 45s/90s/focus refresh timer'ius (widget niekada neatsinaujindavo).
  const [heroMapV, setHeroMapV] = useState(0)
  useEffect(() => subscribeCatalog(() => setHeroMapV(v => v + 1)), [])
  const dashboardRef = useRef(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showSearch, setShowSearch]   = useState(false)
  const [searchInitialQuery, setSearchInitialQuery] = useState('')
  const [searchAutoCamera, setSearchAutoCamera] = useState(false)
  // Step 6i — DiscoveryToast trigger'is. Set'inamas saving callback'e (kai
  // augalas pridedamas) ir auto-clear'inasi po 3.5s. Skip'inamas fast-path
  // case'e (catalog hit'as su laistymasIntervalas — joko AI cost'as, joko
  // discovery).
  const [discoveryToast, setDiscoveryToast] = useState(null)
  const showDiscoveryToast = useCallback((message) => {
    setDiscoveryToast({ message, ts: Date.now() })
    setTimeout(() => setDiscoveryToast(null), 3500)
  }, [])
  const [deathTarget, setDeathTarget]       = useState(null)
  const [deleteTarget, setDeleteTarget]     = useState(null)
  const [buyConfirmTarget, setBuyConfirmTarget] = useState(null)
  const [detailPlant, setDetailPlant]   = useState(null)

  // usePlants visada kviečiamas (hooks taisyklės), bet veikia tik kai collectionId žinomas
  const {
    syncFromRemote,
    dashboard, library, archive,
    addToDashboard, addToWishlist,
    markAsDied, moveToDashboard,
    updateComment, updateImage, updateStatus, updatePlant, deletePlant,
    addTimelineEvent, deleteTimelineEvent, updateChat,
    zinynas, addToZinynas, deleteFromZinynas, toggleZinynasStarred, updateZinynasTitle,
    updateUzrasai,
    zones, addZone, updateZone, deleteZone, reorderZones, movePlantToZone,
  } = usePlants(collectionId, viewerToken)

  // Reference modelis (kortelės) — perdengiam plant'ų sąrašus LIVE catalog
  // reikšmėmis prieš paduodant į Dashboard/Biblioteka. heroMapV deps → recompute
  // kai catalog (pa)keičiasi (subscribeCatalog onChange) → kortelės atsinaujina.
  // resolvePlantView išlaiko asmeninius laukus + image; legacy/offline → inline.
  const dashboardView = useMemo(() => dashboard.map(resolvePlantView), [dashboard, heroMapV])
  const libraryView   = useMemo(() => library.map(resolvePlantView),   [library, heroMapV])
  const archiveView   = useMemo(() => archive.map(resolvePlantView),   [archive, heroMapV])

  // F1 reference modelis — perdengiam rūšinius laukus LIVE catalog reikšmėmis
  // (gyvi augalai). heroMapV bump'as (subscribeCatalog onChange) → App re-render →
  // resolvePlantView pasiima naujausią catalog → PlantDetail rodo atnaujintą info
  // be refresh'o. Legacy/offline → inline fallback (resolvePlantView viduje).
  const livePlant = detailPlant
    ? resolvePlantView(library.find(p => p.id === detailPlant.plant.id) ?? detailPlant.plant)
    : null

  // Keep last plant in memory so PlantDetail stays mounted (eliminates remount lag)
  const lastDetailRef = useRef(null)
  if (livePlant) lastDetailRef.current = { plant: livePlant, section: detailPlant.section, scrollToCare: detailPlant.scrollToCare }
  const detailForRender = lastDetailRef.current

  const setTabAndMount = (key) => {
    // Tab switch'inant — uždarom bet kokį atidarytą modal'ą (pereinam į kitą view).
    if (isDesktop) {
      setDetailPlant(null)
      setShowSearch(false)
      setShowProfile(false)
      dashboardRef.current?.closeCareInfo?.()
    }
    setMountedTabs(prev => new Set([...prev, key]))
    setTab(key)
    // Persist'inam einamąjį tab'ą — naudosime jeigu chunk lazy load fail'ins
    // ir lazyWithRetry triger'ins window.location.reload()
    try { sessionStorage.setItem('current-tab', key) } catch {}
  }

  const openDetail = (plant, section, scrollToCare = false) => {
    if (plant.image) new Image().src = plant.image
    // Toggle pattern desktop'e: paspaudus tą patį augalą antrą kartą — uždarom
    // (pirmas atidaro, antras uždaro). Kitas augalas — Replace.
    if (isDesktop && detailPlant?.plant?.id === plant.id) {
      setDetailPlant(null)
      return
    }
    // Replace pattern — uždarom esamus desktop modal'us, kad panel'ėje
    // PlantDetail būtų vienintelis aktyvus view'as.
    if (isDesktop) {
      setShowSearch(false)
      setShowProfile(false)
      dashboardRef.current?.closeCareInfo?.()
    }
    setDetailPlant({ plant, section, scrollToCare })
  }
  const closeDetail     = () => setDetailPlant(null)

  // Passport redirect: kai augalai užkrauti, atidaryti plantId iš sessionStorage
  useEffect(() => {
    const id = sessionStorage.getItem('open-plant')
    if (!id) return
    const allPlants = [...dashboard, ...library]
    if (allPlants.length === 0) return
    const plant = allPlants.find(p => p.id === id)
    if (plant) {
      sessionStorage.removeItem('open-plant')
      openDetail(plant, plant.kategorija === 'auginama' ? 'auginama' : plant.kategorija === 'nori' ? 'nori' : 'istorija')
    }
  }, [dashboard.length + library.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // One-time background migration: upload any base64 images still in Firestore to Storage
  const migratedRef = useRef(false)
  useEffect(() => {
    if (migratedRef.current || library.length === 0) return
    migratedRef.current = true
    ;(async () => {
      for (const plant of library) {
        let patch = {}

        if (plant.image?.startsWith('data:')) {
          const url = await uploadImage(plant.image, plant.id)
          if (url) patch.image = url
        }

        const migratedTimeline = plant.timeline ? await Promise.all(
          plant.timeline.map(async e => {
            if (e.imageUrl?.startsWith('data:')) {
              const url = await uploadImage(e.imageUrl, plant.id)
              return url ? { ...e, imageUrl: url } : e
            }
            return e
          })
        ) : undefined

        if (migratedTimeline && migratedTimeline.some((e, i) => e !== plant.timeline[i])) {
          patch.timeline = migratedTimeline
        }

        if (Object.keys(patch).length > 0) {
          updatePlant(plant.id, patch)
          console.log('[migration] uploaded base64 images for:', plant.lietuviškas)
        }
      }
    })()
  }, [library.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // Upload timeline photo to Storage before saving (avoids Firestore 1MB doc limit).
  // 2026-06-01 — dual upload (full + thumb) per uploadImageWithThumb. Thumb URL
  // saugomas event.imageUrlThumb; usePlants.addTimelineEvent kopijuoja į
  // plant.imageThumb kai photo event tampa hero (useHistoryPhoto sync).
  const addTimelineEventWithUpload = async (plantId, event) => {
    if (event.imageUrl?.startsWith('data:')) {
      const { url, thumbUrl } = await uploadImageWithThumb(event.imageUrl, plantId)
      addTimelineEvent(plantId, {
        ...event,
        imageUrl: url ?? event.imageUrl,
        ...(thumbUrl ? { imageUrlThumb: thumbUrl } : {}),
      })
    } else {
      addTimelineEvent(plantId, event)
    }
  }

  const handleDashboardAction = (action, plant) => {
    if (action === 'died')   setDeathTarget(plant)
    if (action === 'delete') setDeleteTarget({ plant, section: 'auginama' })
  }

  const handleLibraryAction = (action, plant) => {
    if (action === 'buy') {
      const existing = dashboard.find(p => p.lotyniskas === plant.lotyniskas && p.id !== plant.id)
      if (existing) {
        closeDetail()
        setBuyConfirmTarget({ plant, existing })
      } else {
        moveToDashboard(plant.id)
        closeDetail()
        setTab('dashboard')
      }
      return
    }
    if (action === 'tryAgain'){ moveToDashboard(plant.id); setTab('dashboard') }
    if (action === 'wantAgain'){ updatePlant(plant.id, { kategorija: 'nori' }); setTab('biblioteka') }
    if (action === 'delete')  setDeleteTarget({ plant, section: 'library' })
  }

  const handleDeleteDied = () => {
    setDeathTarget(deleteTarget.plant)
    setDeleteTarget(null)
  }

  const handleDeleteMoveToLibrary = () => {
    updatePlant(deleteTarget.plant.id, { kategorija: 'nori' })
    setDeleteTarget(null)
    closeDetail()
  }

  const handleDeleteForever = () => {
    deletePlant(deleteTarget.plant.id)
    setDeleteTarget(null)
    closeDetail()
  }

  const handleDeathConfirm = (reason, lesson) => {
    if (!deathTarget) return
    markAsDied(deathTarget.id, reason, lesson)
    setDeathTarget(null)
    setTab('biblioteka')
  }

  const [fetchingAll, setFetchingAll] = useState(false)
  const fetchAllImages = useCallback(async () => {
    const allPlants = [...dashboard, ...library]
    const missing = allPlants.filter(p => !p.image)
    if (!missing.length) return
    setFetchingAll(true)
    for (const plant of missing) {
      const url = await fetchBestPhoto(plant.lotyniskas)
      if (url) updateImage(plant.id, url)
    }
    setFetchingAll(false)
  }, [dashboard, library, updateImage])

  const detailAction =
    detailPlant?.section === 'auginama' ? handleDashboardAction :
    detailPlant?.section === 'nori'     ? handleLibraryAction   :
    detailPlant?.section === 'istorija' ? handleLibraryAction   : null

  // ── DesktopHeader hooks (turi būt PRIEŠ auth gate, kad hook order'is
  //    nesikaitė kai auth gate trigger'inasi vs. užkrauta) ─────────
  // 2026-06-01 — INCLUDE quarantine plants. Anksčiau filtravom quarantine'ą
  // iš care notification counts, bet karantine augalai vis tiek prašo
  // laistymo/tręšimo (žiūr. analogišką fix'ą Dashboard.jsx:155). Dėl filter'io
  // header'io droplet badge rodydavo „0", net jei greeting text'as ir
  // Karantinas card teigia, kad augalas ištroškęs. Inconsistency tarp dviejų
  // counter'ių, kuriuos mato user'is.
  const carePopupPlants = dashboard
  const careLists = useCareLists(carePopupPlants)
  const careNotificationCount = careLists.total
  const careWaterCount = careLists.wateringList.length
  const careFertCount  = careLists.fertList.length

  // Replace pattern desktop'e: bet kuris top-level modal'as uždaro kitus,
  // kad panel'ėje vienu metu būtų tik VIENAS view'as.
  const closeAllDesktopModals = useCallback(() => {
    setDetailPlant(null)
    setShowSearch(false)
    setShowProfile(false)
    dashboardRef.current?.closeCareInfo?.()
  }, [])

  const handleCarePopupTap = useCallback((plant, list) => {
    closeAllDesktopModals()
    dashboardRef.current?.openCareInfo(plant, list)
    if (tab !== 'dashboard') {
      setMountedTabs(prev => new Set([...prev, 'dashboard']))
      setTab('dashboard')
    }
  }, [tab, closeAllDesktopModals])

  // ── Auth gate ─────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-app flex flex-col items-center justify-center gap-4">
        <BrandLoader />
        {loadingMessage && (
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-500">{loadingMessage}</p>
        )}
      </div>
    )
  }
  if (!user && !viewerToken) {
    return <LoginScreen onSignInGoogle={signInGoogle} onSignInFacebook={signInFacebook} error={authError} />
  }

  // Pending admin approval — naujas user'is dar nepatvirtintas.
  // useAuth.js onSnapshot real-time'u stebi approved flip'ą.
  if (pendingApproval) {
    return <PendingApprovalScreen user={user} />
  }

  // Admin panel — atskira modal'inė route'a per ?admin=1, gate'inta
  // isAdmin flag'u. Rodome ANT app'o (preserve'ina kolekciją iš auth
  // state'o), bet pati app'a nesirenderiina. Užsidaroma — back to app.
  if (showAdmin && isAdmin) {
    return (
      <Suspense fallback={<BrandLoader />}>
        <AdminPanel
          currentUid={user?.uid}
          onClose={() => {
            setShowAdmin(false)
            try {
              const url = new URL(window.location.href)
              url.searchParams.delete('admin')
              window.history.replaceState({}, '', url.toString())
            } catch {}
          }}
        />
      </Suspense>
    )
  }
  // Vartotojas prisijungęs, bet kolekcija nesukurta (Firestore rules klaida arba tinklas)
  if (!collectionId) {
    return (
      <div className="fixed inset-0 bg-app flex flex-col items-center justify-center gap-4 px-8">
        <div className="opacity-50">
          <T4Icon size={64} ink="#1c3a2a" paper="transparent" />
        </div>
        <p className="text-sm text-forest-500 text-center">Nepavyko įkelti kolekcijos.<br />Patikrink interneto ryšį ir bandyk iš naujo.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-forest-700 hover:bg-forest-800 text-bone-50 rounded-btn text-sm font-display font-semibold transition-colors"
        >
          Bandyti iš naujo
        </button>
        <button onClick={signOut} className="text-xs text-forest-400 hover:text-forest-600 underline transition-colors">Atsijungti</button>
      </div>
    )
  }

  const tabs = [
    { key: 'dashboard', page: (
      <Dashboard
        ref={dashboardRef}
        hideInnerHeader={isDesktop}
        plants={dashboardView}
        allPlants={libraryView}
        zones={zones}
        heroReady={heroMapV}
        onCareModeChange={setDashCareMode}
        onCareConfidenceChange={setDashCareConfidence}
        onTap={p => openDetail(p, 'auginama')}
        onTapFromCare={p => openDetail(p, 'auginama', true)}
        onSearch={q => { setSearchAutoCamera(false); setSearchInitialQuery(q ?? ''); setShowSearch(true) }}
        onSearchByCamera={() => { setSearchAutoCamera(true); setSearchInitialQuery(''); setShowSearch(true) }}
        onFetchAllImages={fetchAllImages}
        fetchingAll={fetchingAll}
        onSaveToZinynas={addToZinynas}
        onViewPlant={p => openDetail(p, p.kategorija === 'auginama' ? 'auginama' : p.kategorija === 'nori' ? 'nori' : 'istorija')}
        onRefresh={syncFromRemote}
        onAddTimelineEvent={addTimelineEventWithUpload}
        onAddZone={addZone}
        onUpdateZone={updateZone}
        onDeleteZone={deleteZone}
        onReorderZones={reorderZones}
        user={user}
        collectionId={collectionId}
        role={role}
        ownCollectionId={ownCollectionId}
        allCollections={allCollections}
        onSwitchCollection={switchCollection}
        onRenameCollection={renameCollection}
        onSignOut={signOut}
      />
    )},
    { key: 'biblioteka', page: (
      <Suspense fallback={null}>
        <Biblioteka
          plants={archiveView}
          onTap={p => openDetail(p, p.kategorija)}
          onSearch={q => { setSearchAutoCamera(false); setSearchInitialQuery(q ?? ''); setShowSearch(true) }}
          onSearchByCamera={() => { setSearchAutoCamera(true); setSearchInitialQuery(''); setShowSearch(true) }}
          onSaveToZinynas={addToZinynas}
          onViewPlant={p => openDetail(p, p.kategorija)}
          onRefresh={syncFromRemote}
        />
      </Suspense>
    )},
    { key: 'zinynas', page: (
      <Suspense fallback={null}>
        <Zinynas
          entries={zinynas}
          onAdd={addToZinynas}
          onDelete={deleteFromZinynas}
          onToggleStar={toggleZinynasStarred}
          onUpdateTitle={updateZinynasTitle}
          plants={dashboard}
        />
      </Suspense>
    )},
  ]

  const tabsArea = (
    <div className="flex-1 overflow-hidden relative">
      {tabs.map(({ key, page }) => mountedTabs.has(key) && (
        <div
          key={key}
          className="absolute inset-0"
          style={{ display: tab === key ? 'flex' : 'none', flexDirection: 'column' }}
        >
          {page}
        </div>
      ))}
    </div>
  )

  // Aktyvios kolekcijos vardas DesktopHeader'iui (pip + display name)
  const activeCollection = allCollections.find(c => c.id === collectionId)
  const collectionName = activeCollection?.name || 'Mano kolekcija'

  const desktopHeader = isDesktop ? (
    <DesktopHeader
      active={tab}
      onTabChange={setTabAndMount}
      counts={{ dashboard: dashboard.length, biblioteka: archive.length, zinynas: zinynas.length }}
      user={user}
      onProfileClick={() => {
        if (showProfile) { setShowProfile(false); return }
        closeAllDesktopModals()
        setShowProfile(true)
      }}
      role={role}
      isAdmin={isAdmin}
      careNotificationCount={careNotificationCount}
      careWaterCount={careWaterCount}
      careFertCount={careFertCount}
      carePopupPlants={carePopupPlants}
      onCareTap={handleCarePopupTap}
      onSearchClick={() => {
        if (showSearch) { setShowSearch(false); return }
        closeAllDesktopModals()
        setSearchAutoCamera(false)
        setSearchInitialQuery('')
        setShowSearch(true)
      }}
    />
  ) : null

  return (
    <DetailHostProvider>
      {isDesktop ? (
        <DesktopLayout
          header={desktopHeader}
          plantsForChart={library}
        >{tabsArea}</DesktopLayout>
      ) : (
        <div className="flex flex-col h-dvh overflow-hidden">
          {role !== 'viewer' && !dashCareMode && (
            <MobileHeader
              user={user}
              role={role}
              isAdmin={isAdmin}
              onProfileClick={() => setShowProfile(v => !v)}
              careNotificationCount={careNotificationCount}
              careWaterCount={careWaterCount}
              careFertCount={careFertCount}
              carePopupPlants={carePopupPlants}
              onCareTap={(plant, list) => {
                if (tab !== 'dashboard') {
                  setMountedTabs(prev => new Set([...prev, 'dashboard']))
                  setTab('dashboard')
                }
                // Defer to next tick so Dashboard mount finishes before openCareInfo
                setTimeout(() => dashboardRef.current?.openCareInfo?.(plant, list), 0)
              }}
              onSearchClick={() => {
                setSearchAutoCamera(false)
                setSearchInitialQuery('')
                setShowSearch(true)
              }}
            />
          )}
          {tabsArea}
        </div>
      )}

      {/* Bottom navigation — tik mobile (desktop'e tabs gyvena DesktopHeader'yje) */}
      {!isDesktop && role !== 'viewer' && !dashCareMode && <Navigation active={tab} onChange={setTabAndMount} counts={{ dashboard: dashboard.length, biblioteka: archive.length, zinynas: zinynas.length }} role={role} isDesktop={isDesktop} />}

      {/* ProfileSheet — kviečiamas iš MobileHeader (mobile) ar DesktopHeader (desktop) avataro.
          Renderinamas App lygmenyje, kad vienodai veiktų abiems variantams. */}
      {showProfile && (
        <Suspense fallback={null}>
          <ProfileSheet
            user={user}
            collectionId={collectionId}
            role={role}
            ownCollectionId={ownCollectionId}
            allCollections={allCollections}
            isAdmin={isAdmin}
            onSignOut={signOut}
            onSwitchCollection={(id) => { switchCollection(id); setShowProfile(false) }}
            onRenameCollection={renameCollection}
            onOpenAdmin={() => setShowAdmin(true)}
            onClose={() => setShowProfile(false)}
          />
        </Suspense>
      )}

      {detailForRender && (
        <Suspense fallback={null}>
          <PlantDetail
            key="detail"
            plant={detailForRender.plant}
            section={detailForRender.section}
            onClose={closeDetail}
            onAction={detailAction}
            onCommentSave={(id, comment) => updateComment(id, comment)}
            onUzrasaiSave={(id, uzrasai) => updateUzrasai(id, uzrasai)}
            onStatusChange={(id, status, meta) => updateStatus(id, status, meta)}
            onUpdateNames={(id, patch) => updatePlant(id, patch)}
            onImageSave={async (id, url, fromHistory = false) => {
              // 2026-06-01 — dual upload: full + thumb (Dashboard kortelėms).
              // uploadImageWithThumb passthrough'ina Storage/external URL'us (no
              // thumb gen). Data URL atveju — generate'ina thumb + upload'ina abu.
              const { url: uploadedUrl, thumbUrl } = await uploadImageWithThumb(url, id)
              updateImage(id, uploadedUrl ?? url, fromHistory, thumbUrl)
            }}
            onSaveChat={(id, msgs) => updateChat(id, msgs.map(({ imageUrl, ...m }) => m))}
            onSaveToZinynas={addToZinynas}
            onAddTimelineEvent={addTimelineEventWithUpload}
            onDeleteTimelineEvent={deleteTimelineEvent}
            zones={zones}
            plants={dashboard}
            onZoneChange={movePlantToZone}
            onAddZone={addZone}
            onUpdateZone={updateZone}
            onDeleteZone={deleteZone}
            onReorderZones={reorderZones}
            scrollToCare={detailForRender.scrollToCare ?? false}
            visible={!!(detailPlant && livePlant)}
            role={role}
            isAdmin={isAdmin}
            collectionId={collectionId}
          />
        </Suspense>
      )}

      <AnimatePresence>
        {showSearch && (
          <Suspense fallback={null}>
            <SearchModal
              key="search"
              plants={library}
              initialQuery={searchInitialQuery}
              autoCamera={searchAutoCamera}
              onAddToWishlist={plant => {
                // 2026-06-01: NEBE-uždarom modal'ą ČIA. SearchModal'as pats
                // sprendžia kada uždaryti (handlePostSaveSwitch → EnrichmentProgress
                // → „Tęsti fone" → realus onClose). App'as tik atnaujina state'ą.
                const newPlant = addToWishlist(plant)
                console.log('[App] onAddToWishlist (modal control delegated to SearchModal)', { newId: newPlant?.id, archiveCountAtCall: archive.length })
                if (!plant.laistymasIntervalas) {
                  // Step 6m — post-save = REWARD CONFIRMATION („gavai"), ne
                  // discovery invitation. Discovery hint atskirai rodomas
                  // Phase1SlimPreview'e prieš save (žiūr. Phase1SlimPreview).
                  showDiscoveryToast('+1 AI užklausa gauta. Ačiū už indėlį!')
                }
              }}
              onAddToDashboard={plant => {
                // 2026-06-01: NEBE-uždarom modal'ą / NEswitch'inam tab'ą ČIA —
                // SearchModal'as kontroliuoja per EnrichmentProgress flow'ą.
                addToDashboard(plant)
                if (!plant.laistymasIntervalas) {
                  showDiscoveryToast('+1 AI užklausa gauta. Ačiū už indėlį!')
                }
              }}
              onClose={() => {
                // True close — iškviečiamas iš SearchModal'o (X mygtukas, ESC,
                // ProgressView'o „Tęsti fone" / „Grįžti į biblioteką"). Vienas
                // unified close path — pereinam į biblioteką ar dashboard pagal
                // paskutinį pridėtą plant'o tipą... aktualumas: dažniausiai
                // biblioteka (newly saved iki Phase 2 nuėjimo lieka „nori").
                setShowSearch(false)
                setSearchInitialQuery('')
                setSearchAutoCamera(false)
                setTab('biblioteka')
              }}
              onViewPlant={plant => {
                setShowSearch(false)
                setSearchInitialQuery('')
                openDetail(plant, plant.kategorija === 'istorija' ? 'istorija' : plant.kategorija === 'nori' ? 'nori' : 'auginama')
              }}
              onPromote={id => { moveToDashboard(id); setShowSearch(false); setSearchInitialQuery(''); setTab('dashboard') }}
              onUpdatePlant={(id, patch) => { updatePlant(id, patch); setShowSearch(false); setSearchInitialQuery('') }}
            />
          </Suspense>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deathTarget && (
          <DeathModal
            key="death"
            plant={deathTarget}
            onConfirm={handleDeathConfirm}
            onClose={() => setDeathTarget(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            key="delete"
            plant={deleteTarget.plant}
            section={deleteTarget.section}
            onDied={handleDeleteDied}
            onMoveToLibrary={handleDeleteMoveToLibrary}
            onDeleteForever={handleDeleteForever}
            onClose={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {buyConfirmTarget && (
          <DuplicateBuyModal
            key="buy-confirm"
            plant={buyConfirmTarget.plant}
            onAddAnother={() => {
              moveToDashboard(buyConfirmTarget.plant.id)
              setBuyConfirmTarget(null)
              setTab('dashboard')
            }}
            onViewExisting={() => {
              openDetail(buyConfirmTarget.existing, 'auginama')
              setBuyConfirmTarget(null)
            }}
            onClose={() => setBuyConfirmTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* Step 6i — DiscoveryToast po naujo augalo save'o.
          Pozicija: top-center, fixed virš header'io, pointer-events-none kad
          netrukdytų user'iui spausti UI. Auto-dismiss po 3.5s per setTimeout. */}
      <AnimatePresence>
        {discoveryToast && (
          <motion.div
            key="discovery-toast"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed top-0 left-0 right-0 z-[60] pointer-events-none"
            style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
          >
            <div className="max-w-[430px] mx-auto px-4">
              <DiscoveryToast message={discoveryToast.message} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </DetailHostProvider>
  )
}
