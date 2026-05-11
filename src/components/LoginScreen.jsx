import { useState } from 'react'
import { motion } from 'framer-motion'
import T4Mark from './brand/T4Mark'
import T4Word from './brand/T4Word'

export default function LoginScreen({ onSignIn, loading = false, error = null }) {
  const [signingIn, setSigningIn] = useState(false)

  // Member invite — rodyti žinutę apie prisijungimą prie kolekcijos
  const urlParams   = new URLSearchParams(window.location.search)
  const inviteToken = urlParams.get('invite')
  const inviteRole  = urlParams.get('role')
  const isMember    = !!(inviteToken && inviteRole !== 'viewer')

  const handleSignIn = async () => {
    setSigningIn(true)
    try { await onSignIn() } finally { setSigningIn(false) }
  }

  return (
    <div className="fixed inset-0 bg-app flex flex-col items-center justify-center px-8">
      <motion.div
        className="flex flex-col items-center gap-6 w-full max-w-[320px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Logo — T4Mark + T4Word (Brandbook v1.0) */}
        <div className="flex flex-col items-center gap-3">
          <T4Mark size={88} />
          <div className="text-center">
            <T4Word size={28} className="text-forest-700" />
            {isMember
              ? <p className="text-sm text-gray-500 mt-2">Prisijunk prie kolekcijos</p>
              : <p className="text-sm text-gray-500 mt-2">Tavo augalų kolekcija</p>
            }
          </div>
        </div>

        {/* Google prisijungimas */}
        <button
          onClick={handleSignIn}
          disabled={loading || signingIn}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-2xl px-6 py-4 shadow-ios-card active:scale-95 transition-transform disabled:opacity-60"
        >
          {(loading || signingIn)
            ? <img src="/plant_pot.png" className="w-5 h-5 animate-spin" alt="" />
            : <GoogleIcon />
          }
          <span className="text-sm font-semibold text-gray-800">
            {(loading || signingIn) ? 'Jungiamasi...' : 'Prisijungti su Google'}
          </span>
        </button>

        {error && (
          <p className="text-xs text-red-500 text-center leading-relaxed bg-red-50 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <p className="text-xs text-gray-400 text-center leading-relaxed">
          Tavo duomenys saugomi tik tavo paskyroje
        </p>
      </motion.div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}
