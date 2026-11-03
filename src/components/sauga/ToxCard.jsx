import { AlertTriangle, Stethoscope, Phone, Ban, Syringe, HeartPulse, Info, ShieldCheck } from 'lucide-react'
import {
  resolveToxinProfile,
  assessHouseholdRisk,
  normalizeHousehold,
  isHouseholdEmpty,
  SPECIES,
  AUDITORIJA_META,
} from '../../utils/toxinClasses'
import { contactsForAudience } from '../../constants/emergencyContacts'
import SunkumasZyma from './SunkumasZyma'

// ToxCard — toksikologinė kortelė medikui / veterinarui (prezentacinis turinys).
//
// SAUGUMO RĖMAS (tasks/konsiliumas-2026-06/45-*): FAKTAI + KONTAKTAI, ne triage.
// Jokios pirmosios pagalbos procedūros (vėmimo sukėlimas kai kuriais atvejais
// KONTRAINDIKUOTAS — 45-pediatras §3.4), tik „nesielk savarankiškai, kreipkis".
// Jokio „saugu" be duomenų. Kortelė IDENTIFIKUOJA augalą ir pateikia junginių
// faktus profesionalui — sprendimą dėl gydymo priima JIS.

const SPECIES_LABEL = {
  zmogus: 'Žmonės', kate: 'Katė', suo: 'Šuo', paukstis: 'Paukštis', grauzikas: 'Graužikas',
}
const PATIKIMUMAS_LABEL = {
  AUKSTAS: 'aukštas', VIDUTINIS: 'vidutinis', ZEMAS: 'žemas',
}
const MECHANIZMAS_LABEL = {
  lokalus_dirgiklis: 'lokalus dirgiklis', sisteminis: 'sisteminis', fototoksinis: 'fototoksinis',
}

function todayStr() {
  try { return new Date().toLocaleDateString('lt-LT') } catch { return '' }
}

function Hairline({ label }) {
  return (
    <div className="flex items-center gap-3 mt-1">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-600">{label}</p>
      <div className="flex-1 h-px bg-forest-200/70" />
    </div>
  )
}

export default function ToxCard({ plant, household }) {
  const h = normalizeHousehold(household)
  const profile = resolveToxinProfile(plant, {})           // pilnas rūšių vaizdas medikui
  const risk = isHouseholdEmpty(h) ? null : assessHouseholdRisk(plant, h)

  const lotyniskas = plant?.lotyniskas || plant?.latinName || ''
  const lietuviskas = plant?.lietuviškas || plant?.lietuviskas || lotyniskas || 'Augalas'
  const sinonimai = Array.isArray(plant?.sinonimai) ? plant.sinonimai.filter(Boolean) : []
  const englishNames = Array.isArray(plant?.englishNames) ? plant.englishNames.filter(Boolean) : []

  // Kontaktų aktualumas — kurioms auditorijoms augalas pavojingas (ar nežinoma).
  const classes = profile.klases ?? []
  const affects = (sp) => classes.some(k => {
    const v = k.rusies_jautrumas?.[sp]
    return v != null && v !== 'nera'
  })
  const turiZmoniu = profile.status === 'nezinoma' || affects('zmogus') || classes.length === 0
  const turiGyvunu = profile.status === 'nezinoma' || ['kate', 'suo', 'paukstis', 'grauzikas'].some(affects) || classes.length === 0
  const contacts = contactsForAudience({ turiZmoniu, turiGyvunu })

  return (
    <div className="toxcard-sheet bg-white text-forest-900 font-sans">
      <div className="max-w-[640px] mx-auto px-5 py-5 space-y-5">

        {/* ── Antraštė ── */}
        <div className="flex items-start gap-3">
          <Stethoscope size={22} className="text-forest-700 flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Toksikologinė kortelė</p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-forest-800 leading-tight mt-0.5">{lietuviskas}</h1>
            {lotyniskas && <p className="text-sm text-forest-500 italic">{lotyniskas}</p>}
            {(sinonimai.length > 0 || englishNames.length > 0) && (
              <p className="text-[12px] text-forest-400 mt-1 leading-snug">
                {[...sinonimai, ...englishNames].slice(0, 6).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* ── DISCLAIMER — informacija, ne medicininė konsultacija ── */}
        <div className="bg-terracotta-50 border-2 border-terracotta/40 rounded-2xl p-3.5 flex gap-3">
          <AlertTriangle size={18} className="text-terracotta-600 flex-shrink-0 mt-0.5" />
          <p className="text-[13px] text-forest-700 leading-relaxed">
            <strong className="font-semibold text-terracotta-600">Tai informacija, ne medicininė konsultacija.</strong>{' '}
            Kortelė padeda identifikuoti augalą ir žinomas toksines medžiagas. Sprendimą dėl gydymo priima gydytojas, toksikologas ar veterinaras — parodykite jiems šią kortelę.
          </p>
        </div>

        {/* ── Namų rizikos santrauka (jei profilis nustatytas) ── */}
        {risk && (
          <div className="rounded-2xl border border-bone-400/50 bg-bone-50 p-3.5">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-forest-500 mb-2">Rizika šiems namams</p>
            {risk.perAuditorija.length > 0 ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {risk.perAuditorija.map(r => (
                  <span key={r.auditorija} className="inline-flex items-center gap-1.5">
                    <span className="text-[12px] text-forest-600">{AUDITORIJA_META[r.auditorija]?.label ?? r.label}:</span>
                    <SunkumasZyma sunkumas={r.sunkumas} trukstaDuomenu={r.trukstaDuomenu} />
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-forest-500">{risk.antraste}</p>
            )}
          </div>
        )}

        {/* ── Statusas / patikimumas ── */}
        <div>
          <Hairline label="Statusas" />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-forest-700">
            {profile.status === 'toksiska' && <span className="font-semibold text-terracotta-600">Toksiškas augalas</span>}
            {profile.status === 'saugu' && <span className="inline-flex items-center gap-1.5 font-semibold text-forest-700"><ShieldCheck size={15} /> Pagal turimus duomenis nelaikomas toksišku</span>}
            {profile.status === 'nezinoma' && <span className="font-semibold text-forest-600">Toksiškumo duomenų neturime</span>}
            {profile.tier && <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-forest-400">· duomenų lygis (tier) {profile.tier}</span>}
          </div>
          <p className="text-[11.5px] text-forest-400 leading-snug mt-1.5">
            Duomenys — research-grade juodraštis iš autoritetingų šaltinių (ASPCA, Merck Vet, poison control, recenzuota literatūra). <strong className="text-forest-500">Dar nepatvirtinti toksikologo</strong> (laukia akademijos partnerystės).
          </p>
        </div>

        {/* ── Toksinų klasės ── */}
        {classes.length > 0 && (
          <div className="space-y-4">
            <Hairline label="Toksinės medžiagos" />
            {classes.map((k, i) => (
              <div key={i} className="rounded-2xl border border-bone-400/50 overflow-hidden">
                {/* Klasės antraštė */}
                <div className="bg-bone-100 px-3.5 py-2.5 border-b border-bone-400/40">
                  <p className="font-display text-[15px] font-bold text-forest-800 tracking-tight leading-snug">{k.vardas_lt}</p>
                  {k.vardas_en && <p className="text-[11px] text-forest-400 italic">{k.vardas_en}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-forest-500">
                    <span><span className="text-forest-400">Mechanizmas:</span> {MECHANIZMAS_LABEL[k.mechanizmo_tipas] ?? k.mechanizmo_tipas}</span>
                    {k.organas && <span><span className="text-forest-400">Organas:</span> {k.organas}</span>}
                    <span><span className="text-forest-400">Dalis:</span> {k.dalis}</span>
                    <span><span className="text-forest-400">Sunkumo lubos:</span> {k.sunkumo_lubos}</span>
                  </div>
                </div>

                <div className="px-3.5 py-3 space-y-3">
                  {/* Antidotas */}
                  <div className="flex items-start gap-2">
                    <Syringe size={14} className={`flex-shrink-0 mt-0.5 ${k.antidotas ? 'text-forest-600' : 'text-forest-300'}`} />
                    <p className="text-[12.5px] text-forest-700">
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-forest-400">Antidotas: </span>
                      {k.antidotas ? <strong className="font-semibold">{k.antidotas}</strong> : 'specifinio nėra (gydymas simptominis)'}
                    </p>
                  </div>

                  {/* Jautrumas pagal rūšį */}
                  <div>
                    <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-forest-400 mb-1.5">Jautrumas pagal rūšį</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {SPECIES.map(sp => (
                        <span key={sp} className="inline-flex items-center gap-1.5">
                          <span className="text-[11.5px] text-forest-600 w-[62px]">{SPECIES_LABEL[sp]}</span>
                          <SunkumasZyma sunkumas={k.rusies_jautrumas?.[sp] ?? null} />
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Simptomai */}
                  {k.simptomai_lt && (
                    <div>
                      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-forest-400 mb-0.5">Simptomai</p>
                      <p className="text-[12.5px] text-forest-700 leading-relaxed">{k.simptomai_lt}</p>
                    </div>
                  )}

                  {/* Medikui */}
                  {k.medikui_lt && (
                    <div className="bg-forest-50 border border-forest-200/70 rounded-xl px-3 py-2">
                      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-forest-600 mb-0.5">Medikui / veterinarui</p>
                      <p className="text-[12.5px] text-forest-700 leading-relaxed">{k.medikui_lt}</p>
                    </div>
                  )}

                  {/* Šaltiniai + patikimumas */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    {k.saltiniai?.length > 0 && (
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {k.saltiniai.slice(0, 6).map((url, j) => (
                          <a key={j} href={url} target="_blank" rel="noopener noreferrer"
                             className="font-mono text-[10px] text-forest-500 underline underline-offset-2 hover:text-forest-700 break-all">
                            šaltinis {j + 1} ↗
                          </a>
                        ))}
                      </div>
                    )}
                    {k.patikimumas && (
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-forest-400">patikimumas: {PATIKIMUMAS_LABEL[k.patikimumas] ?? k.patikimumas}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Duomenų spragos (sąžiningai) ── */}
        {profile.dataGaps.length > 0 && (
          <div className="flex items-start gap-2 bg-bone-100 border border-bone-400/40 rounded-xl px-3 py-2.5">
            <Info size={14} className="text-forest-400 flex-shrink-0 mt-0.5" />
            <div className="text-[12px] text-forest-600 leading-snug space-y-0.5">
              <p className="font-medium text-forest-700">Duomenų trūkumai:</p>
              {profile.dataGaps.map((g, i) => <p key={i}>· {g}</p>)}
              <p className="text-forest-400">„Nėra duomenų" nereiškia „saugu" — elkitės atsargiai.</p>
            </div>
          </div>
        )}

        {/* ── Pirmoji pagalba / ką daryti (BE procedūrų — tik saugi kryptis) ── */}
        <div>
          <Hairline label="Ką daryti" />
          <div className="mt-2 space-y-2">
            <div className="flex items-start gap-2">
              <Ban size={15} className="text-terracotta-500 flex-shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-forest-700 leading-relaxed">
                <strong className="font-semibold">Nesukelkite vėmimo ir negydykite savarankiškai.</strong> Kai kuriems toksinams vėmimo sukėlimas pavojingas. Nelaukite simptomų, jei įtariate reikšmingą kiekį ar mirtiną augalą.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <HeartPulse size={15} className="text-forest-600 flex-shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-forest-700 leading-relaxed">
                Pasiimkite augalą ar jo nuotrauką ir kreipkitės į specialistą. Rodyklė visada viena kryptimi: <strong className="font-semibold">skambinkite / vykite DABAR, jei abejojate.</strong>
              </p>
            </div>
          </div>

          {/* Kontaktai — KONFIGŪRUOJAMI (TODO) */}
          <div className="mt-3 space-y-2">
            {contacts.map(c => (
              <div key={c.key} className="flex items-start gap-2.5 bg-bone-50 border border-bone-400/40 rounded-xl px-3 py-2.5">
                <Phone size={15} className="text-forest-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-forest-800 leading-snug">{c.label}</p>
                  <p className="text-[11px] text-forest-500 leading-snug">{c.aprasymas}</p>
                  {c.numeris ? (
                    <a href={`tel:${c.numeris.replace(/\s/g, '')}`} className="font-mono text-[15px] font-bold text-forest-700 tracking-wide">{c.numeris}</a>
                  ) : (
                    <p className="text-[11.5px] text-terracotta-600 mt-0.5 leading-snug">
                      ⚠ Numeris nesukonfigūruotas (TODO).{c.siulomas ? <> Kandidatas (patikrinti): <span className="font-mono">{c.siulomas}</span></> : ' Įrašykite vietinį kontaktą nustatymuose.'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="pt-3 border-t border-bone-400/40 space-y-1">
          <p className="text-[10.5px] text-forest-400 leading-snug">
            Sugeneruota {todayStr()} · LapasID. Parodykite šią kortelę medikui ar veterinarui.
          </p>
          <p className="text-[10.5px] text-forest-400 leading-snug">
            Informacinio pobūdžio medžiaga. Neatstoja profesionalios medicinos ar veterinarijos pagalbos.
          </p>
        </div>
      </div>
    </div>
  )
}
