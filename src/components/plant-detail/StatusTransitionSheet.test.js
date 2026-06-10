import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { sheetDaysBetween, computeRecoverySummary } from './StatusTransitionSheet'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('sheetDaysBetween', () => {
  it('skirtumas dienomis (a − b)', () => {
    expect(sheetDaysBetween('2026-06-10', '2026-06-01')).toBe(9)
    expect(sheetDaysBetween('2026-06-01', '2026-06-10')).toBe(-9)
    expect(sheetDaysBetween('2026-06-10', '2026-06-10')).toBe(0)
  })
})

describe('computeRecoverySummary — „pasveiko" santrauka', () => {
  it('randa ligos pradžią + gydymo eventus per ligos laikotarpį', () => {
    vi.setSystemTime(new Date('2026-06-10T12:00:00Z'))
    // Timeline — naujausi viršuje (kaip app'e)
    const timeline = [
      { type: 'treatment', date: '2026-06-08', preparatas: 'Fungicidas', tikslas: 'amaras' },
      { type: 'watering', date: '2026-06-05' },
      { type: 'statusChange', toStatus: 'sick', date: '2026-06-01', disease: 'amaras' },
      { type: 'treatment', date: '2026-05-20', preparatas: 'Senas purškimas' }, // PRIEŠ ligą
    ]
    const s = computeRecoverySummary(timeline, 'sick')
    expect(s.days).toBe(9)
    expect(s.treatments).toHaveLength(1) // tik gydymas PO ligos pradžios
    expect(s.treatments[0].preparatas).toBe('Fungicidas')
    expect(s.startEvent.disease).toBe('amaras')
  })

  it('be statusChange įrašo → null (nėra ko apibendrinti)', () => {
    expect(computeRecoverySummary([{ type: 'watering', date: '2026-06-01' }], 'sick')).toBeNull()
    expect(computeRecoverySummary([], 'sick')).toBeNull()
  })
})
