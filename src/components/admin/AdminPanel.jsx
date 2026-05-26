import { useState, useEffect, useCallback } from 'react'
import { getDocs, getDoc, collection, doc, setDoc, updateDoc, deleteDoc, arrayRemove, deleteField, query, orderBy } from 'firebase/firestore'
import { Users, Database, X, Shield, Sparkles, BadgeCheck, Loader2, RefreshCw, ChevronRight, Mail, Trash2, AlertTriangle, UserCheck, Pencil, Check, BookOpen } from 'lucide-react'
import { db } from '../../utils/firebase'
import { bustCatalogCache } from '../../utils/catalog'
import { bustSearchResponseCache } from '../../utils/searchResponseCache'
import T4Icon from '../brand/T4Icon'
import LibraryEditorV2 from './LibraryEditorV2'
// v1 (LibraryTab.jsx) lieka repo'je kaip backup — revert su `git revert HEAD`
// jei v2 sukels problemų. Naudoti per: `import LibraryTab from './LibraryTab'`

/**
 * AdminPanel — primityvi admin dashboard kolekcijoms ir vartotojams.
 *
 * Stage 1: read-only (users + collections lists)
 * Stage 2: per-user actions (toggle isAdmin / beta / subscription.plan)
 *
 * Gate'inta caller'io (App.jsx) per `auth.isAdmin === true`.
 * Firestore rules turi leisti admin'ui skaityti /users + /collections globally.
 *
 * Architektūra: pure client-side queries (Option A) — tinka <100 user'ių
 * etapui. Scale'inant >100 — migracija į server-side /api/admin endpoint'ą.
 */

const WIDGET = 'bg-bone-50 rounded-2xl border border-bone-400/40 shadow-[0_1px_3px_rgba(28,58,42,0.06),0_4px_14px_rgba(28,58,42,0.05)]'

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('lt-LT', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return '—' }
}

function shortId(id) {
  if (!id) return '—'
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}

export default function AdminPanel({ currentUid, onClose }) {
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [collections, setCollections] = useState([])
  const [invites, setInvites] = useState([])
  const [catalog, setCatalog] = useState([])
  const [taxonGroups, setTaxonGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detail, setDetail] = useState(null) // { type: 'user'|'collection', data }

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // Parallel loads — catalog ir taxonGroups dabar admin'ui prieinami
      // tiesiogiai (rules leidžia visiems auth'intiems read'ą).
      const [usersSnap, colsSnap, invitesSnap, catalogSnap, taxonGroupsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'collections')),
        getDocs(collection(db, 'invites')),
        getDocs(collection(db, 'catalog')),
        getDocs(collection(db, 'taxonGroups')),
      ])
      const usersList = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }))

      // Collections + plant counts (parallel)
      const colsList = await Promise.all(colsSnap.docs.map(async d => {
        const data = d.data()
        let plantCount = 0
        try {
          const plantsSnap = await getDocs(collection(db, 'collections', d.id, 'plants'))
          plantCount = plantsSnap.size
        } catch {}
        return {
          id: d.id,
          ...data,
          plantCount,
          memberCount: (data.members ?? []).length,
          zonesCount: (data.zones ?? []).length,
          zinynasCount: (data.zinynas ?? []).length,
        }
      }))

      const invitesList = invitesSnap.docs.map(d => ({ token: d.id, ...d.data() }))
      const catalogList = catalogSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const taxonGroupsList = taxonGroupsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      setUsers(usersList.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')))
      setCollections(colsList.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')))
      setInvites(invitesList.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')))
      setCatalog(catalogList.sort((a, b) => (a.lotyniskas ?? '').localeCompare(b.lotyniskas ?? '')))
      setTaxonGroups(taxonGroupsList.sort((a, b) => (a.genus ?? a.name ?? '').localeCompare(b.genus ?? b.name ?? '')))
    } catch (e) {
      console.error('[admin] load failed:', e)
      setError(e?.message ?? 'Nepavyko įkelti duomenų. Patikrink Firestore Rules.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Mutations ────────────────────────────────────────────────────
  const toggleAdmin = async (uid, current) => {
    if (uid === currentUid && current) {
      if (!window.confirm('Pašalinti admin teises sau? Po to nebematysi /admin.')) return
    }
    try {
      await updateDoc(doc(db, 'users', uid), { isAdmin: !current })
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, isAdmin: !current } : u))
    } catch (e) { alert('Nepavyko: ' + e.message) }
  }

  const toggleBeta = async (uid, current) => {
    try {
      await updateDoc(doc(db, 'users', uid), { beta: !current })
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, beta: !current } : u))
    } catch (e) { alert('Nepavyko: ' + e.message) }
  }

  const setPlan = async (uid, plan) => {
    try {
      await updateDoc(doc(db, 'users', uid), { 'subscription.plan': plan })
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, subscription: { ...(u.subscription ?? {}), plan } } : u))
    } catch (e) { alert('Nepavyko: ' + e.message) }
  }

  const approveUser = async (uid) => {
    try {
      await updateDoc(doc(db, 'users', uid), { approved: true, approvedAt: new Date().toISOString() })
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, approved: true } : u))
    } catch (e) { alert('Nepavyko patvirtinti: ' + e.message) }
  }

  /**
   * Soft delete: ištrina users/{uid} + jo owned kolekcijas (+plants subcol)
   * + pašalina iš kitų kolekcijų members[] + roles + memberProfiles.
   * Firebase Auth account'as LIEKA — user'is gali vėl signin'tis, bet
   * patenka į pending (per createPendingUser). Pilnam blokavimui reikia
   * Admin SDK serveryje (Phase B).
   */
  const deleteUser = async (uid, label) => {
    if (uid === currentUid) {
      alert('Negalima ištrinti pačiam savęs.')
      return
    }
    if (!window.confirm(
      `Ištrinti vartotoją „${label}"?\n\n` +
      `Bus ištrintos:\n` +
      `• jo paskyra (users/${shortId(uid)})\n` +
      `• jo collection'os ir VISI augalai\n` +
      `• jo narystė kitose kolekcijose\n\n` +
      `Firebase Auth account'as liks — jis galės prisijungti iš naujo (pateks į pending).`
    )) return

    try {
      // 1. Find owned collections — delete them + plant subcol
      const owned = collections.filter(c => c.ownerId === uid)
      for (const c of owned) {
        const plantsSnap = await getDocs(collection(db, 'collections', c.id, 'plants'))
        await Promise.all(plantsSnap.docs.map(p => deleteDoc(p.ref)))
        await deleteDoc(doc(db, 'collections', c.id))
      }

      // 2. Find shared collections — remove user from members/roles/memberProfiles
      const sharedWithUser = collections.filter(c => (c.members ?? []).includes(uid) && c.ownerId !== uid)
      for (const c of sharedWithUser) {
        await updateDoc(doc(db, 'collections', c.id), {
          members:             arrayRemove(uid),
          [`roles.${uid}`]:    deleteField(),
          [`memberProfiles.${uid}`]: deleteField(),
        })
      }

      // 3. Delete user doc
      await deleteDoc(doc(db, 'users', uid))

      // 4. Local state refresh
      setUsers(prev => prev.filter(u => u.uid !== uid))
      setCollections(prev => prev
        .filter(c => c.ownerId !== uid)
        .map(c => (c.members ?? []).includes(uid)
          ? { ...c, members: c.members.filter(m => m !== uid) }
          : c
        )
      )
      setDetail(null)
    } catch (e) {
      console.error('[admin] delete user failed:', e)
      alert('Nepavyko ištrinti: ' + e.message)
    }
  }

  /**
   * Rename'inam kolekciją. Tik `name` field'as keičiasi — visi member'ai,
   * augalai, invites lieka. UI'us perkrauna iš naujo collection listę
   * (locally update'ina state'ą be reload'o).
   */
  const renameCollection = async (cid, newName) => {
    const trimmed = (newName ?? '').trim()
    if (!trimmed) return
    try {
      await updateDoc(doc(db, 'collections', cid), { name: trimmed })
      setCollections(prev => prev.map(c => c.id === cid ? { ...c, name: trimmed } : c))
      setDetail(d => (d && d.type === 'collection' && d.data.id === cid)
        ? { ...d, data: { ...d.data, name: trimmed } }
        : d
      )
    } catch (e) {
      console.error('[admin] rename collection failed:', e)
      alert('Nepavyko pervadinti: ' + e.message)
    }
  }

  /**
   * Ištrina kolekciją + cascade:
   *   1. visi plants subcollection'oje
   *   2. visi invites su collectionId == cid (kad nelikčtų „dead" token'ų)
   *   3. users'iu primaryCollection / ownCollection refs su tuo cid → null
   *      (kad UI'us nesivedžiotų į negyvą kolekciją)
   *   4. pati kolekcijos doc
   *
   * NE'rūšiuoja per Firebase Auth — visi member'iai lieka su savo paskyromis,
   * tik praranda prieigą prie šitos kolekcijos. Pagal poreikį owner'is gali
   * sukurti naują.
   */
  const deleteCollection = async (cid, name, plantCount, memberCount) => {
    if (!window.confirm(
      `Ištrinti kolekciją „${name || cid}"?\n\n` +
      `Bus ištrinti:\n` +
      `• ${plantCount} augalai (subkolekcijoje)\n` +
      `• ${memberCount} narių prieiga\n` +
      `• su ja susiję invite token'ai\n` +
      `• pati kolekcijos doc'as\n\n` +
      `Šito veiksmo NEGALIMA atšaukti.`
    )) return

    // Antras patvirtinimas didelėms kolekcijoms — apsauga nuo accidental click'o
    if (plantCount > 10 && !window.confirm(`Tikrai? Bus prarasti ${plantCount} augalai.`)) return

    try {
      // 1. Plants subcol cascade
      const plantsSnap = await getDocs(collection(db, 'collections', cid, 'plants'))
      await Promise.all(plantsSnap.docs.map(p => deleteDoc(p.ref)))

      // 2. Invites su collectionId == cid
      const relatedInvites = invites.filter(i => i.collectionId === cid)
      await Promise.all(relatedInvites.map(i => deleteDoc(doc(db, 'invites', i.token))))

      // 3. Users'iu primaryCollection / ownCollection cleanup
      const affectedUsers = users.filter(u => u.primaryCollection === cid || u.ownCollection === cid)
      await Promise.all(affectedUsers.map(u => {
        const patch = {}
        if (u.primaryCollection === cid) patch.primaryCollection = deleteField()
        if (u.ownCollection === cid)     patch.ownCollection     = deleteField()
        return updateDoc(doc(db, 'users', u.uid), patch)
      }))

      // 4. Pati kolekcija
      await deleteDoc(doc(db, 'collections', cid))

      // Local state refresh
      setCollections(prev => prev.filter(c => c.id !== cid))
      const removedTokens = new Set(relatedInvites.map(i => i.token))
      setInvites(prev => prev.filter(i => !removedTokens.has(i.token)))
      setUsers(prev => prev.map(u => {
        if (u.primaryCollection !== cid && u.ownCollection !== cid) return u
        const next = { ...u }
        if (next.primaryCollection === cid) delete next.primaryCollection
        if (next.ownCollection === cid)     delete next.ownCollection
        return next
      }))
      setDetail(null)
    } catch (e) {
      console.error('[admin] delete collection failed:', e)
      alert('Nepavyko ištrinti kolekcijos: ' + e.message)
    }
  }

  /**
   * Catalog entry save — admin editor'ius keičia rūšies / cultivar žinias
   * (care info, image, aprašymas). Doc ID nesikeičia, net jei keičiasi
   * lotyniškas — kad nesujauktume taxonGroup link'ų ir existing user ref'ų.
   * Jei reikia visiškai pervardyti — delete + new entry per saveToCatalog'ą.
   */
  const saveCatalogEntry = async (entryId, patch) => {
    try {
      await setDoc(doc(db, 'catalog', entryId), {
        ...patch,
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      setCatalog(prev => prev.map(e => e.id === entryId ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e))
      // Search autocomplete + library-first short-circuit'as iškart atspindi
      // pakeitimus (kitaip stale 24h localStorage cache slėptų).
      bustCatalogCache()
      // Query response cache irgi — kad cache'inti AI atsakymai neslėptų
      // admin'o atnaujintos info už senų rezultatų.
      bustSearchResponseCache()
    } catch (e) {
      console.error('[admin] save catalog failed:', e)
      alert('Nepavyko išsaugoti catalog entry: ' + e.message)
      throw e
    }
  }

  const deleteCatalogEntry = async (entryId, label) => {
    if (!window.confirm(`Ištrinti catalog entry „${label}"?\n\nVeiksmas negrįžtamas — augalas dings iš shared library'os.`)) return
    try {
      await deleteDoc(doc(db, 'catalog', entryId))
      setCatalog(prev => prev.filter(e => e.id !== entryId))
      bustCatalogCache()           // stale autocomplete fix
      bustSearchResponseCache()    // ir AI response cache'as
    } catch (e) {
      console.error('[admin] delete catalog failed:', e)
      alert('Nepavyko ištrinti: ' + e.message)
    }
  }

  /**
   * TaxonGroup save — keičia serijos care šabloną. Visi catalog cultivars,
   * kurie turi `taxonGroupId === groupId`, paveldės naują care info per
   * `mergeWithSeries()`.
   */
  const saveTaxonGroupEntry = async (groupId, patch) => {
    try {
      await setDoc(doc(db, 'taxonGroups', groupId), {
        ...patch,
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      setTaxonGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...patch, updatedAt: new Date().toISOString() } : g))
      // Serija paveldi care info cultivar'iams — bust'inam search cache'us,
      // kad cached AI rezultatai (kuriuose galėjo būti senos care info iš
      // catalog'o cultivar'ų) iš naujo gautų svežią info.
      bustCatalogCache()
      bustSearchResponseCache()
    } catch (e) {
      console.error('[admin] save taxonGroup failed:', e)
      alert('Nepavyko išsaugoti serijos: ' + e.message)
      throw e
    }
  }

  const deleteTaxonGroupEntry = async (groupId, label) => {
    // Cascade'as: serija + visi jos cultivars. Skirtingai nei senesnė
    // implementacija (kuri palikdavo cultivar'us kaip standalone), unified
    // Library tab'as serijas vaizduoja kaip „folder" su contents — todėl
    // delete'as logiškai išvalo viską.
    const linkedCultivars = catalog.filter(c => c.taxonGroupId === groupId)

    if (!window.confirm(
      `Ištrinti seriją „${label}"?\n\n` +
      `Cascade'as ištrins:\n` +
      `• serijos doc'ą (taxonGroup)\n` +
      `• ${linkedCultivars.length} cultivar(s) (catalog)\n\n` +
      `Veiksmas negrįžtamas.`
    )) return

    // Antrasis confirm'as didelėms serijoms — apsauga nuo accidental click'o
    if (linkedCultivars.length > 10 && !window.confirm(
      `Tikrai? Bus prarasti ${linkedCultivars.length} cultivars iš catalog'o.`
    )) return

    try {
      // 1. Cascade — visi catalog cultivars su šituo taxonGroupId
      await Promise.all(linkedCultivars.map(c => deleteDoc(doc(db, 'catalog', c.id))))
      // 2. Pati serijos doc'as
      await deleteDoc(doc(db, 'taxonGroups', groupId))
      // 3. Local state refresh
      setTaxonGroups(prev => prev.filter(g => g.id !== groupId))
      setCatalog(prev => prev.filter(c => c.taxonGroupId !== groupId))
      bustCatalogCache()
      bustSearchResponseCache()
    } catch (e) {
      console.error('[admin] delete taxonGroup failed:', e)
      alert('Nepavyko ištrinti: ' + e.message)
    }
  }

  const deleteInvite = async (token) => {
    try {
      await deleteDoc(doc(db, 'invites', token))
      setInvites(prev => prev.filter(i => i.token !== token))
    } catch (e) { alert('Nepavyko ištrinti invite: ' + e.message) }
  }

  const bulkDeleteExpiredInvites = async () => {
    const now = Date.now()
    const expired = invites.filter(i => {
      // Expired = exp date praeitis ARBA used==true ARBA active==false
      if (i.used === true) return true
      if (i.active === false) return true
      if (i.expiresAt && new Date(i.expiresAt).getTime() < now) return true
      return false
    })
    if (expired.length === 0) {
      alert('Nėra expired/used/inactive invite\'ų.')
      return
    }
    if (!window.confirm(`Ištrinti ${expired.length} expired/used/inactive invite token'ų?`)) return
    try {
      await Promise.all(expired.map(i => deleteDoc(doc(db, 'invites', i.token))))
      const tokensToRemove = new Set(expired.map(i => i.token))
      setInvites(prev => prev.filter(i => !tokensToRemove.has(i.token)))
    } catch (e) { alert('Nepavyko bulk delete: ' + e.message) }
  }

  // ── Render ───────────────────────────────────────────────────────
  const userByUid = new Map(users.map(u => [u.uid, u]))
  const colByCid  = new Map(collections.map(c => [c.id, c]))
  const pendingCount = users.filter(u => u.approved === false).length

  return (
    <div className="fixed inset-0 z-50 bg-app flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-bone-400/40 flex-shrink-0">
        <T4Icon size={28} ink="#f1ebdd" paper="#1c3a2a" />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">Admin</p>
          <h1 className="font-display text-lg font-semibold tracking-tight text-forest-800 leading-tight">Dashboard</h1>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="w-10 h-10 inline-flex items-center justify-center rounded-btn bg-bone-300/60 hover:bg-bone-400/60 text-forest-700 transition-colors disabled:opacity-50"
          title="Atnaujinti"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
        <button
          onClick={onClose}
          className="w-10 h-10 inline-flex items-center justify-center rounded-btn bg-bone-300/60 hover:bg-bone-400/60 text-forest-700 transition-colors"
          title="Uždaryti"
        >
          <X size={16} />
        </button>
      </header>

      {/* Stats strip */}
      <div className="px-6 py-3 flex gap-3 flex-shrink-0 overflow-x-auto">
        <StatPill label="Vartotojai" value={users.length} Icon={Users} />
        {pendingCount > 0 && <StatPill label="Pending" value={pendingCount} Icon={UserCheck} tone="terracotta" />}
        <StatPill label="Kolekcijos" value={collections.length} Icon={Database} />
        <StatPill label="Augalų viso" value={collections.reduce((s, c) => s + (c.plantCount ?? 0), 0)} Icon={Sparkles} />
        <StatPill label="Biblioteka" value={catalog.length} Icon={BookOpen} />
        <StatPill label="Invitai" value={invites.length} Icon={Mail} />
      </div>

      {/* Tab switcher */}
      <div className="px-6 flex-shrink-0 overflow-x-auto">
        <nav className="inline-flex bg-bone-100 rounded-btn p-1 gap-0.5">
          <TabBtn active={tab === 'users'} onClick={() => setTab('users')} Icon={Users} label="Vartotojai" count={users.length} />
          <TabBtn active={tab === 'collections'} onClick={() => setTab('collections')} Icon={Database} label="Kolekcijos" count={collections.length} />
          <TabBtn active={tab === 'library'} onClick={() => setTab('library')} Icon={BookOpen} label="Biblioteka" count={catalog.length + taxonGroups.length} />
          <TabBtn active={tab === 'invites'} onClick={() => setTab('invites')} Icon={Mail} label="Invitai" count={invites.length} />
        </nav>
      </div>

      {/* Content — library tab'as gauna full-bleed (be padding/overflow wrapper'io),
          kad 3-pane editor'iui būtų prieinamas visas viewport plotis ir kiekvienas
          pane'as galėtų valdyti savo scroll'ą atskirai. Kiti tab'ai naudoja
          standartinį padded scrollable container'į. */}
      {tab === 'library' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          {error && (
            <div className="m-3 bg-terracotta-50 border border-terracotta-200/60 rounded-2xl p-4 text-sm text-terracotta-700">
              <p className="font-semibold">Klaida</p>
              <p className="text-xs mt-1">{error}</p>
            </div>
          )}
          {loading && !catalog.length && !taxonGroups.length ? (
            <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-forest-400" /></div>
          ) : (
            <LibraryEditorV2
              catalog={catalog}
              taxonGroups={taxonGroups}
              onSaveCatalog={saveCatalogEntry}
              onDeleteCatalog={deleteCatalogEntry}
              onSaveTaxonGroup={saveTaxonGroupEntry}
              onDeleteTaxonGroup={deleteTaxonGroupEntry}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {error && (
            <div className="bg-terracotta-50 border border-terracotta-200/60 rounded-2xl p-4 text-sm text-terracotta-700 mb-4">
              <p className="font-semibold">Klaida</p>
              <p className="text-xs mt-1">{error}</p>
              <p className="text-xs mt-2 text-terracotta-600">Žiūrėk README — Firebase Console → Firestore Rules turi leisti admin'ui skaityti /users + /collections globally.</p>
            </div>
          )}

          {loading && !users.length && !collections.length ? (
            <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-forest-400" /></div>
          ) : tab === 'users' ? (
            <UsersTable
              users={users}
              currentUid={currentUid}
              collections={collections}
              onToggleAdmin={toggleAdmin}
              onToggleBeta={toggleBeta}
              onSetPlan={setPlan}
              onApprove={approveUser}
              onSelect={u => setDetail({ type: 'user', data: u })}
            />
          ) : tab === 'collections' ? (
            <CollectionsTable
              collections={collections}
              userByUid={userByUid}
              onSelect={c => setDetail({ type: 'collection', data: c })}
            />
          ) : (
            <InvitesTable
              invites={invites}
              colByCid={colByCid}
              userByUid={userByUid}
              onDelete={deleteInvite}
              onBulkExpired={bulkDeleteExpiredInvites}
            />
          )}
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <DetailDrawer
          detail={detail}
          users={users}
          collections={collections}
          currentUid={currentUid}
          onDeleteUser={deleteUser}
          onRenameCollection={renameCollection}
          onDeleteCollection={deleteCollection}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────

function StatPill({ label, value, Icon, tone = 'forest' }) {
  const iconColor = tone === 'terracotta' ? 'text-terracotta-500' : 'text-forest-500'
  return (
    <div className={`flex-1 ${WIDGET} px-4 py-2.5`}>
      <div className="flex items-center gap-2">
        <Icon size={14} className={iconColor} />
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-forest-500">{label}</p>
      </div>
      <p className="font-display text-2xl font-semibold tabular-nums text-forest-800 leading-none mt-1">{value}</p>
    </div>
  )
}

function TabBtn({ active, onClick, Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-btn-sm text-[13.5px] font-medium transition-colors ${
        active
          ? 'bg-bone-50 text-forest-700 shadow-[0_1px_2px_rgba(28,58,42,0.06)]'
          : 'text-forest-500 hover:text-forest-700'
      }`}
    >
      <Icon size={13} />
      {label}
      <span className={`font-mono text-[10px] font-medium px-1.5 py-px rounded-full ${
        active ? 'bg-forest-100 text-forest-700' : 'bg-bone-300 text-forest-600'
      }`}>{count}</span>
    </button>
  )
}

function UsersTable({ users, currentUid, collections, onToggleAdmin, onToggleBeta, onSetPlan, onApprove, onSelect }) {
  if (!users.length) {
    return <p className="text-center text-forest-500 py-12">Nėra vartotojų</p>
  }
  return (
    <div className={`overflow-hidden ${WIDGET}`}>
      <table className="w-full text-sm">
        <thead className="bg-bone-100 border-b border-bone-400/40">
          <tr className="text-left">
            <Th>Vartotojas</Th>
            <Th center>Statusas</Th>
            <Th>Joined</Th>
            <Th>Own collection</Th>
            <Th>Member of</Th>
            <Th center>Beta</Th>
            <Th center>Plan</Th>
            <Th center>Admin</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => {
            const ownColCount = collections.filter(c => c.ownerId === u.uid).length
            const memberCount = (u.collections?.length ?? 0)
            const isPending = u.approved === false
            return (
              <tr key={u.uid} className={`border-b border-bone-400/20 hover:bg-bone-100/50 transition-colors ${isPending ? 'bg-terracotta-50/40' : ''}`}>
                <Td>
                  <div className="font-medium text-forest-800">{u.displayName || u.email?.split('@')[0] || 'Vartotojas'}</div>
                  <div className="text-xs text-forest-400 font-mono">{u.email || shortId(u.uid)}</div>
                </Td>
                <Td center>
                  {isPending ? (
                    <button
                      onClick={() => onApprove(u.uid)}
                      className="inline-flex items-center gap-1 bg-terracotta text-bone text-[11px] font-semibold px-2 py-1 rounded-full hover:bg-terracotta-500 transition-colors"
                      title="Patvirtinti — leisti prieigą"
                    >
                      <UserCheck size={11} /> Patvirtinti
                    </button>
                  ) : (
                    <Badge tone="forest">approved</Badge>
                  )}
                </Td>
                <Td><span className="text-xs text-forest-500">{formatDate(u.createdAt)}</span></Td>
                <Td>{ownColCount > 0 ? <Badge tone="forest">{ownColCount}</Badge> : <span className="text-forest-300">—</span>}</Td>
                <Td>{memberCount > 0 ? <Badge tone="bone">{memberCount}</Badge> : <span className="text-forest-300">—</span>}</Td>
                <Td center>
                  <button onClick={() => onToggleBeta(u.uid, u.beta)} className={`w-7 h-5 rounded-full transition-colors ${u.beta ? 'bg-forest-500' : 'bg-bone-300'}`} title={u.beta ? 'Beta on' : 'Beta off'}>
                    <span className={`block w-3.5 h-3.5 rounded-full bg-bone-50 shadow transition-transform ${u.beta ? 'translate-x-3' : 'translate-x-0.5'}`} />
                  </button>
                </Td>
                <Td center>
                  <select
                    value={u.subscription?.plan ?? 'free'}
                    onChange={e => onSetPlan(u.uid, e.target.value)}
                    className="text-xs bg-bone-100 border border-bone-400/40 rounded px-1.5 py-0.5 text-forest-700 outline-none focus:border-forest-400"
                  >
                    <option value="free">free</option>
                    <option value="premium">premium</option>
                    <option value="pro">pro</option>
                  </select>
                </Td>
                <Td center>
                  <button
                    onClick={() => onToggleAdmin(u.uid, u.isAdmin)}
                    className={`w-7 h-5 rounded-full transition-colors ${u.isAdmin ? 'bg-terracotta-500' : 'bg-bone-300'}`}
                    title={u.isAdmin ? 'Admin' : 'Ne admin'}
                  >
                    <span className={`block w-3.5 h-3.5 rounded-full bg-bone-50 shadow transition-transform ${u.isAdmin ? 'translate-x-3' : 'translate-x-0.5'}`} />
                  </button>
                  {u.uid === currentUid && <p className="font-mono text-[8px] text-terracotta-500 mt-0.5">tu</p>}
                </Td>
                <Td>
                  <button onClick={() => onSelect(u)} className="text-forest-400 hover:text-forest-700" title="Detalės">
                    <ChevronRight size={16} />
                  </button>
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CollectionsTable({ collections, userByUid, onSelect }) {
  if (!collections.length) {
    return <p className="text-center text-forest-500 py-12">Nėra kolekcijų</p>
  }
  return (
    <div className={`overflow-hidden ${WIDGET}`}>
      <table className="w-full text-sm">
        <thead className="bg-bone-100 border-b border-bone-400/40">
          <tr className="text-left">
            <Th>Pavadinimas</Th>
            <Th>Owner</Th>
            <Th center>Members</Th>
            <Th center>Augalai</Th>
            <Th center>Zonos</Th>
            <Th center>Žinynas</Th>
            <Th>Created</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {collections.map(c => {
            const owner = userByUid.get(c.ownerId)
            return (
              <tr key={c.id} className="border-b border-bone-400/20 hover:bg-bone-100/50 transition-colors">
                <Td>
                  <div className="font-medium text-forest-800">{c.name || '—'}</div>
                  <div className="text-xs text-forest-400 font-mono">{shortId(c.id)}</div>
                </Td>
                <Td>
                  {owner ? (
                    <>
                      <div className="text-xs font-medium text-forest-700">{owner.displayName || owner.email?.split('@')[0]}</div>
                      <div className="text-[10px] text-forest-400 font-mono">{owner.email}</div>
                    </>
                  ) : (
                    <span className="text-xs text-forest-300 font-mono">{shortId(c.ownerId)}</span>
                  )}
                </Td>
                <Td center><Badge tone="bone">{c.memberCount}</Badge></Td>
                <Td center><Badge tone="forest">{c.plantCount}</Badge></Td>
                <Td center><span className="text-xs text-forest-500">{c.zonesCount}</span></Td>
                <Td center><span className="text-xs text-forest-500">{c.zinynasCount}</span></Td>
                <Td><span className="text-xs text-forest-500">{formatDate(c.createdAt)}</span></Td>
                <Td>
                  <button onClick={() => onSelect(c)} className="text-forest-400 hover:text-forest-700" title="Detalės">
                    <ChevronRight size={16} />
                  </button>
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, center }) {
  return <th className={`font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-forest-500 px-3 py-2.5 ${center ? 'text-center' : ''}`}>{children}</th>
}
function Td({ children, center }) {
  return <td className={`px-3 py-2.5 align-middle ${center ? 'text-center' : ''}`}>{children}</td>
}
function Badge({ children, tone = 'forest' }) {
  const cls = tone === 'forest' ? 'bg-forest-100 text-forest-700' : 'bg-bone-300 text-forest-600'
  return <span className={`inline-flex font-mono text-[11px] font-medium tabular-nums px-1.5 py-0.5 rounded-full ${cls}`}>{children}</span>
}

// ── Detail drawer (right-side sheet su drill-down info) ─────────────

function DetailDrawer({ detail, users, collections, currentUid, onDeleteUser, onRenameCollection, onDeleteCollection, onClose }) {
  const isUser = detail.type === 'user'
  const data   = detail.data

  let body = null
  if (isUser) {
    const u = data
    const ownedCols = collections.filter(c => c.ownerId === u.uid)
    const memberCols = collections.filter(c => (c.members ?? []).includes(u.uid) && c.ownerId !== u.uid)
    body = (
      <>
        <Section label="Identifikacija">
          <Row k="UID" v={<span className="font-mono text-[11px]">{u.uid}</span>} />
          <Row k="Email" v={u.email || '—'} />
          <Row k="Vardas" v={u.displayName || '—'} />
          <Row k="Joined" v={formatDate(u.createdAt)} />
          <Row k="Atnaujinta" v={formatDate(u.updatedAt)} />
        </Section>
        <Section label="Status">
          <Row k="Admin" v={u.isAdmin ? <Badge tone="forest">YES</Badge> : <span className="text-forest-400">no</span>} />
          <Row k="Beta" v={u.beta ? <Badge tone="forest">YES</Badge> : <span className="text-forest-400">no</span>} />
          <Row k="Plan" v={<Badge>{u.subscription?.plan ?? 'free'}</Badge>} />
          <Row k="Plan iki" v={formatDate(u.subscription?.validUntil)} />
        </Section>
        <Section label={`Owned (${ownedCols.length})`}>
          {ownedCols.length === 0 ? <p className="text-xs text-forest-400 px-1">—</p> :
            ownedCols.map(c => <CollectionMini key={c.id} c={c} />)}
        </Section>
        <Section label={`Member (${memberCols.length})`}>
          {memberCols.length === 0 ? <p className="text-xs text-forest-400 px-1">—</p> :
            memberCols.map(c => <CollectionMini key={c.id} c={c} role={c.roles?.[u.uid]} />)}
        </Section>
        <Section label="AI usage">
          <Row k="Searches" v={u.aiUsage?.searches ?? 0} />
          <Row k="Chats" v={u.aiUsage?.chats ?? 0} />
          <Row k="FB posts" v={u.aiUsage?.fbPosts ?? 0} />
        </Section>
      </>
    )
  } else {
    const c = data
    const owner = users.find(u => u.uid === c.ownerId)
    const members = (c.members ?? []).map(uid => ({
      uid,
      user: users.find(u => u.uid === uid),
      role: c.roles?.[uid] ?? (uid === c.ownerId ? 'owner' : 'member'),
    }))
    body = (
      <>
        <Section label="Identifikacija">
          <Row k="ID" v={<span className="font-mono text-[11px]">{c.id}</span>} />
          <Row k="Pavadinimas" v={
            <CollectionNameEditor
              value={c.name}
              onSave={(newName) => onRenameCollection?.(c.id, newName)}
            />
          } />
          <Row k="Owner" v={owner ? `${owner.displayName || owner.email?.split('@')[0]} (${owner.email})` : shortId(c.ownerId)} />
          <Row k="Created" v={formatDate(c.createdAt)} />
        </Section>
        <Section label="Turinys">
          <Row k="Augalai" v={<Badge tone="forest">{c.plantCount}</Badge>} />
          <Row k="Zonos" v={c.zonesCount} />
          <Row k="Žinynas" v={c.zinynasCount} />
        </Section>
        <Section label={`Members (${members.length})`}>
          {members.length === 0 ? <p className="text-xs text-forest-400 px-1">—</p> :
            members.map(m => (
              <div key={m.uid} className="flex items-center justify-between gap-2 px-1 py-1 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-forest-700 truncate">{m.user?.displayName || m.user?.email?.split('@')[0] || shortId(m.uid)}</div>
                  <div className="text-forest-400 font-mono text-[10px] truncate">{m.user?.email ?? m.uid}</div>
                </div>
                <Badge tone={m.role === 'owner' ? 'forest' : 'bone'}>{m.role}</Badge>
              </div>
            ))
          }
        </Section>
        <Section label={`Viewer invites (${(c.viewerInvites ?? []).length})`}>
          {(c.viewerInvites ?? []).length === 0 ? <p className="text-xs text-forest-400 px-1">—</p> :
            (c.viewerInvites ?? []).map((v, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-1 py-1 text-xs">
                <span className="font-mono text-forest-500">{v.token}</span>
                <span className="text-forest-400">{v.active === false ? 'revoked' : 'active'}</span>
              </div>
            ))
          }
        </Section>
      </>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button className="flex-1 bg-forest-900/30" onClick={onClose} aria-label="Uždaryti" />
      <div className="w-[420px] max-w-[90vw] h-full bg-bone-50 border-l border-bone-400/40 flex flex-col">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-bone-400/40 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">{isUser ? 'Vartotojas' : 'Kolekcija'}</p>
            <h2 className="font-display text-base font-semibold tracking-tight text-forest-800 truncate">
              {isUser ? (data.displayName || data.email || 'Vartotojas') : (data.name || '—')}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 inline-flex items-center justify-center rounded-btn-sm hover:bg-bone-300/40 text-forest-600">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {body}
        </div>

        {/* Danger zone — soft delete user (Firebase Auth lieka, žiūr. deleteUser docstring'ą) */}
        {isUser && data.uid !== currentUid && (
          <div className="border-t border-terracotta-200/40 bg-terracotta-50/40 px-5 py-4 flex-shrink-0">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-terracotta-600 mb-2 flex items-center gap-1.5">
              <AlertTriangle size={11} /> Danger zone
            </p>
            <button
              onClick={() => onDeleteUser(data.uid, data.displayName || data.email || data.uid)}
              className="w-full inline-flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-500 text-bone px-4 py-2.5 rounded-btn text-sm font-semibold transition-colors"
            >
              <Trash2 size={14} /> Ištrinti vartotoją + jo duomenis
            </button>
            <p className="text-[10px] text-terracotta-600 mt-2 text-center">
              Firebase Auth account'as lieka — galės prisijungti iš naujo (pateks į pending).
            </p>
          </div>
        )}

        {/* Danger zone — delete collection. Cascade'as: plants + invites +
            users'iu primary/own refs → null. Žiūr. deleteCollection docstring'ą. */}
        {!isUser && (
          <div className="border-t border-terracotta-200/40 bg-terracotta-50/40 px-5 py-4 flex-shrink-0">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-terracotta-600 mb-2 flex items-center gap-1.5">
              <AlertTriangle size={11} /> Danger zone
            </p>
            <button
              onClick={() => onDeleteCollection(data.id, data.name, data.plantCount ?? 0, data.memberCount ?? (data.members?.length ?? 0))}
              className="w-full inline-flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-500 text-bone px-4 py-2.5 rounded-btn text-sm font-semibold transition-colors"
            >
              <Trash2 size={14} /> Ištrinti kolekciją + visus jos augalus
            </button>
            <p className="text-[10px] text-terracotta-600 mt-2 text-center">
              {(data.plantCount ?? 0)} augalai · {data.memberCount ?? (data.members?.length ?? 0)} narių. Veiksmas negrįžtamas.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500 mb-2 px-1">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}
function Row({ k, v }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm border-b border-bone-400/20 py-1.5 px-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-400">{k}</span>
      <span className="text-forest-700 text-right text-xs max-w-[60%] truncate">{v}</span>
    </div>
  )
}
/**
 * Inline rename'inimas kolekcijos pavadinimo. Klik'as pieštuko ikonėlę →
 * input'as; Enter/Check button save'ina, Esc/X cancel'ina, blur'as ignore'inamas
 * (kad accidentaliai nesave'intume tuščios reikšmės).
 */
function CollectionNameEditor({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value ?? '')

  // Re-sync kai pasikeičia outer value (pvz. po save'o)
  useEffect(() => { setDraft(value ?? '') }, [value])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== (value ?? '')) onSave?.(trimmed)
    setEditing(false)
  }
  const cancel = () => {
    setDraft(value ?? '')
    setEditing(false)
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="truncate">{value || '—'}</span>
        <button
          onClick={() => setEditing(true)}
          className="text-forest-400 hover:text-forest-700 transition-colors"
          title="Pervadinti"
        >
          <Pencil size={11} />
        </button>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter')  commit()
          if (e.key === 'Escape') cancel()
        }}
        className="bg-bone-50 border border-bone-400/60 rounded-md px-1.5 py-0.5 text-xs text-forest-800 focus:outline-none focus:border-forest-500 w-32"
      />
      <button onClick={commit} className="text-forest-500 hover:text-forest-700" title="Išsaugoti">
        <Check size={12} />
      </button>
      <button onClick={cancel} className="text-forest-400 hover:text-terracotta-500" title="Atšaukti">
        <X size={12} />
      </button>
    </span>
  )
}

function CollectionMini({ c, role }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 py-1 text-xs border-b border-bone-400/20">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-forest-700 truncate">{c.name || '—'}</div>
        <div className="text-forest-400 font-mono text-[10px]">{shortId(c.id)} · {c.plantCount} augalai</div>
      </div>
      {role && <Badge tone={role === 'owner' ? 'forest' : 'bone'}>{role}</Badge>}
    </div>
  )
}

// ── Invites tab — sąrašas su delete + bulk cleanup ─────────────────────

function InvitesTable({ invites, colByCid, userByUid, onDelete, onBulkExpired }) {
  if (!invites.length) {
    return <p className="text-center text-forest-500 py-12">Nėra invite token'ų</p>
  }
  const now = Date.now()
  const expiredCount = invites.filter(i =>
    i.used === true || i.active === false || (i.expiresAt && new Date(i.expiresAt).getTime() < now)
  ).length

  return (
    <div className="space-y-3">
      {/* Bulk action */}
      {expiredCount > 0 && (
        <div className={`${WIDGET} px-4 py-3 flex items-center justify-between gap-3`}>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta-600">Bulk cleanup</p>
            <p className="text-xs text-forest-700 mt-0.5">{expiredCount} expired / used / inactive invite'ų</p>
          </div>
          <button
            onClick={onBulkExpired}
            className="inline-flex items-center gap-1.5 bg-terracotta hover:bg-terracotta-500 text-bone text-xs font-semibold px-3 py-1.5 rounded-btn transition-colors"
          >
            <Trash2 size={12} /> Ištrinti visus
          </button>
        </div>
      )}

      <div className={`overflow-hidden ${WIDGET}`}>
        <table className="w-full text-sm">
          <thead className="bg-bone-100 border-b border-bone-400/40">
            <tr className="text-left">
              <Th>Token</Th>
              <Th>Kolekcija</Th>
              <Th>Role</Th>
              <Th>Sukurtas</Th>
              <Th>Expires</Th>
              <Th center>Statusas</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {invites.map(i => {
              const col = colByCid.get(i.colId)
              const creator = userByUid.get(i.createdBy)
              const isExpired = i.expiresAt && new Date(i.expiresAt).getTime() < now
              const isInactive = i.active === false || i.used === true
              return (
                <tr key={i.token} className={`border-b border-bone-400/20 hover:bg-bone-100/50 transition-colors ${isInactive || isExpired ? 'opacity-60' : ''}`}>
                  <Td>
                    <span className="font-mono text-[11px] text-forest-700">{i.token}</span>
                    {creator && (
                      <div className="text-[10px] text-forest-400 font-mono mt-0.5">by {creator.email?.split('@')[0] ?? shortId(i.createdBy)}</div>
                    )}
                  </Td>
                  <Td>
                    <div className="text-xs text-forest-700 truncate max-w-[140px]">{col?.name ?? '—'}</div>
                    <div className="text-[10px] text-forest-400 font-mono">{shortId(i.colId)}</div>
                  </Td>
                  <Td><Badge tone={i.role === 'viewer' ? 'bone' : 'forest'}>{i.role ?? 'member'}</Badge></Td>
                  <Td><span className="text-xs text-forest-500">{formatDate(i.createdAt)}</span></Td>
                  <Td><span className={`text-xs ${isExpired ? 'text-terracotta-600' : 'text-forest-500'}`}>{formatDate(i.expiresAt)}</span></Td>
                  <Td center>
                    {i.used      ? <Badge tone="bone">used</Badge>     :
                     !i.active   ? <Badge tone="bone">revoked</Badge>  :
                     isExpired   ? <Badge tone="bone">expired</Badge>  :
                                   <Badge tone="forest">active</Badge>}
                  </Td>
                  <Td>
                    <button
                      onClick={() => onDelete(i.token)}
                      className="text-terracotta hover:text-terracotta-600 transition-colors"
                      title="Ištrinti invite"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
