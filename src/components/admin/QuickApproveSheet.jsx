import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { Check, X, Loader2 } from 'lucide-react'
import { db } from '../../utils/firebase'

/**
 * QuickApproveSheet — bottom sheet (mobile) / centered modal (desktop)
 * leidžiantis greitai patvirtinti arba atmesti pending user'ius.
 *
 * Approve: updateDoc users/{uid}.approved = true
 *   → user'io PendingApprovalScreen onSnapshot fire'ina → access granted
 *
 * Reject: deleteDoc users/{uid}
 *   → user'is iškarto matys "Sveiki!" sign-up flow'ą iš naujo jei vėl prisijungs
 *     (jo Firebase Auth account vis dar yra, bet users doc'o nebus → traktuojam
 *      kaip first sign-in → vėl pending). Phase B: pridėt rejection flag'ą,
 *      kad neleistų net pakartoti.
 */
export default function QuickApproveSheet({ pendingUsers, onClose }) {
  const [busyUid, setBusyUid] = useState(null)

  const approve = async (uid) => {
    setBusyUid(uid)
    try {
      await updateDoc(doc(db, 'users', uid), { approved: true, approvedAt: new Date().toISOString() })
    } catch (e) {
      console.error('[approve] failed:', e)
      alert('Nepavyko patvirtinti: ' + e.message)
    }
    setBusyUid(null)
  }

  const reject = async (uid, email) => {
    if (!window.confirm(`Atmesti ${email || uid}? Jo users doc'as bus ištrintas.`)) return
    setBusyUid(uid)
    try {
      await deleteDoc(doc(db, 'users', uid))
    } catch (e) {
      console.error('[reject] failed:', e)
      alert('Nepavyko atmesti: ' + e.message)
    }
    setBusyUid(null)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-forest-900/40 backdrop-blur-sm flex items-end lg:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="w-full max-w-[460px] bg-bone-50 rounded-t-4xl lg:rounded-3xl px-5 py-6 max-h-[80vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">Admin</p>
              <h2 className="font-display text-xl font-semibold text-forest-700">Laukia patvirtinimo</h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-bone-300/60 hover:bg-bone-400/60 text-forest-700 transition-colors"
              aria-label="Uždaryti"
            >
              <X size={16} />
            </button>
          </div>

          {/* List */}
          {pendingUsers.length === 0 ? (
            <p className="text-center text-forest-500 py-8 text-sm">Nieko nelaukia.</p>
          ) : (
            <ul className="space-y-2">
              {pendingUsers.map(u => (
                <li
                  key={u.uid}
                  className="bg-bone-100 border border-bone-400/40 rounded-2xl px-4 py-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-forest-700 text-[14px] truncate">
                      {u.displayName || u.email?.split('@')[0] || 'Vartotojas'}
                    </p>
                    <p className="font-mono text-[11px] text-forest-500 truncate">{u.email || u.uid.slice(0, 12)}</p>
                  </div>

                  <button
                    onClick={() => reject(u.uid, u.email)}
                    disabled={busyUid === u.uid}
                    className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-bone-50 border border-terracotta-300/40 hover:bg-terracotta-50 text-terracotta transition-colors disabled:opacity-40"
                    title="Atmesti"
                  >
                    {busyUid === u.uid ? <Loader2 size={14} className="animate-spin" /> : <X size={15} />}
                  </button>
                  <button
                    onClick={() => approve(u.uid)}
                    disabled={busyUid === u.uid}
                    className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-forest-500 hover:bg-forest-600 text-bone transition-colors disabled:opacity-40"
                    title="Patvirtinti"
                  >
                    {busyUid === u.uid ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
