import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import ToxCard from './ToxCard.jsx'
import HouseholdRiskSection from './HouseholdRiskSection.jsx'
import SunkumasZyma from './SunkumasZyma.jsx'

// Render smoke-testai — `vite build` NetikrinA React runtime'o, tad čia
// renderToString'u patvirtinam, kad komponentai nekrenta su realiais duomenimis
// (Monstera / Kalanchoe / Calathea / nežinoma gentis) ir rodo esminį turinį.
// Naudojam tik portal-free komponentus (ToxCardSheet su createPortal — ne čia).

const monstera = { lotyniskas: 'Monstera deliciosa', lietuviškas: 'Monstera' }
const kalanchoe = { lotyniskas: 'Kalanchoe blossfeldiana', lietuviškas: 'Kalankė' }
const calathea = { lotyniskas: 'Calathea orbifolia', lietuviškas: 'Kalatėja' }
const unknown = { lotyniskas: 'Lilium longiflorum', lietuviškas: 'Lelija' }

describe('ToxCard — render be klaidų', () => {
  it('toksiškas augalas (Kalanchoe) — rodo klasę, antidotą, disclaimer', () => {
    const html = renderToString(<ToxCard plant={kalanchoe} household={{ gyvunai: ['kate'] }} />)
    expect(html).toContain('Toksikologinė kortelė')
    expect(html).toContain('ne medicininė konsultacija')
    expect(html).toContain('DigiFab')
    expect(html).toMatch(/Nesukelkite vėmimo/)
  })

  it('saugi gentis (Calathea) — nerodo panikos, rodo „nelaikomas toksišku"', () => {
    const html = renderToString(<ToxCard plant={calathea} />)
    expect(html).toContain('nelaikomas toksišku')
  })

  it('nežinoma gentis (Lilium) — rodo „duomenų neturime", NE „saugu"', () => {
    const html = renderToString(<ToxCard plant={unknown} />)
    expect(html).toContain('duomenų neturime')
    expect(html).not.toContain('nelaikomas toksišku')
  })

  it('kontaktai turi TODO žymą nesukonfigūruotam numeriui', () => {
    const html = renderToString(<ToxCard plant={monstera} household={{ vaikai: true }} />)
    expect(html).toContain('112') // universalus faktas
    expect(html).toMatch(/nesukonfigūruotas|TODO/i)
  })
})

describe('HouseholdRiskSection — render be klaidų', () => {
  it('tuščias profilis → kvietimas nustatyti', () => {
    const html = renderToString(<HouseholdRiskSection plant={monstera} household={{}} />)
    expect(html).toContain('Nustatyk namų profilį')
  })

  it('katė + Kalanchoe → kritinė rekomendacija', () => {
    const html = renderToString(<HouseholdRiskSection plant={kalanchoe} household={{ gyvunai: ['kate'] }} />)
    expect(html).toContain('Namų rizika')
    expect(html).toMatch(/ne namuose|Geriau ne namuose/i)
  })
})

describe('SunkumasZyma — render', () => {
  it('null → „Nėra duomenų"', () => {
    expect(renderToString(<SunkumasZyma sunkumas={null} />)).toContain('Nėra duomenų')
  })
  it('mirtinas → „Mirtinas"', () => {
    expect(renderToString(<SunkumasZyma sunkumas="mirtinas" />)).toContain('Mirtinas')
  })
})
