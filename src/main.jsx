import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

const PlantPassportPage = lazy(() => import('./pages/PlantPassportPage.jsx'))

// Augalo paso URL: /p/{plantId} → PlantPassportPage (be pilno app)
const passportMatch = window.location.pathname.match(/^\/p\/([^/]+)\/?$/)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {passportMatch ? (
      <Suspense fallback={
        <div className="fixed inset-0 bg-white flex items-center justify-center">
          <img src="/plant_pot.png" className="w-16 h-16 object-contain animate-spin" alt="" />
        </div>
      }>
        <PlantPassportPage plantId={passportMatch[1]} />
      </Suspense>
    ) : (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    )}
  </StrictMode>,
)
