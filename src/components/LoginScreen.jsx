import { useState } from 'react'
import { motion } from 'framer-motion'
import T4Mark from './brand/T4Mark'
import T4Word from './brand/T4Word'
import BrandLoader from './brand/BrandLoader'

// Brandbook v1.0 AuthLogin pattern: glass kortelė ant bone canvas, T4 header,
// du stacked INK CTA — Google + Facebook (LT auditorijai abu svarbūs).
// Loading metu T4Mark viršuje pavirsta į BarsBuild loaderį (barcode identifikacijos metafora).
export default function LoginScreen({ onSignInGoogle, onSignInFacebook, loading = false, error = null }) {
  const [pending, setPending] = useState(null) // 'google' | 'facebook' | null

  const urlParams   = new URLSearchParams(window.location.search)
  const inviteToken = urlParams.get('invite')
  const inviteRole  = urlParams.get('role')
  const isMember    = !!(inviteToken && inviteRole !== 'viewer')

  const handleSignIn = async (provider, fn) => {
    setPending(provider)
    try { await fn() } finally { setPending(null) }
  }

  const isLoading = loading || pending !== null

  return (
    <div className="fixed inset-0 bg-bone flex items-center justify-center px-6">
      <motion.div
        className="w-full max-w-[340px] bg-bone-50 border border-bone-400/50 rounded-2xl px-7 py-8 flex flex-col gap-6 shadow-[0_4px_24px_rgba(28,58,42,0.06)]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Header: T4Mark → BarsBuild loader kai jungiamasi (barcode = identifikacijos metafora) */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center" style={{ width: 64, height: 64 }}>
            {isLoading
              ? <BrandLoader inline ink="forest" size={64} duration={2.4} />
              : <T4Mark size={64} />
            }
          </div>
          <div className="flex flex-col items-center gap-1">
            <T4Word size={26} className="text-forest-700" />
            <p className="font-display text-[13px] text-forest-500">
              {isLoading
                ? 'Identifikuojama...'
                : isMember ? 'Prisijunk prie kolekcijos' : 'Tavo augalų kolekcija'}
            </p>
          </div>
        </div>

        {/* Stacked CTA — Google + Facebook, abu forest INK lygūs */}
        <div className="flex flex-col gap-2.5">
          <ProviderButton
            label="Tęsti su Google"
            icon={<GoogleIcon />}
            onClick={() => handleSignIn('google', onSignInGoogle)}
            isPending={pending === 'google'}
            isDisabled={isLoading}
          />
          <ProviderButton
            label="Tęsti su Facebook"
            icon={<FacebookIcon />}
            onClick={() => handleSignIn('facebook', onSignInFacebook)}
            isPending={pending === 'facebook'}
            isDisabled={isLoading}
          />
        </div>

        {/* Error callout */}
        {error && !isLoading && (
          <div className="bg-bone-50 border-2 border-terracotta/50 rounded-xl px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta-600">Klaida</p>
            <p className="text-xs text-terracotta-600 mt-1 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Privacy footer — mono caps */}
        <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-forest-400 text-center leading-relaxed">
          Tavo duomenys saugomi tik tavo paskyroje
        </p>
      </motion.div>
    </div>
  )
}

function ProviderButton({ label, icon, onClick, isPending, isDisabled }) {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className="h-12 w-full bg-forest-700 hover:bg-forest-800 disabled:opacity-70 disabled:cursor-not-allowed transition-colors rounded-btn flex items-center justify-center gap-3 text-bone font-display font-semibold text-sm tracking-tight"
    >
      {isPending ? (
        <span>Jungiamasi...</span>
      ) : (
        <>
          {icon}
          <span>{label}</span>
        </>
      )}
    </button>
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

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M18 9c0-4.97-4.03-9-9-9s-9 4.03-9 9c0 4.49 3.29 8.21 7.59 8.89v-6.29H5.30V9H7.59V7.01c0-2.26 1.35-3.51 3.41-3.51.99 0 2.02.18 2.02.18v2.22h-1.14c-1.12 0-1.47.7-1.47 1.41V9h2.50l-0.40 2.60h-2.10v6.29C14.71 17.21 18 13.49 18 9z"
        fill="#1877F2"
      />
    </svg>
  )
}
