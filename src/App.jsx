import { useState, useCallback, useEffect, useRef, lazy, Suspense, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Navigation from './components/Navigation'
import DeathModal from './components/DeathModal'
import DeleteModal from './components/DeleteModal'
import DuplicateBuyModal from './components/DuplicateBuyModal'
import Dashboard from './pages/Dashboard'
import { usePlants } from './hooks/usePlants'
import { useAuth } from './hooks/useAuth'
import LoginScreen from './components/LoginScreen'
import { fetchBestPhoto, uploadImage } from './utils/imageService'

// ChunkLoadError (senas SW aptarnauja seną HTML su naujais chunk hash'ais) → force reload
// Kiti tinklo errori → retry kartą
function lazyWithRetry(factory) {
  return lazy(() =>
    factory().catch(err => {
      const isChunkErr = err?.name === 'ChunkLoadError' || /Loading chunk|Failed to fetch dynamically/i.test(err?.message ?? '')
      if (isChunkErr) { window.location.reload(); return new Promise(() => {}) }
      return factory() // retry kartą
    })
  )
}

const SearchModal = lazyWithRetry(() => import('./components/SearchModal'))
const PlantDetail = lazyWithRetry(() => import('./components/PlantDetail'))
const Biblioteka  = lazyWithRetry(() => import('./pages/Biblioteka'))
const Zinynas     = lazyWithRetry(() => import('./pages/Zinynas'))

export default function App() {
  const {
    user, collectionId, role, ownCollectionId, allCollections,
    loading: authLoading, authError, loadingMessage,
    viewerToken,
    signIn, signOut, switchCollection, renameCollection,
  } = useAuth()

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

  const [tab, setTab]                 = useState('dashboard')
  const [mountedTabs, setMountedTabs] = useState(() => new Set(['dashboard']))
  const [showSearch, setShowSearch]   = useState(false)
  const [searchInitialQuery, setSearchInitialQuery] = useState('')
  const [searchAutoCamera, setSearchAutoCamera] = useState(false)
  const [deathTarget, setDeathTarget]       = useState(null)
  const [deleteTarget, setDeleteTarget]     = useState(null)
  const [buyConfirmTarget, setBuyConfirmTarget] = useState(null)
  const [detailPlant, setDetailPlant]   = useState(null)

  // usePlants visada kviečiamas (hooks taisyklės), bet veikia tik kai collectionId žinomas
  const {
    syncFromRemote,
    dashboard, library,
    addToDashboard, addToWishlist,
    markAsDied, moveToDashboard,
    updateComment, updateImage, updateStatus, updatePlant, deletePlant,
    addTimelineEvent, deleteTimelineEvent, updateChat, togglePirkinys,
    zinynas, addToZinynas, deleteFromZinynas, toggleZinynasStarred,
    updateUzrasai,
    zones, addZone, updateZone, deleteZone, reorderZones, movePlantToZone,
  } = usePlants(collectionId, viewerToken)

  const livePlant = detailPlant
    ? [...dashboard, ...library].find(p => p.id === detailPlant.plant.id)
      ?? detailPlant.plant
    : null

  // Keep last plant in memory so PlantDetail stays mounted (eliminates remount lag)
  const lastDetailRef = useRef(null)
  if (livePlant) lastDetailRef.current = { plant: livePlant, section: detailPlant.section, scrollToCare: detailPlant.scrollToCare }
  const detailForRender = lastDetailRef.current

  const setTabAndMount = (key) => {
    setMountedTabs(prev => new Set([...prev, key]))
    setTab(key)
  }

  const openDetail      = (plant, section, scrollToCare = false) => {
    if (plant.image) new Image().src = plant.image
    setDetailPlant({ plant, section, scrollToCare })
  }
  const closeDetail     = () => setDetailPlant(null)

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

  // Upload timeline photo to Storage before saving (avoids Firestore 1MB doc limit)
  const addTimelineEventWithUpload = async (plantId, event) => {
    if (event.imageUrl?.startsWith('data:')) {
      const uploaded = await uploadImage(event.imageUrl, plantId)
      addTimelineEvent(plantId, { ...event, imageUrl: uploaded ?? event.imageUrl })
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
    if (action === 'pirkinys'){ togglePirkinys(plant.id) }
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

  // ── Auth gate ─────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-app flex flex-col items-center justify-center gap-3">
        <img src="/plant_pot.png" className="w-16 h-16 object-contain animate-spin" alt="" />
        {loadingMessage && (
          <p className="text-sm text-gray-400">{loadingMessage}</p>
        )}
      </div>
    )
  }
  if (!user && !viewerToken) {
    return <LoginScreen onSignIn={signIn} error={authError} />
  }
  // Vartotojas prisijungęs, bet kolekcija nesukurta (Firestore rules klaida arba tinklas)
  if (!collectionId) {
    return (
      <div className="fixed inset-0 bg-app flex flex-col items-center justify-center gap-4 px-8">
        <img src="/plant_pot.png" className="w-16 h-16 object-contain opacity-40" alt="" />
        <p className="text-sm text-gray-500 text-center">Nepavyko įkelti kolekcijos.<br />Patikrink interneto ryšį ir bandyk iš naujo.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-brand text-white rounded-xl text-sm font-medium"
        >
          Bandyti iš naujo
        </button>
        <button onClick={signOut} className="text-xs text-gray-400 underline">Atsijungti</button>
      </div>
    )
  }

  const tabs = [
    { key: 'dashboard', page: (
      <Dashboard
        plants={dashboard}
        allPlants={library}
        zones={zones}
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
          plants={library}
          onTap={p => openDetail(p, p.kategorija === 'auginama' ? 'nori' : p.kategorija)}
          onSearch={q => { setSearchAutoCamera(false); setSearchInitialQuery(q ?? ''); setShowSearch(true) }}
          onSearchByCamera={() => { setSearchAutoCamera(true); setSearchInitialQuery(''); setShowSearch(true) }}
          onSaveToZinynas={addToZinynas}
          onViewPlant={p => openDetail(p, p.kategorija === 'auginama' ? 'nori' : p.kategorija)}
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
          plants={dashboard}
        />
      </Suspense>
    )},
  ]

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
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

      {role !== 'viewer' && <Navigation active={tab} onChange={setTabAndMount} dashboardCount={dashboard.length} role={role} />}

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
            onImageSave={async (id, url, fromHistory = false) => updateImage(id, await uploadImage(url, id), fromHistory)}
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
              onAddToWishlist={plant => { addToWishlist(plant); setTab('biblioteka') }}
              onAddToDashboard={plant => { addToDashboard(plant); setTab('dashboard') }}
              onClose={() => { setShowSearch(false); setSearchInitialQuery(''); setSearchAutoCamera(false) }}
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


    </div>
  )
}
