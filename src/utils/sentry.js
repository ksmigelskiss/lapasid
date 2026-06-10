// Sentry — prod klaidų matomumas (deploy be staging → tai vienintelis signalas,
// kad kažkas sulūžo, kol vartotojas dar nepasiskundė).
//
// ENV-GATED: be VITE_SENTRY_DSN viskas no-op, o pats SDK kraunamas per dynamic
// import — main bundle nepriauga, kol DSN nesukonfigūruotas (Vercel env).
// init() automatiškai hook'ina window.onerror + unhandledrejection.

const dsn = import.meta.env.VITE_SENTRY_DSN

let sentry = null // užkrautas modulis (kai DSN yra)

export function initSentry() {
  if (!dsn) return
  import('@sentry/react')
    .then(Sentry => {
      Sentry.init({
        dsn,
        release: __APP_COMMIT__,
        environment: import.meta.env.PROD ? 'production' : 'development',
        // Tik klaidos, be performance tracing — kvotai ir privatumui.
        tracesSampleRate: 0,
      })
      sentry = Sentry
    })
    .catch(() => {}) // Sentry nepasikrovė (offline/adblock) — app'as gyvena toliau
}

// Rankinis pranešimas iš catch'ų (pvz. ErrorBoundary). Iki SDK užsikrovimo — no-op.
export function reportError(error, context) {
  if (!sentry) return
  sentry.captureException(error, context ? { extra: context } : undefined)
}
