import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './assets/mascot/mascot.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import BrandLoader from './components/brand/BrandLoader.jsx'

const PlantPassportPage = lazy(() => import('./pages/PlantPassportPage.jsx'))
const LoaderPlayground = lazy(() => import('./dev/LoaderPlayground.jsx'))
const LoginScreenDemo = lazy(() => import('./dev/LoginScreenDemo.jsx'))
const PlantExport = lazy(() => import('./dev/PlantExport.jsx'))
const ThemeStudio = lazy(() => import('./dev/ThemeStudio.jsx'))
const MascotPlayground = lazy(() => import('./dev/MascotPlayground.jsx'))

// Augalo paso URL: /p/{plantId} → PlantPassportPage (be pilno app)
const passportMatch = window.location.pathname.match(/^\/p\/([^/]+)\/?$/)

// Dev playground: tik mock'inime režime (`VITE_USE_MOCK_USER=true`) + ?playground=loaders|login.
// Lazy chunk'as — neateina į produkcijos bundle'ą be šio flag'o.
//
// Exception: `mascot` playground'as accessible visada (pure SVG/CSS preview'as,
// be Firestore/auth touch'o) — kad galėtum žiūrėti production'e prieš shipping.
const isMock = import.meta.env.VITE_USE_MOCK_USER === 'true'
const rawPlayground = new URLSearchParams(window.location.search).get('playground')
const playgroundType = (isMock || rawPlayground === 'mascot') ? rawPlayground : null

// PlantExport — veikia BE mock mode'o (reikia tikros auth + Firestore access).
// Pasiekiama per ?export=plants kai vartotojas prisijungęs prie lapasid.lt.
const exportMode = new URLSearchParams(window.location.search).get('export') === 'plants'

const devFallback = (
  <div className="fixed inset-0 bg-bone flex items-center justify-center">
    <BrandLoader />
  </div>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {exportMode ? (
      <Suspense fallback={devFallback}><PlantExport /></Suspense>
    ) : playgroundType === 'loaders' ? (
      <Suspense fallback={devFallback}><LoaderPlayground /></Suspense>
    ) : playgroundType === 'login' ? (
      <Suspense fallback={devFallback}><LoginScreenDemo /></Suspense>
    ) : playgroundType === 'theme' ? (
      <Suspense fallback={devFallback}><ThemeStudio /></Suspense>
    ) : playgroundType === 'mascot' ? (
      <Suspense fallback={devFallback}><MascotPlayground /></Suspense>
    ) : passportMatch ? (
      <Suspense fallback={devFallback}>
        <PlantPassportPage plantId={passportMatch[1]} />
      </Suspense>
    ) : (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    )}
  </StrictMode>,
)
