import { adminDb } from '../_admin.js'

const ALLOWED_TYPES = ['watering', 'fertilizing']
const MAX_EVENTS    = 5
const MAX_KOMMENTARAS = 100

/**
 * Combined NFC pass care endpoint — vienoje užklausoje galima įrašyti
 * kelis event'us (typiškai: fertilize + watering po jo). Sumažina Vercel
 * function invocations 2x kombinuotame "Tręšti → Palaisčiau" flow.
 *
 * Body: { plantId: string, events: [{ type, komentaras? }, ...] }
 *
 * Atomiškas single Firestore write: visi event'ai pridedami į timeline
 * kaip vienas update, plus snapshot.lastWatered / lastFertilized atnaujinami
 * pagal eventų tipus.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { plantId, events } = req.body ?? {}
  if (!plantId) return res.status(400).json({ error: 'missing_params' })
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS) {
    return res.status(400).json({ error: 'invalid_events' })
  }
  for (const e of events) {
    if (!e || !ALLOWED_TYPES.includes(e.type)) {
      return res.status(400).json({ error: 'invalid_type' })
    }
  }

  try {
    const db = adminDb()

    const passportSnap = await db.collection('plant-passports').doc(plantId).get()
    if (!passportSnap.exists) return res.status(404).json({ error: 'not_found' })
    if (!passportSnap.data().isPublic) return res.status(403).json({ error: 'private' })

    const { collectionId } = passportSnap.data()
    const plantRef = db
      .collection('collections').doc(collectionId)
      .collection('plants').doc(plantId)

    const plantSnap = await plantRef.get()
    if (!plantSnap.exists) return res.status(404).json({ error: 'plant_not_found' })

    const today = new Date().toISOString().split('T')[0]
    const baseTs = Date.now()
    const builtEvents = events.map((e, i) => ({
      id:         `${e.type === 'watering' ? 'w' : 'f'}_${baseTs}_${i}`,
      type:       e.type,
      date:       today,
      komentaras: (typeof e.komentaras === 'string' ? e.komentaras : '').slice(0, MAX_KOMMENTARAS),
      source:     'nfc',
    }))

    // Atomiškas timeline update (visi event'ai vienu kartu, naujausi viršuje)
    await plantRef.update({ timeline: [...builtEvents, ...(plantSnap.data().timeline ?? [])] })

    // Snapshot atnaujinimai pagal eventų tipus
    const snapshotUpdates = {}
    if (events.some(e => e.type === 'watering'))    snapshotUpdates['snapshot.lastWatered']    = today
    if (events.some(e => e.type === 'fertilizing')) snapshotUpdates['snapshot.lastFertilized'] = today
    if (Object.keys(snapshotUpdates).length > 0) {
      await db.collection('plant-passports').doc(plantId).update(snapshotUpdates).catch(() => {})
    }

    return res.json({ ok: true, events: builtEvents })
  } catch (e) {
    console.error('[passport/care]', e)
    return res.status(500).json({ error: 'server_error' })
  }
}
