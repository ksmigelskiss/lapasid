import { describe, it, expect } from 'vitest'
import { getSeason, getSeasonStart, addDays, computeNextDate } from './forecastBase'

describe('getSeason', () => {
  it('balandis–rugsėjis = vasara', () => {
    expect(getSeason(new Date(2026, 3, 1))).toBe('vasara')   // Apr 1
    expect(getSeason(new Date(2026, 8, 30))).toBe('vasara')  // Sep 30
  })
  it('spalis–kovas = žiema', () => {
    expect(getSeason(new Date(2026, 2, 31))).toBe('žiema')   // Mar 31
    expect(getSeason(new Date(2026, 9, 1))).toBe('žiema')    // Oct 1
    expect(getSeason(new Date(2026, 0, 15))).toBe('žiema')   // Jan 15
  })
})

describe('getSeasonStart', () => {
  it('vasaros vidury → balandžio 1', () => {
    expect(getSeasonStart(new Date(2026, 4, 10))).toBe('2026-04-01')
  })
  it('rudenį → spalio 1', () => {
    expect(getSeasonStart(new Date(2026, 10, 1))).toBe('2026-10-01')
  })
  it('sausį → PRAĖJUSIŲ metų spalio 1 (žiema kerta metų ribą)', () => {
    expect(getSeasonStart(new Date(2026, 0, 15))).toBe('2025-10-01')
  })
})

describe('addDays', () => {
  it('prideda dienas per ISO string', () => {
    expect(addDays('2026-06-01', 10)).toBe('2026-06-11')
  })
  it('kerta mėnesio ribą', () => {
    expect(addDays('2026-06-25', 10)).toBe('2026-07-05')
  })
})

describe('computeNextDate', () => {
  const now = new Date('2026-06-05T12:00:00Z')

  it('bazinis: nextDate = lastDate + interval', () => {
    const r = computeNextDate({ lastDate: '2026-06-01', intervalDays: 10, now })
    expect(r.nextDate).toBe('2026-06-11')
    expect(r.daysUntil).toBe(6)
    expect(r.isOverdue).toBe(false)
  })

  it('pradelsta → neigiamas daysUntil + isOverdue', () => {
    const late = new Date('2026-06-15T12:00:00Z')
    const r = computeNextDate({ lastDate: '2026-06-01', intervalDays: 10, now: late })
    expect(r.daysUntil).toBe(-4)
    expect(r.isOverdue).toBe(true)
  })

  it('skipsWinter: lastDate prieš sezono pradžią → bazė tampa sezono pradžia', () => {
    const spring = new Date('2026-04-10T12:00:00Z')
    const r = computeNextDate({ lastDate: '2026-03-20', intervalDays: 10, skipsWinter: true, now: spring })
    expect(r.nextDate).toBe('2026-04-11') // 2026-04-01 + 10
    expect(r.isOverdue).toBe(false)
  })
})
