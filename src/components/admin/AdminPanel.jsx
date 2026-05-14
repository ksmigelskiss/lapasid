import { useState, useEffect, useCallback } from 'react'
import { getDocs, getDoc, collection, doc, updateDoc, query, orderBy } from 'firebase/firestore'
import { Users, Database, X, Shield, Sparkles, BadgeCheck, Loader2, RefreshCw, ChevronRight } from 'lucide-react'
import { db } from '../../utils/firebase'
import T4Icon from '../brand/T4Icon'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detail, setDetail] = useState(null) // { type: 'user'|'collection', data }

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // Users
      const usersSnap = await getDocs(collection(db, 'users'))
      const usersList = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }))

      // Collections + plant counts (parallel)
      const colsSnap = await getDocs(collection(db, 'collections'))
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

      setUsers(usersList.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')))
      setCollections(colsList.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')))
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

  // ── Render ───────────────────────────────────────────────────────
  const userByUid = new Map(users.map(u => [u.uid, u]))

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
      <div className="px-6 py-3 flex gap-3 flex-shrink-0">
        <StatPill label="Vartotojai" value={users.length} Icon={Users} />
        <StatPill label="Kolekcijos" value={collections.length} Icon={Database} />
        <StatPill label="Augalų viso" value={collections.reduce((s, c) => s + (c.plantCount ?? 0), 0)} Icon={Sparkles} />
        <StatPill label="Admin'ai" value={users.filter(u => u.isAdmin).length} Icon={Shield} tone="terracotta" />
      </div>

      {/* Tab switcher */}
      <div className="px-6 flex-shrink-0">
        <nav className="inline-flex bg-bone-100 rounded-btn p-1 gap-0.5">
          <TabBtn active={tab === 'users'} onClick={() => setTab('users')} Icon={Users} label="Vartotojai" count={users.length} />
          <TabBtn active={tab === 'collections'} onClick={() => setTab('collections')} Icon={Database} label="Kolekcijos" count={collections.length} />
        </nav>
      </div>

      {/* Content */}
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
            onSelect={u => setDetail({ type: 'user', data: u })}
          />
        ) : (
          <CollectionsTable
            collections={collections}
            userByUid={userByUid}
            onSelect={c => setDetail({ type: 'collection', data: c })}
          />
        )}
      </div>

      {/* Detail drawer */}
      {detail && (
        <DetailDrawer
          detail={detail}
          users={users}
          collections={collections}
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

function UsersTable({ users, currentUid, collections, onToggleAdmin, onToggleBeta, onSetPlan, onSelect }) {
  if (!users.length) {
    return <p className="text-center text-forest-500 py-12">Nėra vartotojų</p>
  }
  return (
    <div className={`overflow-hidden ${WIDGET}`}>
      <table className="w-full text-sm">
        <thead className="bg-bone-100 border-b border-bone-400/40">
          <tr className="text-left">
            <Th>Vartotojas</Th>
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
            return (
              <tr key={u.uid} className="border-b border-bone-400/20 hover:bg-bone-100/50 transition-colors">
                <Td>
                  <div className="font-medium text-forest-800">{u.displayName || u.email?.split('@')[0] || 'Vartotojas'}</div>
                  <div className="text-xs text-forest-400 font-mono">{u.email || shortId(u.uid)}</div>
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

function DetailDrawer({ detail, users, collections, onClose }) {
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
          <Row k="Pavadinimas" v={c.name || '—'} />
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
