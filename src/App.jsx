import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Navigation from './components/Navigation'
import SearchModal from './components/SearchModal'
import DeathModal from './components/DeathModal'
import DeleteModal from './components/DeleteModal'
import PlantDetail from './components/PlantDetail'
import Dashboard from './pages/Dashboard'
import Biblioteka from './pages/Biblioteka'
import Zinynas from './pages/Zinynas'
import { usePlants } from './hooks/usePlants'
import PinGate from './components/PinGate'
import { fetchWikimediaImage } from './utils/plantImage'

export default function App() {
  const [tab, setTab]                 = useState('dashboard')
  const [showSearch, setShowSearch]   = useState(false)
  const [searchInitialQuery, setSearchInitialQuery] = useState('')
  const [deathTarget, setDeathTarget]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null) // { plant, section }
  const [detailPlant, setDetailPlant]   = useState(null) // { plant, section }

  const {
    syncFromRemote,
    dashboard, library,
    addToDashboard, addToWishlist,
    markAsDied, moveToDashboard,
    updateComment, updateImage, updateStatus, updatePlant, deletePlant,
    addTimelineEvent, deleteTimelineEvent, clearTimeline, updateChat, togglePirkinys,
    zinynas, addToZinynas, deleteFromZinynas, toggleZinynasStarred,
    updateUzrasai,
  } = usePlants()

  // Keep detail modal in sync with live plant data
  const livePlant = detailPlant
    ? [...dashboard, ...library].find(p => p.id === detailPlant.plant.id)
      ?? detailPlant.plant
    : null

  const openDetail  = (plant, section) => setDetailPlant({ plant, section })
  const closeDetail = () => setDetailPlant(null)

  const handleDashboardAction = (action, plant) => {
    if (action === 'died')   setDeathTarget(plant)
    if (action === 'delete') setDeleteTarget({ plant, section: 'auginama' })
  }

  const handleLibraryAction = (action, plant) => {
    if (action === 'buy')     { moveToDashboard(plant.id); setTab('dashboard') }
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

  // Fetch images for all plants that don't have one
  const [fetchingAll, setFetchingAll] = useState(false)
  const fetchAllImages = useCallback(async () => {
    const allPlants = [...dashboard, ...library]
    const missing = allPlants.filter(p => !p.image)
    if (!missing.length) return
    setFetchingAll(true)
    for (const plant of missing) {
      const url = await fetchWikimediaImage(plant.lotyniskas)
      if (url) updateImage(plant.id, url)
    }
    setFetchingAll(false)
  }, [dashboard, library, updateImage])

  const detailAction =
    detailPlant?.section === 'auginama' ? handleDashboardAction :
    detailPlant?.section === 'nori'     ? handleLibraryAction   :
    detailPlant?.section === 'istorija' ? handleLibraryAction   : null

  const tabs = [
    { key: 'dashboard', page: (
      <Dashboard
        plants={dashboard}
        onTap={p => openDetail(p, 'auginama')}
        onImageFetch={(id, url) => updateImage(id, url)}
        onSearch={() => setShowSearch(true)}
        onFetchAllImages={fetchAllImages}
        fetchingAll={fetchingAll}
        onSaveToZinynas={addToZinynas}
        onViewPlant={p => openDetail(p, p.kategorija === 'auginama' ? 'auginama' : p.kategorija === 'nori' ? 'nori' : 'istorija')}
        onRefresh={syncFromRemote}
      />
    )},
    { key: 'biblioteka', page: (
      <Biblioteka
        plants={library}
        onTap={p => openDetail(p, p.kategorija)}
        onImageFetch={(id, url) => updateImage(id, url)}
        onSearch={q => { setSearchInitialQuery(q ?? ''); setShowSearch(true) }}
        onSaveToZinynas={addToZinynas}
        onViewPlant={p => openDetail(p, p.kategorija === 'auginama' ? 'auginama' : p.kategorija === 'nori' ? 'nori' : 'istorija')}
        onRefresh={syncFromRemote}
      />
    )},
    { key: 'zinynas', page: (
      <Zinynas
        entries={zinynas}
        onAdd={addToZinynas}
        onDelete={deleteFromZinynas}
        onToggleStar={toggleZinynasStarred}
        plants={dashboard}
      />
    )},
  ]

  return (
    <PinGate>
    <div className="flex flex-col h-dvh overflow-hidden">
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false}>
          {tabs.map(({ key, page }) => tab === key && (
            <motion.div
              key={key}
              className="absolute inset-0"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
            >
              {page}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Navigation active={tab} onChange={setTab} dashboardCount={dashboard.length} />

      <AnimatePresence>
        {detailPlant && livePlant && (
          <PlantDetail
            key="detail"
            plant={livePlant}
            section={detailPlant.section}
            onClose={closeDetail}
            onAction={detailAction}
            onCommentSave={(id, comment) => updateComment(id, comment)}
            onUzrasaiSave={(id, uzrasai) => updateUzrasai(id, uzrasai)}
            onStatusChange={(id, status, meta) => updateStatus(id, status, meta)}
            onUpdateNames={(id, patch) => updatePlant(id, patch)}
            onImageSave={(id, url) => updateImage(id, url)}
            onSaveChat={(id, msgs) => updateChat(id, msgs)}
            onSaveToZinynas={addToZinynas}
            onAddTimelineEvent={addTimelineEvent}
            onDeleteTimelineEvent={deleteTimelineEvent}
            onClearTimeline={id => clearTimeline(id)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSearch && (
          <SearchModal
            key="search"
            plants={library}
            initialQuery={searchInitialQuery}
            onAddToWishlist={plant => { addToWishlist(plant); setTab('biblioteka') }}
            onAddToDashboard={plant => { addToDashboard(plant); setTab('dashboard') }}
            onClose={() => { setShowSearch(false); setSearchInitialQuery('') }}
            onViewPlant={plant => {
              setShowSearch(false)
              setSearchInitialQuery('')
              openDetail(plant, plant.kategorija === 'istorija' ? 'istorija' : plant.kategorija === 'nori' ? 'nori' : 'auginama')
            }}
            onPromote={id => { moveToDashboard(id); setShowSearch(false); setSearchInitialQuery(''); setTab('dashboard') }}
          />
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
    </div>
    </PinGate>
  )
}
