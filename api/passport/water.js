import { adminDb } from '../_admin.js'

const ALLOWED_TYPES = ['watering', 'fertilizing']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { plantId, eventType = 'watering' } = req.body ?? {}
  if (!plantId) return res.status(400).json({ error: 'missing_params' })
  if (!ALLOWED_TYPES.includes(eventType)) return res.status(400).json({ error: 'invalid_type' })

  try {
    const db = adminDb()

    // Patikrina ar pasas egzistuoja ir yra viešas
    const passportSnap = await db.collection('plant-passports').doc(plantId).get()
    if (!passportSnap.exists) return res.status(404).json({ error: 'not_found' })
    if (!passportSnap.data().isPublic) return res.status(403).json({ error: 'private' })

    const { collectionId } = passportSnap.data()
    const plantRef = db
      .collection('collections').doc(collectionId)
      .collection('plants').doc(plantId)

    const plantSnap = await plantRef.get()
    if (!plantSnap.exists) return res.status(404).json({ error: 'plant_not_found' })

    const prefix = eventType === 'watering' ? 'w' : 'f'
    const event = {
      id:         `${prefix}_${Date.now()}`,
      type:       eventType,
      date:       new Date().toISOString().split('T')[0],
      komentaras: '',
      source:     'nfc',
    }

    await plantRef.update({ timeline: [event, ...(plantSnap.data().timeline ?? [])] })
    return res.json({ ok: true, event })
  } catch (e) {
    console.error('[passport/water]', e)
    return res.status(500).json({ error: 'server_error' })
  }
}
