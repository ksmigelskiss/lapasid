import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { UserPlus } from 'lucide-react'
import { db } from '../../utils/firebase'
import QuickApproveSheet from './QuickApproveSheet'

/**
 * AdminPendingBadge — top-bar badge admin'ui kai yra pending user'ių.
 * Real-time onSnapshot ant users where approved == false.
 *
 * UX: terracotta accent (atskirt nuo žaliųjų care badge'ų), rodo skaičių,
 * tap → atidaro QuickApproveSheet bottom-sheet'ą su quick approve/reject.
 * Tinka mobile + desktop (one-tap workflow).
 */
export default function AdminPendingBadge({ isAdmin }) {
  const [pendingUsers, setPendingUsers] = useState([])
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    const q = query(collection(db, 'users'), where('approved', '==', false))
    const unsub = onSnapshot(q,
      snap => setPendingUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() }))),
      e => console.warn('[admin-pending] snapshot error:', e)
    )
    return unsub
  }, [isAdmin])

  if (!isAdmin || pendingUsers.length === 0) return null

  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        className="inline-flex items-center gap-1.5 bg-terracotta-50 border border-terracotta-300/50 rounded-full px-3 h-[34px] hover:bg-terracotta-100 transition-colors"
        title={`${pendingUsers.length} laukia patvirtinimo`}
      >
        <UserPlus size={14} className="text-terracotta" />
        <span className="font-mono text-[11px] font-semibold tabular-nums text-terracotta-600">
          {pendingUsers.length}
        </span>
      </button>

      {sheetOpen && (
        <QuickApproveSheet
          pendingUsers={pendingUsers}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  )
}
