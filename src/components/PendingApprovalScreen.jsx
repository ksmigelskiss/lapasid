import { signOut } from 'firebase/auth'
import { auth } from '../utils/firebase'
import Mascot from './brand/Mascot'

/**
 * PendingApprovalScreen — rodoma naujam vartotojui po sign-in, kuris dar
 * nepatvirtintas admin'o. Real-time onSnapshot ant users/{uid} (žiūr.
 * useAuth.js) automatiškai uždarys ekraną kai admin'as flip'ins approved=true.
 *
 * UX: friendly „welcome" jausmas, ne klaidos ekranas. Mascot wave + paaiškinimas.
 */
export default function PendingApprovalScreen({ user }) {
  return (
    <div className="min-h-screen bg-app flex items-center justify-center px-6 py-12">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="flex justify-center">
          <Mascot type="gardener" state="wave" size={120} />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold text-forest-700 leading-tight">
            Sveiki!
          </h1>
          <p className="text-forest-600 text-[15px] leading-relaxed">
            Tavo registracija pateikta. Šiuo metu LapasID prieiga ribota — laukiame
            admin'o patvirtinimo.
          </p>
        </div>

        {user?.email && (
          <div className="inline-flex items-center gap-2 bg-bone-50 rounded-full px-4 py-2 border border-bone-400/40">
            <span className="font-mono text-[11px] text-forest-500">{user.email}</span>
          </div>
        )}

        <div className="bg-bone-50 rounded-2xl px-5 py-4 border border-bone-400/40 text-left space-y-2">
          <p className="text-[12px] font-mono uppercase tracking-[0.16em] text-forest-500">
            Kas toliau?
          </p>
          <p className="text-[13px] text-forest-700 leading-relaxed">
            Šis ekranas automatiškai užsidarys, kai gausi prieigą. Jei skubu —
            susisiek su admin'u: <a href="mailto:kestutis@okone.lt" className="underline text-forest-500">kestutis@okone.lt</a>
          </p>
        </div>

        <button
          onClick={() => signOut(auth)}
          className="text-[13px] text-forest-500 hover:text-forest-700 underline transition-colors"
        >
          Atsijungti
        </button>
      </div>
    </div>
  )
}
