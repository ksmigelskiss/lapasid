import { adminDb } from '../_admin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { token, plantId, event } = req.body
  if (!token || !plantId) return res.status(400).json({ error: 'missing_params' })
  try {
    const db = adminDb()
    const invSnap = await db.collection('invites').doc(token).get()
    if (!invSnap.exists) return res.status(403).json({ error: 'invalid_token' })
    const inv = invSnap.data()
    if (inv.active === false) return res.status(403).json({ error: 'revoked' })
    const { colId } = inv
    const plantRef = db.collection('collections').doc(colId).collection('plants').doc(plantId)
    const plantSnap = await plantRef.get()
    if (!plantSnap.exists) return res.status(404).json({ error: 'plant_not_found' })
    const wateringEvent = event ?? { id: `w_${Date.now()}`, type: 'watering', date: new Date().toISOString().split('T')[0], komentaras: '' }
    await plantRef.update({ timeline: [wateringEvent, ...(plantSnap.data().timeline ?? [])] })
    return res.json({ ok: true, event: wateringEvent })
  } catch (e) {
    console.error('[viewer/water]', e)
    return res.status(500).json({ error: 'server_error' })
  }
}
