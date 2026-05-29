# Design spike — user-biblioteka → reference modelis (P0 denormalizacijos fix)

**Data:** 2026-05-29 · **Statusas:** SPIKE (planas, ne implementacija) · Sprendžia audit P0.

## Sprendimas (patvirtintas)
User augalai nustoja būti save-momento KOPIJOS. Vietoj to:
- **Gyvi (auginama/nori):** laiko TIK asmeninius laukus + nuorodą į catalog; rūšiniai laukai
  (vardai, care, toksiškumas, aprašymas) resolve'inami **live** iš catalog → update immediate.
- **Mirę/istoriniai (istorija):** „užšaldomi" — markAsDied momentu rūšiniai laukai įrašomi į
  doc'ą, live nuoroda nutraukiama → istorinis tikslumas išsaugomas.
- **Vardo redagavimą user'iui PANAIKINAM** (patvirtinta) — vardai catalog-owned. User keičia tik
  foto, istoriją (timeline), užrašus.

## Laukų riba — JAU egzistuoja
`catalog.js:26-34` `PERSONAL_FIELDS` = autoritetinė riba. **Asmeniniai** (lieka user-plant doc'e):
`id, kategorija, komentaras, uzrasai, data_prideta, status, timeline, chat, zonaId, pirkinys,
diedDate, deathReason, lesson, useHistoryPhoto, photos`, + enrichment markeriai. Sharing: `isPublic`.
**Rūšiniai** (ateina iš catalog): viskas kita — `lotyniskas, lietuviškas, sinonimai, englishNames,
inatLtName, aprasymas, kilme, savybes(toksiškumas), sviesa, vanduo, laistymasIntervalas, tresimas,
prieziura, substratas, persodinimas, ziemojimas, dauginimas, problemos, idomybes, tipas, image…`
> Reference modelis tiesiog APVERČIA esamą `toCatalogEntry` strip'ą: user-plant = PERSONAL_FIELDS + nuoroda.

## Naujas user-plant doc shape
```
{
  // asmeniniai (kaip dabar)
  id, kategorija, status, zonaId, timeline, photos, uzrasai, data_prideta,
  useHistoryPhoto, isPublic, diedDate, deathReason, lesson, ...

  catalogId: "alocasia_regal_shield",   // STABILUS link key (catalogDocId snapshot)
  ref: { lotyniskas, lietuviškas, sinonimai, englishNames, savybes, laistymasIntervalas,
         tresimas, sviesa, vanduo, image, ... },  // last-known snapshot (fallback + freeze target)
  refFrozen: false,   // true mirusiems → ignoruoja live catalog
}
```

## Resolve mechanizmas (display)
Apibendrinti esamą `subscribeHeroMap` (catalog.js:206, jau live `onSnapshot(catalog)`) į
**`subscribeCatalog`**, kuris palaiko live `_catalogById` map'ą (pilni entries, ne tik hero URL).
- `heroIllustrationFor` skaito iš jo (kaip dabar).
- Nauja `resolvePlantRef(plant)`:
  ```
  if (plant.refFrozen) return plant.ref            // mirę — frozen snapshot
  return _catalogById[plant.catalogId] ?? plant.ref // gyvi — live, fallback į snapshot
  ```
- Display sluoksnis (PlantDetail, Dashboard kortelės, Biblioteka): `const view = { ...resolvePlantRef(plant), ...personalFieldsFrom(plant) }`. Personal visada iš plant; reference iš catalog (live) arba ref (fallback).
- **Pigu:** catalog jau atmintyje (live subscription + Firestore persistentLocalCache). „Join" = sync map-lookup. Offline veikia per snapshot fallback.

## Freeze-on-death
`usePlants.markAsDied` (usePlants.js:374): prieš set'inant `kategorija:'istorija'`, įrašyti
`ref = resolvePlantRef(plant)` (resolved live snapshot) + `refFrozen: true`. `moveToDashboard`
(:400, un-archive) → `refFrozen: false` (vėl live).

## Vardo redagavimo pašalinimas
- `PlantDetail.jsx:574-588` — editable `<h2>` (click→input→onBlur `lietuviškas`) → paversti plain
  read-only `<h2>{view.lietuviškas}>`. Pašalinti `editingName`/`nameVal` state.
- `PlantDetail.jsx:1590-1598` — per-plant `fetchPlantNames`→`onUpdateNames` (rašo englishNames/sinonimai
  į user plant) → PAŠALINTI (vardai catalog-owned; enrichment vyksta catalog lygmenyje).
- `usePlants` `refreshPlantFromAIResult` whitelist (~430-470) — reference laukai (sinonimai,
  englishNames, inatLtName, aprasymas, care…) nebeturi būti rašomi į user plant. „Atnaujinti per AI"
  → admin-only catalog edit (sutampa su Phase D). User plant patch lieka tik personal/sharing.
- onUpdateNames lieka tik: `isPublic`, `useHistoryPhoto` (ne vardai).

## Link-key stabilumas + reclassification
- Catalog NETURI alias/redirect sistemos (grep: tik komentaras catalog.js:130). `catalogId` =
  `catalogDocId(lotyniskas)` snapshot link metu.
- Rizika: jei augalo latin pasikeičia (reclassification ar mūsų trade-name normalizavimas) →
  catalogId nebeatitinka → live miss → **graceful degrade į `plant.ref` snapshot** (ne tuščia kortelė).
- Reclassification alias (catalog `_aliases`/redirect doc) — ATIDEDAM (retas, admin-driven; snapshot
  fallback dengia tarpinę būklę).

## Migracija — LAZY (be big-bang)
Esami user-plant docs JAU turi visus reference laukus inline. Backward-compatible resolve:
```
resolvePlantRef(plant) = plant.refFrozen ? plant.ref
  : (_catalogById[plant.catalogId ?? catalogDocId(plant.lotyniskas)] ?? plant.ref ?? plant /*legacy inline*/)
```
- Seni „fat" docs tarnauja kaip savo pačių fallback (legacy inline). Jokios privalomos migracijos.
- Nauji write'ai (addToDashboard/addToWishlist) rašo SLIM (personal + catalogId + ref).
- Optional batch script vėliau: split esamus fat docs → slim (declutter), bet ne būtina veikimui.

## Touch points (santrauka)
| Sritis | Failas:eil | Pokytis |
|---|---|---|
| Live catalog map | catalog.js:206 (`subscribeHeroMap`) | apibendrinti → `subscribeCatalog`/`_catalogById` + `resolvePlantRef` |
| App resolve | App.jsx:137 (`livePlant`) | per `resolvePlantRef` + personal overlay |
| Display | PlantDetail / Dashboard kortelės / Biblioteka | naudoti resolved `view` |
| Vardo edit | PlantDetail.jsx:574-588, 1590-1598 | pašalinti |
| Naujas augalas | usePlants addToDashboard:353 / addToWishlist:364 | rašyti slim (personal+catalogId+ref) |
| Freeze | usePlants markAsDied:374 / moveToDashboard:400 | snapshot ref + refFrozen toggle |
| Atnaujinti per AI | usePlants refreshPlantFromAIResult ~430 | reference laukai → catalog (admin), ne user plant |

## Rizikos / open items
1. **Care grounding sąveika (audit P1):** kai reference rodomas live, haliucinuoti care intervals
   pasimatys visiems iškart — tad care-grounding fix'as (intervals non-required) turėtų eiti KARTU
   ar PRIEŠ, kad nepaskleistume blogų skaičių greičiau.
2. **Toksiškumas live:** pataisius severity, esami augalai iškart gaus teisingą — pliusas. Bet kol
   neištaisyta, blogi 2-padala pasimatys visiems. Toksiškumo fix prieš/su šituo.
3. **isPublic/viewer kelias:** viewer (`/api/viewer`) negauna client catalog subscription'o — viewer
   plant'ams reikia server-side reference resolve (ARBA palikti ref snapshot viewer'iams). Patikrinti.
4. Server save (processPlant) turi rašyti slim user plant + ref (mirror client modelio).

## Implementacijos fazės (pasiūlymas)
- **F1:** `subscribeCatalog` + `resolvePlantRef` + display overlay (read-only path) — backward-compat su legacy fat docs. Nieko nelaužo, įjungia live update esamiems.
- **F2:** Slim write'ai (addToDashboard/wishlist/server) + freeze-on-death.
- **F3:** Pašalinti vardo edit + redirect „Atnaujinti per AI" į admin.
- **F4:** (optional) batch declutter migracija + viewer reference resolve.
> F1 viena duoda P0 vertę (live update) be rizikos. F2-F3 declutterina. Daryti PO/SU care+tox fix'ais (rizikos #1,#2).
