import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getWateringForecast, shouldShowWateringAlert } from './wateringForecast'

// Laikas fiksuotas UTC vidurdieniu — getSeason/toISOString sutampa visose TZ.
const SUMMER = new Date('2026-06-10T12:00:00Z')
const WINTER = new Date('2026-01-10T12:00:00Z')

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('kategorijų defaults (be istorijos, be AI intervalo)', () => {
  it('sultingas: vasara 18d', () => {
    vi.setSystemTime(SUMMER)
    const r = getWateringForecast({ tipas: 'Sultingas', data_prideta: '2026-06-01' })
    expect(r.category).toBe('sultingas')
    expect(r.intervalDays).toBe(18)
    expect(r.nextDate).toBe('2026-06-19')
    expect(r.daysUntil).toBe(9)
    expect(r.isOverdue).toBe(false)
  })

  it('pusiau sultingas NĖRA sultingas (žodžio spąstas)', () => {
    vi.setSystemTime(SUMMER)
    const r = getWateringForecast({ tipas: 'Pusiau sultingas', data_prideta: '2026-06-01' })
    expect(r.category).toBe('vidutinis')
  })

  it('papartis: vasara 5d; greitas augimas: 7d; default vidutinis: 10d', () => {
    vi.setSystemTime(SUMMER)
    expect(getWateringForecast({ tipas: 'Papartis', data_prideta: '2026-06-01' }).intervalDays).toBe(5)
    expect(getWateringForecast({ augimo_greitis: 'Greitas', data_prideta: '2026-06-01' }).intervalDays).toBe(7)
    expect(getWateringForecast({ data_prideta: '2026-06-01' }).intervalDays).toBe(10)
  })
})

describe('AI specifinis intervalas', () => {
  it('turi pirmenybę prieš kategorijos default', () => {
    vi.setSystemTime(SUMMER)
    const r = getWateringForecast({ laistymasIntervalas: { vasara: 7, ziema: 14 }, data_prideta: '2026-06-01' })
    expect(r.intervalDays).toBe(7)
  })

  it('ziema=null → žiemą nelaistom (skipSeason)', () => {
    vi.setSystemTime(WINTER)
    const r = getWateringForecast({ laistymasIntervalas: { vasara: 7, ziema: null }, data_prideta: '2026-01-01' })
    expect(r.skipSeason).toBe(true)
    expect(r.intervalDays).toBeNull()
    expect(r.isOverdue).toBe(false)
  })
})

describe('istorijos blend (weighted pagal confidence)', () => {
  it('2 to paties sezono gap\'ai → confidence 2/3', () => {
    vi.setSystemTime(SUMMER)
    const r = getWateringForecast({
      timeline: [
        { type: 'watering', date: '2026-06-08' },
        { type: 'watering', date: '2026-06-02' },
        { type: 'watering', date: '2026-05-27' },
      ],
    })
    // gaps [6,6], avg 6, conf 2/3 → round(6·⅔ + 10·⅓) = 7
    expect(r.historicalAvg).toBe(6)
    expect(r.intervalDays).toBe(7)
    expect(r.lastDate).toBe('2026-06-08')
  })

  it('outlier gap (>3× teorinio) atmetamas — atostogos negadina vidurkio', () => {
    vi.setSystemTime(SUMMER)
    const r = getWateringForecast({
      timeline: [
        { type: 'watering', date: '2026-06-08' },
        { type: 'watering', date: '2026-06-02' }, // gap 6
        { type: 'watering', date: '2026-04-23' }, // gap 40 > 30 → out
      ],
    })
    expect(r.validGapsCount).toBe(1)
    // conf 1/3 → round(6·⅓ + 10·⅔) = 9
    expect(r.intervalDays).toBe(9)
  })

  it('kirtęs sezoną gap\'as nesiskaito', () => {
    vi.setSystemTime(SUMMER)
    const r = getWateringForecast({
      timeline: [
        { type: 'watering', date: '2026-04-03' },
        { type: 'watering', date: '2026-03-28' }, // žiema → gap atmestas
      ],
    })
    expect(r.validGapsCount).toBe(0)
    expect(r.intervalDays).toBe(10) // grynas teorinis
  })
})

describe('snooze per inspection', () => {
  it('inspection naujesnis už laistymą → overdue tildomas ceil(interval/3) dienų', () => {
    vi.setSystemTime(SUMMER)
    const r = getWateringForecast({
      timeline: [
        { type: 'inspection', date: '2026-06-08' },
        { type: 'watering', date: '2026-05-25' },
      ],
    })
    // be snooze: next 2026-06-04, daysUntil -6 → overdue
    expect(r.daysUntil).toBe(-6)
    expect(r.isSnoozed).toBe(true)
    expect(r.snoozedUntil).toBe('2026-06-12') // 06-08 + ceil(10/3)=4
    expect(r.isOverdue).toBe(false) // snooze nuslopino
  })
})

describe('shouldShowWateringAlert', () => {
  it('be nė vieno laistymo įrašo → false (net jei "pradelsta")', () => {
    vi.setSystemTime(SUMMER)
    expect(shouldShowWateringAlert({ data_prideta: '2026-01-01' })).toBe(false)
  })

  it('pradelsta >3× intervalo → false (duomenys per seni, kad pasitikėtume)', () => {
    vi.setSystemTime(SUMMER)
    expect(shouldShowWateringAlert({
      timeline: [{ type: 'watering', date: '2026-01-01' }],
    })).toBe(false)
  })

  it('šviežiai pradelsta su laistymo istorija → true', () => {
    vi.setSystemTime(SUMMER)
    expect(shouldShowWateringAlert({
      timeline: [{ type: 'watering', date: '2026-05-25' }],
    })).toBe(true)
  })
})
