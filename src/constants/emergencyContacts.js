/**
 * emergencyContacts — KONFIGŪRUOJAMI pagalbos kontaktai toksikologinei kortelei.
 *
 * ⚠️ TODO (PRIEŠ PRODUKCIJĄ): patvirtinti numerius. Užduotyje aiškiai nurodyta
 * „palik kaip konfigūruojamą lauką su TODO, nespėliok numerių". Todėl aktyvūs
 * rodomi numeriai (`numeris`) pagal nutylėjimą yra `null` (kortelė rodo „TODO:
 * sukonfigūruoti"). `siulomas` laukas — KANDIDATAS iš repo tyrimo dokumentų, NE
 * patvirtintas faktas — rodomas tik kaip pilkas pasiūlymas su „patikrinti" žyma.
 *
 * Kandidatų šaltiniai (repo dokumentai, laukia patikros):
 *   • Žmonių apsinuodijimai — LT Apsinuodijimų kontrolės ir informacijos biuras,
 *     24/7: +370 5 236 2052 / +370 687 53378
 *     (tasks/konsiliumas-2026-06/45-pediatras-toksikologas.md, 45-liability-redteam.md;
 *      sam.lrv.lt). PATIKRINTI prieš rodant kaip faktą.
 *   • Gyvūnai — Lietuvoje NĖRA 24/7 gyvūnų apsinuodijimų linijos. Realus CTA =
 *     artimiausia 24/7 vet klinika (pvz. LSMU dr. L. Kriaučeliūno smulkiųjų gyvūnų
 *     klinika Kaune; DR.VET skubi pagalba). Numeriai NEįrašyti — vartotojas ar
 *     akademijos partneris turi sukonfigūruoti lokalų kontaktą.
 *     (tasks/konsiliumas-2026-06/45-veterinaras.md)
 *
 * 112 — bendrasis ES pagalbos numeris — paliktas kaip universalus faktas (ne spėjimas).
 *
 * Kaip sukonfigūruoti: pakeisk `numeris: null` → `numeris: '+370 ...'` kiekvienam
 * kontaktui, kurį patvirtinai. Kortelė automatiškai pradės rodyti patvirtintą numerį.
 */

export const EMERGENCY_CONTACTS = {
  // Žmonės (vaikai, suaugę)
  zmonems: {
    label: 'Apsinuodijimų kontrolės ir informacijos biuras',
    aprasymas: 'Žmonių apsinuodijimai · visą parą (24/7)',
    numeris: null,            // TODO: patvirtinti ir įrašyti
    siulomas: '+370 5 236 2052 / +370 687 53378', // kandidatas iš repo dokumentų — PATIKRINTI
    patvirtinta: false,
    saltinis: 'sam.lrv.lt (laukia patikros)',
  },
  // Gyvūnai (katė, šuo, paukštis, graužikas)
  gyvunams: {
    label: 'Artimiausia 24/7 veterinarijos klinika',
    aprasymas: 'Lietuvoje atskiros gyvūnų apsinuodijimų linijos nėra — kreipkis į budinčią kliniką',
    numeris: null,            // TODO: vartotojas įrašo lokalų 24/7 vet kontaktą
    siulomas: null,           // nerašom konkretaus numerio — lokalu, priklauso nuo miesto
    patvirtinta: false,
    saltinis: 'tasks/konsiliumas-2026-06/45-veterinaras.md',
  },
  // Universalus
  bendras: {
    label: 'Bendrasis pagalbos numeris',
    aprasymas: 'Sunkūs simptomai (kvėpavimo/rijimo sutrikimas, sąmonės praradimas)',
    numeris: '112',           // universalus ES faktas (ne spėjimas)
    patvirtinta: true,
    saltinis: 'ES bendrasis pagalbos numeris',
  },
}

// Grąžina kontaktus, aktualius konkretiems namams (žmonės / gyvūnai / abu) + 112.
export function contactsForAudience({ turiZmoniu = false, turiGyvunu = false } = {}) {
  const out = []
  if (turiZmoniu) out.push({ key: 'zmonems', ...EMERGENCY_CONTACTS.zmonems })
  if (turiGyvunu) out.push({ key: 'gyvunams', ...EMERGENCY_CONTACTS.gyvunams })
  out.push({ key: 'bendras', ...EMERGENCY_CONTACTS.bendras })
  return out
}
