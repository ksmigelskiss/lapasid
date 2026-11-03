import { useState, useEffect } from 'react'
import { Baby, Cat, Dog, Bird, Rat, PawPrint, Info, Home } from 'lucide-react'
import {
  normalizeHousehold,
  GYVUNAI,
  VAIKU_AMZIUS,
  VAIKU_AMZIUS_META,
} from '../utils/toxinClasses'

// HouseholdProfileEditor — namų ūkio profilio redaktorius (ProfileSheet sekcija).
//
// GDPR-saugus (žr. tasks/konsiliumas-2026-06/45-liability-redteam.md §3.6):
// jokio tikslaus vaiko amžiaus / vardo / gimimo datos — tik boolean „yra vaikų"
// + neprivalomas apytikslis amžiaus intervalas (rizikos modifikatorius). Gyvūnai —
// tik rūšis. Duomenys saugomi kolekcijos `settings.household`, ne vartotojo tapatybėj.

const GYVUNO_META = {
  kate:      { label: 'Katė',      Icon: Cat },
  suo:       { label: 'Šuo',       Icon: Dog },
  paukstis:  { label: 'Paukštis',  Icon: Bird },
  grauzikas: { label: 'Graužikas', Icon: Rat },
}

export default function HouseholdProfileEditor({ household, onSave, readOnly = false }) {
  const [local, setLocal] = useState(() => normalizeHousehold(household))

  // Sinchronizuojam, jei išorinis household pasikeičia (kita kolekcija / realtime).
  useEffect(() => { setLocal(normalizeHousehold(household)) }, [household])

  const commit = (next) => {
    const normalized = normalizeHousehold(next)
    setLocal(normalized)
    if (!readOnly) onSave?.(normalized)
  }

  const toggleVaikai = () => {
    if (local.vaikai) commit({ ...local, vaikai: false, vaikuAmzius: null })
    else commit({ ...local, vaikai: true })
  }

  const setAmzius = (band) => {
    commit({ ...local, vaikuAmzius: local.vaikuAmzius === band ? null : band })
  }

  const toggleGyvunas = (g) => {
    const has = local.gyvunai.includes(g)
    const gyvunai = has ? local.gyvunai.filter(x => x !== g) : [...local.gyvunai, g]
    commit({ ...local, gyvunai })
  }

  const toggleKiti = () => commit({ ...local, kitiGyvunai: !local.kitiGyvunai })

  return (
    <div className="bg-bone-100 border border-bone-400/40 rounded-2xl p-4 mb-3">
      <div className="flex items-center gap-2 mb-1">
        <Home size={13} className="text-forest-500" />
        <p className="font-mono text-[10px] font-medium text-forest-400 uppercase tracking-[0.18em]">Namų profilis</p>
      </div>
      <p className="text-xs text-forest-500 leading-relaxed mb-3">
        Kas gyvena namuose? Pagal tai parodysim, kurie tavo augalai ir kam gali būti pavojingi.
      </p>

      {/* Vaikai */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Baby size={16} className="text-forest-500 flex-shrink-0" />
            <span className="text-sm font-medium text-forest-700">Vaikai</span>
          </div>
          <button
            onClick={toggleVaikai}
            disabled={readOnly}
            aria-pressed={local.vaikai}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${local.vaikai ? 'bg-forest-600' : 'bg-bone-400'} ${readOnly ? 'opacity-50' : ''}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-bone rounded-full shadow-sm transition-transform duration-200 ${local.vaikai ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Apytikslis amžius — NEPRIVALOMA (GDPR: ne tiksli data/amžius) */}
        {local.vaikai && (
          <div className="pl-[26px] space-y-1.5">
            <p className="font-mono text-[9.5px] text-forest-400 uppercase tracking-[0.16em]">Apytikslis amžius (neprivaloma)</p>
            <div className="flex flex-wrap gap-1.5">
              {VAIKU_AMZIUS.map(band => {
                const active = local.vaikuAmzius === band
                return (
                  <button
                    key={band}
                    onClick={() => setAmzius(band)}
                    disabled={readOnly}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${active ? 'bg-forest-600 text-bone' : 'bg-bone-50 text-forest-600 border border-bone-400/50 hover:bg-bone-300/50'}`}
                  >
                    {VAIKU_AMZIUS_META[band].trumpas}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="h-px bg-bone-400/40 my-3.5" />

      {/* Gyvūnai */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <PawPrint size={16} className="text-forest-500 flex-shrink-0" />
          <span className="text-sm font-medium text-forest-700">Gyvūnai</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {GYVUNAI.map(g => {
            const { label, Icon } = GYVUNO_META[g]
            const active = local.gyvunai.includes(g)
            return (
              <button
                key={g}
                onClick={() => toggleGyvunas(g)}
                disabled={readOnly}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${active ? 'bg-forest-600 text-bone' : 'bg-bone-50 text-forest-600 border border-bone-400/50 hover:bg-bone-300/50'}`}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
          <button
            onClick={toggleKiti}
            disabled={readOnly}
            aria-pressed={local.kitiGyvunai}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${local.kitiGyvunai ? 'bg-forest-600 text-bone' : 'bg-bone-50 text-forest-600 border border-bone-400/50 hover:bg-bone-300/50'}`}
          >
            Kiti
          </button>
        </div>
        {local.kitiGyvunai && (
          <p className="text-[11px] text-forest-400 leading-snug flex items-start gap-1.5">
            <Info size={12} className="flex-shrink-0 mt-0.5" />
            Kitiems gyvūnams (ne katė/šuo/paukštis/graužikas) tikslių toksiškumo duomenų kol kas neturime — rodysim bendrą informaciją.
          </p>
        )}
      </div>

      {/* Privatumo pastaba */}
      <p className="text-[10.5px] text-forest-400/90 leading-snug mt-3.5 pt-3 border-t border-bone-400/30">
        Neklausiame tikslaus vaiko amžiaus, vardo ar kitų asmens duomenų — tik to, kas reikalinga rizikai įvertinti. Informacija lieka tavo kolekcijoje.
      </p>
    </div>
  )
}
