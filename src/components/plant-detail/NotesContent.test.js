import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadNotes, mkNoteId, noteToday } from './NotesContent'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('loadNotes — legacy komentaras → uzrasai[] migracija', () => {
  it('uzrasai jau yra → grąžina kaip yra', () => {
    const uzrasai = [{ id: 'abc', text: 'Persodintas', starred: false, date: '2026-06-01' }]
    expect(loadNotes({ uzrasai })).toBe(uzrasai)
  })

  it('senas komentaras string → migruoja į notes per \\n\\n skirtuką', () => {
    vi.setSystemTime(new Date('2026-06-10T12:00:00Z'))
    const notes = loadNotes({ komentaras: 'Pirma pastaba\n\nAntra pastaba' })
    expect(notes).toHaveLength(2)
    expect(notes[0].text).toBe('Pirma pastaba')
    expect(notes[1].text).toBe('Antra pastaba')
    expect(notes[0].starred).toBe(false)
    expect(notes[0].date).toBe('2026-06-10')
    expect(notes[0].id).toMatch(/^[a-z0-9]+$/)
  })

  it('nei uzrasai, nei komentaras → []', () => {
    expect(loadNotes({})).toEqual([])
    expect(loadNotes({ komentaras: '   ' })).toEqual([])
  })
})

describe('note helpers', () => {
  it('mkNoteId — trumpas alfanumerinis id', () => {
    const id = mkNoteId()
    expect(id).toMatch(/^[a-z0-9]+$/)
    expect(id.length).toBeLessThanOrEqual(8)
  })

  it('noteToday — ISO data', () => {
    vi.setSystemTime(new Date('2026-06-10T12:00:00Z'))
    expect(noteToday()).toBe('2026-06-10')
  })
})
