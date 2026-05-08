import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, LogOut, UserPlus, Copy, Check, Share2 } from 'lucide-react'
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../utils/firebase'

// Sukuria invite tokeną Firestore'e, grąžina URL
async function generateInviteLink(collectionId, uid) {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  const token = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    .slice(0, 12)
  await setDoc(doc(db, 'invites', token), {
    colId:     collectionId,
    createdBy: uid,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    used:      false,
  })
  return `${window.location.origin}?invite=${token}`
}

// Nuskaito kolekcijos narius (be einamojo vartotojo)
async function loadMembers(collectionId, currentUid) {
  const colSnap = await getDoc(doc(db, 'collections', collectionId))
  if (!colSnap.exists()) return []
  const uids = (colSnap.data().members ?? []).filter(id => id !== currentUid)
  if (!uids.length) return []

  return Promise.all(uids.map(async uid => {
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      if (snap.exists()) {
        const { displayName, email } = snap.data()
        return { uid, displayName: displayName || email?.split('@')[0] || 'Vartotojas', email: email || '' }
      }
    } catch {}
    return { uid, displayName: 'Vartotojas', email: '' }
  }))
}

// Inicialės iš vardo arba el. pašto
function initials(str) {
  return (str || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// Prideda vartotoją prie kolekcijos narių pagal tokeną
export async function acceptInvite(uid, token, inviteData, userProfile = {}) {
  const { colId, used, expiresAt } = inviteData
  if (used || new Date(expiresAt) < new Date()) return null

  await updateDoc(doc(db, 'collections', colId), { members: arrayUnion(uid) })

  await setDoc(doc(db, 'users', uid), {
    primaryCollection: colId,
    collections:       [colId],
    displayName:       userProfile.displayName || '',
    email:             userProfile.email || '',
    updatedAt:         new Date().toISOString(),
  }, { merge: true })

  await updateDoc(doc(db, 'invites', token), { used: true, usedBy: uid })

  return colId
}

export default function ProfileSheet({ user, collectionId, onSignOut, onClose }) {
  const [inviteUrl, setInviteUrl]   = useState(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied]         = useState(false)
  const [members, setMembers]       = useState([])

  // Krauname bendrininkus
  useEffect(() => {
    if (!collectionId || !user?.uid) return
    loadMembers(collectionId, user.uid).then(setMembers).catch(() => {})
  }, [collectionId, user?.uid])

  const handleInvite = async () => {
    setGenerating(true)
    try {
      const url = await generateInviteLink(collectionId, user.uid)
      setInviteUrl(url)
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Augalų kolekcija', text: 'Prisijunk prie mano augalų kolekcijos 🌿', url })
        } catch (e) {
          if (e.name !== 'AbortError') console.error(e)
        }
      }
    } catch (e) {
      console.error('generateInviteLink failed:', e)
    }
    setGenerating(false)
  }

  const copyLink = async () => {
    if (!inviteUrl) return
    try { await navigator.clipboard.writeText(inviteUrl) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/40 z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl max-w-[430px] mx-auto"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="px-5 pt-5 pb-8 safe-bottom">
          {/* Handle */}
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

          {/* Einamasis vartotojas */}
          <div className="flex items-center gap-3 mb-5">
            {user?.photoURL
              ? <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full object-cover" />
              : <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center text-sage-600 font-bold text-base">
                  {initials(user?.displayName || user?.email)}
                </div>
            }
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{user?.displayName || 'Vartotojas'}</p>
              <p className="text-sm text-gray-400 truncate">{user?.email}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface">
              <X size={16} className="text-gray-400" />
            </button>
          </div>

          {/* Bendrininkai */}
          {members.length > 0 && (
            <div className="bg-surface rounded-2xl px-4 py-3.5 mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Dalijamasi su</p>
              <div className="space-y-2.5">
                {members.map(m => (
                  <div key={m.uid} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-sage-600 text-xs font-bold flex-shrink-0">
                      {initials(m.displayName || m.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.displayName}</p>
                      {m.email && <p className="text-xs text-gray-400 truncate">{m.email}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kvietimas */}
          <div className="bg-surface rounded-2xl p-4 mb-3">
            <p className="text-sm font-semibold text-gray-800 mb-0.5">Pakviesti į kolekciją</p>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              Sugeneruok nuorodą — kas ją atidaro, matys tuos pačius augalus
            </p>

            {!inviteUrl ? (
              <button
                onClick={handleInvite}
                disabled={generating}
                className="w-full py-2.5 rounded-xl bg-sage-500 active:bg-sage-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                <UserPlus size={15} />
                {generating ? 'Generuojama...' : 'Generuoti nuorodą'}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 bg-white border border-gray-200 rounded-xl px-3 py-2 truncate">{inviteUrl}</p>
                <div className="flex gap-2">
                  <button
                    onClick={copyLink}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 font-medium flex items-center justify-center gap-1.5 active:bg-surface transition-colors"
                  >
                    {copied ? <Check size={14} className="text-sage-500" /> : <Copy size={14} />}
                    {copied ? 'Nukopijuota' : 'Kopijuoti'}
                  </button>
                  {typeof navigator.share === 'function' && (
                    <button
                      onClick={handleInvite}
                      className="flex-1 py-2.5 rounded-xl bg-sage-500 active:bg-sage-600 text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Share2 size={14} />
                      Dalintis
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Atsijungimas */}
          <button
            onClick={onSignOut}
            className="w-full py-3 rounded-2xl text-red-500 text-sm font-medium flex items-center justify-center gap-2 border border-red-100 bg-red-50 active:bg-red-100 transition-colors"
          >
            <LogOut size={15} />
            Atsijungti
          </button>
        </div>
      </motion.div>
    </>
  )
}
