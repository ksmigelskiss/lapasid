import { adminDb } from './_admin.js'

export default async function handler(req, res) {
  const token = req.query.token
  if (!token) return res.status(400).json({ error: 'missing_token' })

  let step = 'init'
  try {
    step = 'adminDb'
    const db = adminDb()

    step = 'readInvite'
    const invSnap = await db.collection('invites').doc(token).get()
    if (!invSnap.exists) return res.status(403).json({ error: 'invalid_token' })
    const inv = invSnap.data()
    if (inv.active === false) return res.status(403).json({ error: 'revoked' })
    if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) return res.status(403).json({ error: 'expired' })
    const { colId } = inv

    step = 'readCollection'
    const [colSnap, plantsSnap] = await Promise.all([
      db.collection('collections').doc(colId).get(),
      db.collection('collections').doc(colId).collection('plants').get(),
    ])
    if (!colSnap.exists) return res.status(404).json({ error: 'not_found' })
    const col = colSnap.data()

    // Subkolekcija pirmenybė; fallback į senas col.plants[] jei subkolekcija tuščia
    const subPlants = plantsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const plants = subPlants.length > 0 ? subPlants : (col.plants ?? [])

    return res.json({ colId, collectionName: col.name || 'Kolekcija', plants, zones: col.zones || [] })
  } catch (e) {
    console.error('[viewer] step=%s error=%s', step, e.message)
    return res.status(500).json({
      error: 'server_error',
      step,
      message: e.message,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    })
  }
}
