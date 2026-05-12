// Dev tool — exportuoja realius vartotojo augalus iš Firestore kaip JSON,
// kad galėtume juos įdėti į mockData.js (TEST) sufiksais testavimui sandbox'e.
//
// Pasiekiama per /?export=plants kai vartotojas autentifikuotas (NE mock mode).
//
// Vienetinis use case — Faza 1 development tool, ne dalis production UX'o.

import { useState, useEffect } from 'react'
import { auth, db } from '../utils/firebase'
import { doc as fsDoc, getDoc as fsGetDoc, collection as fsCol, getDocs as fsGetDocs } from 'firebase/firestore'
import { onAuthStateChanged as onAuth } from 'firebase/auth'

export default function PlantExport() {
  const [user, setUser]       = useState(undefined)
  const [output, setOutput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied]   = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    return onAuth(auth, u => setUser(u))
  }, [])

  const exportPlants = async () => {
    setLoading(true); setError(null); setOutput(''); setCopied(false)
    try {
      if (!user) throw new Error('Nesi prisijungęs. Pirmiausia prisijunk per Google į lapasid.lt, tada vėl atidaryk šį puslapį.')

      const userSnap = await fsGetDoc(fsDoc(db, 'users', user.uid))
      const colId    = userSnap.data()?.primaryCollection
      if (!colId) throw new Error('Vartotojas neturi primaryCollection.')

      // Augalai saugomi DVIEM vietom (legacy migracija):
      //   1. collections/{cid}.plants[] array field
      //   2. collections/{cid}/plants/{id} subcollection
      // Sumerginam abu pagal id, subcollection laimi (naujesnis formatas).
      const [colSnap, subSnap] = await Promise.all([
        fsGetDoc(fsDoc(db, 'collections', colId)),
        fsGetDocs(fsCol(db, 'collections', colId, 'plants')),
      ])
      const legacyArr = colSnap.data()?.plants ?? []
      const subArr    = subSnap.docs.map(d => d.data())
      const byId = new Map()
      legacyArr.forEach(p => byId.set(p.id, p))   // legacy pirmiausia
      subArr.forEach(p => byId.set(p.id, p))      // subcollection override'ina
      const plants = [...byId.values()]

      if (plants.length === 0) {
        setOutput(`// Kolekcija (${colId}) tuščia — nei array field, nei subcollection neturi augalų.`)
        return
      }

      // (TEST) sufiksas Lt + Lot pavadinimuose, kad mock mode'e nesimaišytų su tikrais
      const tagged = plants.map(p => ({
        ...p,
        lietuviškas: (p.lietuviškas ?? '') + ' (TEST)',
        // Lotyniškas paliekam, kad iNaturalist photos vis tiek atsirastų
      }))

      const json = JSON.stringify(tagged, null, 2)
      setOutput(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setError('Negaliu kopijuoti į clipboard: ' + e.message)
    }
  }

  const downloadJson = () => {
    const blob = new Blob([output], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lapasid-plants-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-bone p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-forest-800">Plant Export → JSON</h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500 mt-1">DEV TOOL · tavo augalai → mock DB</p>
        </header>

        <div className="bg-bone-50 border border-bone-400/40 rounded-2xl p-5 space-y-3">
          <p className="text-sm text-forest-700">
            Šis įrankis ištraukia tavo realius augalus iš Firestore ir grąžina kaip JSON masyvą.
            Pavadinimuose pridedamas <code className="font-mono text-[12px] bg-bone-300/60 px-1.5 py-0.5 rounded">(TEST)</code> sufiksas, kad mock mode'e nesimaišytų su tikrais.
          </p>
          <p className="text-sm text-forest-600">
            <strong>Statusas:</strong>{' '}
            {user === undefined ? 'kraunama...'
              : user ? <span className="text-forest-700">prisijungęs kaip {user.email}</span>
              : <span className="text-terracotta-600">neprisijungęs — pirmiausia prisijunk per Google į lapasid.lt</span>}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={exportPlants}
            disabled={loading || !user}
            className="px-4 py-2.5 bg-forest-700 text-bone rounded-btn font-display font-semibold text-sm disabled:opacity-50"
          >
            {loading ? 'Eksportuojama...' : 'Eksportuoti augalus'}
          </button>
          {output && !error && (
            <>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2.5 bg-bone-50 border border-bone-400/50 text-forest-700 rounded-btn font-display font-semibold text-sm hover:bg-bone-300/40"
              >
                {copied ? '✓ Nukopijuota' : 'Kopijuoti į clipboard'}
              </button>
              <button
                onClick={downloadJson}
                className="px-4 py-2.5 bg-bone-50 border border-bone-400/50 text-forest-700 rounded-btn font-display font-semibold text-sm hover:bg-bone-300/40"
              >
                Atsisiųsti .json
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="bg-terracotta-50 border border-terracotta-200 rounded-xl p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta-600">Klaida</p>
            <p className="text-sm text-terracotta-600 mt-1">{error}</p>
          </div>
        )}

        {output && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500 mb-1.5">
              {output.startsWith('[') ? `${(JSON.parse(output) ?? []).length} augalai` : 'Output'}
            </p>
            <pre className="bg-bone-50 border border-bone-400/40 rounded-2xl p-4 text-[11px] font-mono text-forest-700 overflow-auto max-h-[60vh] whitespace-pre">
              {output}
            </pre>
          </div>
        )}

        <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-forest-400 text-center pt-4">
          paduok JSON Claude'ui — jis įdės su (TEST) į mockData.js
        </p>
      </div>
    </div>
  )
}
