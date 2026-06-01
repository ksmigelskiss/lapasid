// Shared Claude API utilities. Naudoja: SearchModal (naujų augalų paieška).
// Refresh/re-enrich path'as gyvena server-side (api/save-plant.js) ir
// trigger'inamas iš PlantDetail.reEnrichPlant.

import { auth } from './firebase'

// ── Claude API call ─────────────────────────────────────────

export async function claudeCall(body) {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null)
  const headers = { 'Content-Type': 'application/json' }
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (err.error === 'limit_reached') {
      const e = new Error('limit_reached')
      e.code = 'limit_reached'
      e.limitType = err.limitType
      throw e
    }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Hero drawing gen trigger (Phase A3) ────────────────────
// Fire-and-forget — po client-side Phase 2 catalog įrašymo (flag-off kelias)
// async paleidžia /api/generate-hero. Nelaukiam (gen ~30-60s); drawing
// atsiranda catalog'e vėliau. Idempotent server-side (skip jei jau turi hero).
// keepalive — kad request'as išgyventų page navigaciją. Display'as pasiima
// drawing'ą per live catalog subscription (subscribeCatalog) — jokio event'o
// dispatch'inti nereikia.
// NB: produkcijoj (VITE_USE_SERVERSIDE_SAVE) heroGen vyksta processPlant step 7
// (save-plant.js) PO catalog write — client trigger'is naudojamas tik flag-off.
export async function triggerHeroGen(latinName, { force = false } = {}) {
  try {
    const idToken = await auth.currentUser?.getIdToken().catch(() => null)
    if (!idToken || !latinName) return
    fetch('/api/generate-hero', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ latinName, force }),
      keepalive: true,
    }).catch(() => {})
  } catch { /* ignore — drawing nėra kritinis save flow'ui */ }
}

// 2026-06-01 — refreshPlantFromAI (client-side direct Claude call) pašalintas.
// Buvo broken F1 world'e (rezultatai rašomi į plant doc, bet catalog overlay'us
// per resolvePlantView perdengia). Single source of truth dabar — server-side
// /api/save-plant Phase 2 pipeline'as (kviečiamas iš PlantDetail reEnrichPlant
// per „Atnaujinti AI duomenis" ... menu). Server pipeline'as įjungia visus
// patobulinimus: deriveToxicityFromSourcesServer (Araceae override), Sonnet
// narrative gen, Gemini hero regen, catalog write su F1 auto-propagacija.
