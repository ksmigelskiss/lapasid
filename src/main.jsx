import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import BrandLoader from './components/brand/BrandLoader.jsx'

const PlantPassportPage = lazy(() => import('./pages/PlantPassportPage.jsx'))
const LoaderPlayground = lazy(() => import('./dev/LoaderPlayground.jsx'))
const LoginScreenDemo = lazy(() => import('./dev/LoginScreenDemo.jsx'))

// Augalo paso URL: /p/{plantId} → PlantPassportPage (be pilno app)
const passportMatch = window.location.pathname.match(/^\/p\/([^/]+)\/?$/)

// Dev playground: tik mock'inime režime (`VITE_USE_MOCK_USER=true`) + ?playground=loaders|login.
// Lazy chunk'as — neateina į produkcijos bundle'ą be šio flag'o.
const isMock = import.meta.env.VITE_USE_MOCK_USER === 'true'
const playgroundType = isMock ? new URLSearchParams(window.location.search).get('playground') : null

const devFallback = (
  <div className="fixed inset-0 bg-bone flex items-center justify-center">
    <BrandLoader />
  </div>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {playgroundType === 'loaders' ? (
      <Suspense fallback={devFallback}><LoaderPlayground /></Suspense>
    ) : playgroundType === 'login' ? (
      <Suspense fallback={devFallback}><LoginScreenDemo /></Suspense>
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
