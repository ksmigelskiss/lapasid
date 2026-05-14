import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, LogOut, UserPlus, Copy, Check, Share2, Eye, Trash2, LogIn } from 'lucide-react'
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { QRCodeSVG } from 'qrcode.react'
import { db } from '../utils/firebase'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useDetailHost } from '../contexts/DetailHostContext'

// Sukuria invite tokeną Firestore'e, grąžina URL su role
async function generateInviteLink(collectionId, uid, role = 'member') {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  const token = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    .slice(0, 12)
  const createdAt = new Date().toISOString()
  await setDoc(doc(db, 'invites', token), {
    colId:     collectionId,
    createdBy: uid,
    role,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    used:      false,
    active:    true,
    createdAt,
  })
  if (role === 'viewer') {
    await setDoc(doc(db, 'collections', collectionId), {
      viewerInvites: arrayUnion({ token, createdAt, active: true }),
    }, { merge: true })
  }
  return `${window.location.origin}?invite=${token}&role=${role}`
}

// Nuskaito kolekcijos narius (be einamojo vartotojo)
async function loadMembers(collectionId, currentUid) {
  const colSnap = await getDoc(doc(db, 'collections', collectionId))
  if (!colSnap.exists()) return []
  const data     = colSnap.data()
  const roles    = data.roles     ?? {}
  const profiles = data.memberProfiles ?? {}
  const uids     = (data.members ?? []).filter(id => id !== currentUid)
  if (!uids.length) return []

  return Promise.all(uids.map(async uid => {
    let userData = {}
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      if (snap.exists()) userData = snap.data()
    } catch {}
    // Kombinuojam — users/{uid} primary, memberProfiles[uid] (atnaujinama
    // kiekvieno login'o useAuth'e) kaip fallback'as. Vienam laukui tuščiam,
    // kitas dažnai turi reikšmę (pvz. seni narių dokumentai be email'o).
    const profileFallback = profiles[uid] ?? {}
    const displayName = userData.displayName || profileFallback.displayName || ''
    const email       = userData.email       || profileFallback.email       || ''
    const finalName   = displayName || email.split('@')[0] || 'Narys'
    return { uid, displayName: finalName, email, role: roles[uid] ?? 'member' }
  }))
}

function initials(str) {
  return (str || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// Prideda vartotoją prie kolekcijos — naudojamas iš useAuth
export async function acceptInvite(uid, token, inviteData, userProfile = {}) {
  const { colId, used, expiresAt, role = 'member' } = inviteData
  if (used || new Date(expiresAt) < new Date()) return null

  let ownCollection = null
  try {
    const userSnap = await getDoc(doc(db, 'users', uid))
    if (userSnap.exists()) {
      ownCollection = userSnap.data().ownCollection ?? userSnap.data().primaryCollection ?? null
    }
  } catch {}

  await updateDoc(doc(db, 'collections', colId), {
    members:                  arrayUnion(uid),
    [`roles.${uid}`]:         role,
    [`memberProfiles.${uid}`]: {
      displayName: userProfile.displayName || '',
      email:       userProfile.email || '',
    },
  })

  await setDoc(doc(db, 'users', uid), {
    primaryCollection: colId,
    ownCollection:     ownCollection,
    collections:       arrayUnion(colId),
    displayName:       userProfile.displayName || '',
    email:             userProfile.email || '',
    updatedAt:         new Date().toISOString(),
  }, { merge: true })

  await updateDoc(doc(db, 'invites', token), { used: true, usedBy: uid })

  return colId
}

export default function ProfileSheet({ user, collectionId, role = 'owner', ownCollectionId, allCollections = [], onSignOut, onClose, onSwitchCollection, onRenameCollection }) {
  // Desktop split panel: portaliuojam į RightPanel container'į.
  const isDesktop = useIsDesktop()
  const host = useDetailHost()
  const useDesktopPanel = isDesktop && !!host?.container

  useEffect(() => {
    if (!useDesktopPanel || !host) return
    host.open()
    return () => host.close()
  }, [useDesktopPanel]) // eslint-disable-line react-hooks/exhaustive-deps

  // ESC keyboard shortcut
  useEffect(() => {
    if (!useDesktopPanel) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [useDesktopPanel, onClose])

  const [members,       setMembers]       = useState([])
  const [viewerInvites, setViewerInvites] = useState([])
  const [inviteRole,    setInviteRole]    = useState('member')
  const [inviteUrl,     setInviteUrl]     = useState(null)
  const [generating,    setGenerating]    = useState(false)
  const [copied,        setCopied]        = useState(false)
  const [removeTarget,  setRemoveTarget]  = useState(null)
  const [removing,      setRemoving]      = useState(false)
  const [leaving,       setLeaving]       = useState(false)
  const [revokingToken, setRevokingToken] = useState(null)

  const isOwner         = role === 'owner'
  const isShared        = collectionId !== ownCollectionId && ownCollectionId != null
  const canInviteMember = isOwner
  const canInviteViewer = isOwner || role === 'member'
  const showToggle      = canInviteMember && canInviteViewer

  useEffect(() => {
    if (!collectionId || !user?.uid) return
    loadMembers(collectionId, user.uid).then(setMembers).catch(() => {})
    getDoc(doc(db, 'collections', collectionId)).then(snap => {
      if (!snap.exists()) return
      const arr = (snap.data().viewerInvites ?? []).filter(v => v.active !== false)
      setViewerInvites(arr)
    }).catch(() => {})
  }, [collectionId, user?.uid])

  // Reset invite url kai keičiasi rolė
  useEffect(() => { setInviteUrl(null) }, [inviteRole])

  const handleInvite = async (forRole) => {
    const roleToUse = forRole ?? inviteRole
    setGenerating(true)
    try {
      const url = await generateInviteLink(collectionId, user.uid, roleToUse)
      if (roleToUse === 'viewer') {
        const newToken = new URL(url).searchParams.get('invite')
        if (newToken) setViewerInvites(prev => [...prev, { token: newToken, createdAt: new Date().toISOString(), active: true }])
      }
      setInviteUrl(url)
      if (navigator.share) {
        try {
          await navigator.share({
            title: roleToUse === 'viewer' ? 'Augalų priežiūra' : 'Augalų kolekcija',
            text:  roleToUse === 'viewer' ? 'Kviečiu kaip svečią peržiūrėti augalus 🌿' : 'Prisijunk prie augalų kolekcijos 🌿',
            url,
          })
        } catch (e) { if (e.name !== 'AbortError') console.error(e) }
      }
    } catch (e) { console.error('generateInviteLink failed:', e) }
    setGenerating(false)
  }

  const copyLink = async () => {
    if (!inviteUrl) return
    try { await navigator.clipboard.writeText(inviteUrl) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRemoveMember = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await updateDoc(doc(db, 'collections', collectionId), {
        members: arrayRemove(removeTarget.uid),
      })
      setMembers(m => m.filter(x => x.uid !== removeTarget.uid))
    } catch (e) { console.error('remove member failed:', e) }
    setRemoving(false)
    setRemoveTarget(null)
  }

  const handleLeave = async () => {
    setLeaving(true)
    try {
      await updateDoc(doc(db, 'collections', collectionId), {
        members: arrayRemove(user.uid),
      })
      if (ownCollectionId) {
        await setDoc(doc(db, 'users', user.uid), {
          primaryCollection: ownCollectionId,
          collections:       arrayRemove(collectionId),
        }, { merge: true })
        onSwitchCollection?.(ownCollectionId)
      }
      onClose?.()
    } catch (e) { console.error('leave failed:', e) }
    setLeaving(false)
  }

  const handleRevokeViewer = async (token) => {
    setRevokingToken(token)
    try {
      await updateDoc(doc(db, 'invites', token), { active: false })
      const colSnap = await getDoc(doc(db, 'collections', collectionId))
      if (colSnap.exists()) {
        const existing = colSnap.data().viewerInvites ?? []
        const updated  = existing.map(v => v.token === token ? { ...v, active: false } : v)
        await setDoc(doc(db, 'collections', collectionId), { viewerInvites: updated }, { merge: true })
      }
      setViewerInvites(prev => prev.filter(v => v.token !== token))
    } catch (e) { console.error('revoke viewer failed:', e) }
    setRevokingToken(null)
  }

  const hasPeople = members.length > 0 || viewerInvites.length > 0

  const tree = (
    <>
      {/* Backdrop — tik mobile (desktop'e panelė pati yra konteineris) */}
      {!useDesktopPanel && (
        <motion.div
          className="fixed inset-0 bg-black/40 z-40"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        />
      )}
      <motion.div
        className={useDesktopPanel
          ? "absolute inset-0 z-20 bg-bone-50 overflow-y-auto"
          : "fixed bottom-0 inset-x-0 z-50 bg-bone-50 rounded-t-3xl max-w-[430px] mx-auto"}
        {...(useDesktopPanel ? {
          // Desktop'e — slide iš dešinės (kortelė įvažiuoja iš panel'ės krašto)
          initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' },
          transition: { type: 'spring', damping: 32, stiffness: 320 },
        } : {
          initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' },
          transition: { type: 'spring', damping: 30, stiffness: 300 },
        })}
      >
        <div className="px-5 pt-5 pb-8 safe-bottom">
          {/* Drag handle — tik mobile (iOS bottom-sheet swipe-to-dismiss).
              Desktop'e panelė slide'inasi iš dešinės, drag handle beprasmis. */}
          {!useDesktopPanel && (
            <div className="w-10 h-1 bg-bone-400/60 rounded-full mx-auto mb-5" />
          )}

          {/* Einamasis vartotojas */}
          <div className="flex items-center gap-3 mb-5">
            {user?.photoURL
              ? <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0 ring-1 ring-bone-400/50" />
              : <div className="w-12 h-12 rounded-full bg-forest-700 flex items-center justify-center text-bone-50 font-display font-semibold text-base flex-shrink-0">
                  {initials(user?.displayName || user?.email)}
                </div>
            }
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-forest-700 truncate tracking-tight">
                {user?.displayName || user?.email?.split('@')[0] || 'Vartotojas'}
              </p>
              <p className="text-xs text-forest-400 truncate">{user?.email || ''}</p>
            </div>
            <button onClick={onClose} className="w-10 h-10 bg-bone-300/60 hover:bg-bone-400/60 rounded-btn flex items-center justify-center text-forest-700 transition-colors flex-shrink-0" aria-label="Uždaryti">
              <X size={16} />
            </button>
          </div>

          {/* Kolekcijos — switcher kai > 1 (toolbar Stepono mygtuko pakaitalas).
              Jei tik 1 — statiškai parodom dabartinę. */}
          {(() => {
            const switchable = allCollections.filter(c => c.hasPlants !== false)
            if (switchable.length <= 1) {
              const cur = allCollections.find(c => c.id === collectionId)
              return cur ? (
                <div className="bg-bone-100 border border-bone-400/40 rounded-2xl px-4 py-3 mb-3 flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-forest-100 text-forest-700 inline-flex items-center justify-center text-[12px] font-bold flex-shrink-0">
                    {(cur.name || 'L')[0].toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-forest-700 flex-1 truncate">{cur.name}</span>
                </div>
              ) : null
            }
            return (
              <div className="bg-bone-100 border border-bone-400/40 rounded-2xl px-4 py-3.5 mb-3">
                <p className="font-mono text-[10px] font-medium text-forest-400 uppercase tracking-[0.18em] mb-2.5">Kolekcijos</p>
                <div className="space-y-1">
                  {switchable.map(c => {
                    const isActive = c.id === collectionId
                    return (
                      <button
                        key={c.id}
                        onClick={() => { onSwitchCollection?.(c.id); onClose?.() }}
                        className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-btn-sm text-left transition-colors ${
                          isActive ? 'bg-bone-50' : 'hover:bg-bone-50/60 active:bg-bone-50'
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${
                          isActive ? 'bg-forest-700 text-bone-50' : 'bg-forest-100 text-forest-700'
                        }`}>
                          {(c.name || 'L')[0].toUpperCase()}
                        </span>
                        <span className={`flex-1 text-sm truncate ${isActive ? 'font-semibold text-forest-700' : 'text-forest-600'}`}>{c.name}</span>
                        {isActive && <Check size={15} className="text-forest-700 flex-shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Nariai + prižiūrėtojų nuorodos — vienas sąrašas */}
          {hasPeople && (
            <div className="bg-bone-100 border border-bone-400/40 rounded-2xl px-4 py-3.5 mb-3">
              <p className="font-mono text-[10px] font-medium text-forest-400 uppercase tracking-[0.18em] mb-2.5">Dalijamasi su</p>
              <div className="space-y-2.5">
                {/* Firebase nariai */}
                {members.map(m => (
                  <div key={m.uid} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-forest-100 flex items-center justify-center text-forest-700 text-xs font-bold flex-shrink-0">
                      {initials(m.displayName || m.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-forest-700 truncate">{m.displayName}</p>
                        {m.role === 'viewer' && <Eye size={12} className="text-forest-400 flex-shrink-0" />}
                      </div>
                      {m.email && <p className="text-xs text-forest-400 truncate">{m.email}</p>}
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => setRemoveTarget({ uid: m.uid, name: m.displayName })}
                        className="w-7 h-7 flex items-center justify-center rounded-btn-sm hover:bg-terracotta-50 active:bg-terracotta-100 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={14} className="text-terracotta-500" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Viewer invite nuorodos */}
                {viewerInvites.map(v => (
                  <div key={v.token} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-bone-300/60 flex items-center justify-center flex-shrink-0">
                      <Eye size={14} className="text-forest-500" />
                    </div>
                    <button
                      className="flex-1 min-w-0 text-left active:opacity-60"
                      onClick={() => {
                        setInviteRole('viewer')
                        setInviteUrl(`${window.location.origin}?invite=${v.token}&role=viewer`)
                      }}
                    >
                      <p className="text-sm font-medium text-forest-600">Svečias</p>
                      <p className="text-xs text-forest-400 font-mono truncate">{v.token}</p>
                    </button>
                    <button
                      onClick={() => handleRevokeViewer(v.token)}
                      disabled={revokingToken === v.token}
                      className="text-xs text-terracotta-500 font-medium active:text-terracotta-600 disabled:opacity-50 flex-shrink-0 px-1"
                    >
                      {revokingToken === v.token ? '...' : 'Atšaukti'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kvietimo sekcija */}
          {(canInviteMember || canInviteViewer) && (
            <div className="bg-bone-100 border border-bone-400/40 rounded-2xl p-4 mb-3">
              <p className="font-mono text-[10px] font-medium text-forest-400 uppercase tracking-[0.18em] mb-3">Pakviesti</p>

              {/* Rolės toggle — tik jei gali kviesti abu */}
              {showToggle && (
                <div className="flex bg-bone-50 border border-bone-400/40 rounded-btn p-1 mb-3">
                  <button
                    onClick={() => setInviteRole('member')}
                    className={`flex-1 py-1.5 rounded-btn-sm text-sm font-medium transition-colors ${
                      inviteRole === 'member'
                        ? 'bg-forest-700 text-bone-50 shadow-[0_1px_2px_rgba(28,58,42,0.18)]'
                        : 'text-forest-500 hover:text-forest-700'
                    }`}
                  >
                    Narys
                  </button>
                  <button
                    onClick={() => setInviteRole('viewer')}
                    className={`flex-1 py-1.5 rounded-btn-sm text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      inviteRole === 'viewer'
                        ? 'bg-forest-700 text-bone-50 shadow-[0_1px_2px_rgba(28,58,42,0.18)]'
                        : 'text-forest-500 hover:text-forest-700'
                    }`}
                  >
                    <Eye size={13} />
                    Svečias
                  </button>
                </div>
              )}

              {/* Aprašymas */}
              <p className="text-xs text-forest-500 leading-relaxed mb-3">
                {inviteRole === 'member'
                  ? 'Narys gali redaguoti augalus ir naudotis AI funkcijomis.'
                  : 'Svečias gali matyti augalus ir žymėti laistymą. Prieiga atšaukiama vienu mygtuku.'}
              </p>

              {!inviteUrl ? (
                <button
                  onClick={() => handleInvite(inviteRole)}
                  disabled={generating}
                  className="w-full py-2.5 rounded-btn bg-forest-700 hover:bg-forest-800 active:bg-forest-800 text-bone-50 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {inviteRole === 'member' ? <UserPlus size={15} /> : <Eye size={15} />}
                  {generating ? 'Generuojama...' : inviteRole === 'member' ? 'Generuoti nuorodą' : 'Pakviesti svečią'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center bg-bone-50 border border-bone-400/40 rounded-2xl p-4">
                    <QRCodeSVG value={inviteUrl} size={160} bgColor="#fefdfa" fgColor="#1c3a2a" />
                  </div>
                  <p className="text-xs text-forest-400 bg-bone-50 border border-bone-400/40 rounded-btn-sm px-3 py-2 truncate font-mono">{inviteUrl}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={copyLink}
                      className="flex-1 py-2.5 rounded-btn border border-bone-400/60 bg-bone-50 text-sm text-forest-700 font-medium flex items-center justify-center gap-1.5 hover:bg-bone-100 active:bg-bone-100 transition-colors"
                    >
                      {copied ? <Check size={14} className="text-forest-700" /> : <Copy size={14} />}
                      {copied ? 'Nukopijuota' : 'Kopijuoti'}
                    </button>
                    {typeof navigator.share === 'function' && (
                      <button
                        onClick={() => handleInvite(inviteRole)}
                        className="flex-1 py-2.5 rounded-btn bg-forest-700 hover:bg-forest-800 active:bg-forest-800 text-bone-50 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Share2 size={14} />
                        Dalintis
                      </button>
                    )}
                  </div>
                  <button onClick={() => setInviteUrl(null)} className="w-full text-xs text-forest-400 hover:text-forest-600 text-center py-1 transition-colors">
                    Nauja nuoroda
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Išeiti iš kolekcijos */}
          {!isOwner && isShared && (
            <button
              onClick={handleLeave}
              disabled={leaving}
              className="w-full py-3 rounded-btn text-terracotta-500 text-sm font-medium flex items-center justify-center gap-2 border border-terracotta-200/60 bg-terracotta-50 hover:bg-terracotta-100 active:bg-terracotta-100 transition-colors mb-3"
            >
              <LogIn size={15} className="rotate-180" />
              {leaving ? 'Išeinama...' : 'Išeiti iš kolekcijos'}
            </button>
          )}

          {/* Atsijungimas */}
          <button
            onClick={onSignOut}
            className="w-full py-3 rounded-btn text-terracotta-600 text-sm font-medium flex items-center justify-center gap-2 border border-terracotta-200/60 bg-terracotta-50 hover:bg-terracotta-100 active:bg-terracotta-100 transition-colors"
          >
            <LogOut size={15} />
            Atsijungti
          </button>
        </div>
      </motion.div>

      {/* Pašalinimo patvirtinimas */}
      <AnimatePresence>
        {removeTarget && (
          <>
            <motion.div
              className="fixed inset-0 bg-forest-900/50 z-[60]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setRemoveTarget(null)}
            />
            <motion.div
              className="fixed inset-x-4 z-[61] bg-bone-50 border border-bone-400/60 rounded-2xl p-5 max-w-[360px] mx-auto shadow-[0_16px_40px_rgba(28,58,42,0.28)]"
              style={{ top: '50%', transform: 'translateY(-50%)' }}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            >
              <p className="font-display font-semibold text-forest-700 tracking-tight mb-1">Pašalinti narį?</p>
              <p className="text-sm text-forest-500 mb-4">
                <span className="font-medium text-forest-700">{removeTarget.name}</span> nebegalės peržiūrėti šios kolekcijos.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setRemoveTarget(null)} className="flex-1 py-2.5 rounded-btn border border-bone-400/60 bg-bone-50 hover:bg-bone-100 text-sm text-forest-600 font-medium transition-colors">
                  Atšaukti
                </button>
                <button
                  onClick={handleRemoveMember}
                  disabled={removing}
                  className="flex-1 py-2.5 rounded-btn bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-600 text-bone-50 text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {removing ? '...' : 'Pašalinti'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )

  if (useDesktopPanel) return createPortal(tree, host.container)
  return tree
}
