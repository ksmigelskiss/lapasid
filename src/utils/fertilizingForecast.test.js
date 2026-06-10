import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getFertilizingForecast, getFertilizingSummary } from './fertilizingForecast'

const SUMMER = new Date('2026-06-10T12:00:00Z')
const WINTER = new Date('2026-01-10T12:00:00Z')

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('mėsėdžiai — NETRĘŠTI (saugumui kritiška: trąšos žaloja šaknis)', () => {
  it('per tipas lauką', () => {
    vi.setSystemTime(SUMMER)
    const s = getFertilizingSummary({ tipas: 'Mėsėdis augalas' })
    expect(s.category).toBe('mesedis')
    expect(s.vasaraDays).toBeNull()
    const f = getFertilizingForecast({ tipas: 'Mėsėdis augalas' })
    expect(f.skipSeason).toBe(true)
    expect(f.isOverdue).toBe(false)
  })

  it('per lotynišką gentį, kai AI tipas nepažymėjo (Nepenthes, Dionaea)', () => {
    vi.setSystemTime(SUMMER)
    expect(getFertilizingSummary({ lotyniskas: 'Nepenthes alata' }).category).toBe('mesedis')
    expect(getFertilizingSummary({ lotyniskas: 'Dionaea muscipula' }).category).toBe('mesedis')
  })
})

describe('kategorijų intervalai (vasara)', () => {
  it('orchidėja per lotynišką gentį → 21d', () => {
    vi.setSystemTime(SUMMER)
    const f = getFertilizingForecast({ lotyniskas: 'Phalaenopsis amabilis', data_prideta: '2026-06-01' })
    expect(f.category).toBe('orchideja')
    expect(f.intervalDays).toBe(21)
  })

  it('sultingas 45d, greitas 21d, vidutinis 28d', () => {
    vi.setSystemTime(SUMMER)
    expect(getFertilizingForecast({ tipas: 'Sultingas', data_prideta: '2026-06-01' }).intervalDays).toBe(45)
    expect(getFertilizingForecast({ augimo_greitis: 'Greitas', data_prideta: '2026-06-01' }).intervalDays).toBe(21)
    expect(getFertilizingForecast({ data_prideta: '2026-06-01' }).intervalDays).toBe(28)
  })
})

describe('žiema — visos kategorijos netręšiamos', () => {
  it('vidutinis žiemą → skipSeason', () => {
    vi.setSystemTime(WINTER)
    const f = getFertilizingForecast({ data_prideta: '2026-01-01' })
    expect(f.skipSeason).toBe(true)
    expect(f.intervalDays).toBeNull()
  })
})

describe('forecast skaičiavimas', () => {
  it('pradelstas tręšimas → isOverdue', () => {
    vi.setSystemTime(SUMMER)
    const f = getFertilizingForecast({
      timeline: [{ type: 'fertilizing', date: '2026-05-01' }],
    })
    expect(f.nextDate).toBe('2026-05-29')
    expect(f.daysUntil).toBe(-12)
    expect(f.isOverdue).toBe(true)
  })

  it('pavasarį bazė — sezono pradžia, ne pernykštis tręšimas (skipsWinter bump)', () => {
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z'))
    const f = getFertilizingForecast({
      timeline: [{ type: 'fertilizing', date: '2025-09-20' }],
    })
    expect(f.nextDate).toBe('2026-04-29') // 2026-04-01 + 28, NE 2025-09-20 + 28
    expect(f.isOverdue).toBe(false)
  })
})
