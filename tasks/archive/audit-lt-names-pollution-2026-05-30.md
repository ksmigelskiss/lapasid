# Auditas: `data/lt-names.json` — `ltAllForms` užterštumas

**Data:** 2026-05-30
**Skriptas:** `scripts/audit-lt-names-pollution.mjs` (READ-ONLY, run-once safe)
**Build script:** `scripts/build-lt-names.mjs`

---

## 1. Executive Summary

- Iš **1356 ltAllForms** įrašų **108** (~8%) yra užteršti: **68 species-level** LT pavadinimai (pvz. „Sansevjera trijuostė" Sansevieria gentyje), **23 cross-genus** kolizijos (pvz. „Sanpaulija" Streptocarpus gentyje), **17 ambiguous "unknown"** kurie tikriausiai irgi yra šiukšlės. **88 gentys** turi bent po vieną užterštą formą.
- Pagrindinė priežastis — `data/gaspadorius-detail.json` ir `data/inat-names.json` šaltiniai dažnai pateikia **species-level** LT vardus, o `build-lt-names.mjs` juos suvienodina į **genus-level** įrašą per `latinGenus` raktą (83 iš 217 gaspadorius porų yra dvi-žodės species formos), be klasifikacijos.
- UI lygiu (`searchStage1.js:317`, `ltDictionary.js:200`) `ltAllForms` naudojamas kaip search index ir kaip "synonym chip" rinkinys → vartotojas mato klaidingus sinonimus genus-level rezultatuose.

---

## 2. `lt-names.json` struktūra

Failas (~48k eilučių) — viršus su `stats` + `schema`, žemiau `ltNames` žodynas (key = Latin genus). Pavyzdžiai:

**Švarus įrašas (Acaena):**
```json
"Acaena": {
  "latin": "Acaena",
  "ltName": "Acenos",
  "ltSynonyms": ["dyglius"],
  "ltAllForms": ["Acenos", "dyglius"],
  "sources": ["derlingas", "sodospalvos"],
  "confidence": "high",
  "raw": { "wiki": null, "plantsJson": "dyglius", "derlingas": "Acenos", ... }
}
```

**Užterštas SPECIES-POLLUTED (Sansevieria):**
```json
"Sansevieria": {
  "ltName": "Sansevjera",
  "ltSynonyms": ["Sansevjera trijuostė"],         ← SPECIES (S. trifasciata) genus įraše
  "ltAllForms": ["Sansevjera", "Sansevjera trijuostė"],
  "conflicts": "Sansevjera trijuostė (gaspadorius)",
  "raw": { "plantsJson": "sansevjera", "derlingas": "Sansevjera" }
}
```

**Užterštas CROSS-GENUS (Streptocarpus ← Saintpaulia):**
```json
"Streptocarpus": {
  "ltName": "Streptokarpas",
  "ltSynonyms": ["Sanpaulija"],                    ← visiškai kitos genties (Saintpaulia) vardas
  "ltAllForms": ["Streptokarpas", "Sanpaulija"],
  "conflicts": "Sanpaulija (inat)",
  "raw": { "wiki": "Streptokarpas", "inat": "Sanpaulija" }
}
```

---

## 3. Build pipeline — kaip `ltAllForms` užsipildo

`build-lt-names.mjs` (637 eilučių) per pre-DB gentį (1655) renka kandidatus iš 7 šaltinių:

| Šaltinis | Failas | Pavadinimo grūdėtumas |
|----------|--------|----------------------|
| wiki | `lt-names-wiki.json` | genus (auto-redirect) |
| plants.json | `plants.json` | genus arba species mix |
| derlingas | `derlingas-pairs.json` | genus (LT/Latin porose) |
| sodospalvos | `sodospalvos-names.json` | genus |
| **gaspadorius** | `gaspadorius-detail.json` | **dažnai SPECIES** (217 porų; 83 dvi-žodės) |
| **iNat** | `inat-names.json` | **dažnai cross-genus** (preferredLtName perima populiariausią vernacular, kuri gali būti kitos genties) |
| manual | hardcoded MANUAL_LT_OVERRIDES | žmogus tikrina |

Algoritmas (eilutės 339-486):
1. Sukrauna visus kandidatus į vieną `candidates[]` masyvą (`{name, src, raw}`).
2. **Grupavimas pagal `normalizeForCompare(name)`** — collapse'ina diacritic / plural variantus. **Problema:** „Sansevjera" (norm: `sansevjer`) ir „Sansevjera trijuostė" (norm: `sansevjeratrijuost`) → **skirtingos grupės**, nes pridėtas adjective žodis.
3. Daugiausia kandidatų turinti grupė → `ltName`. Kitos grupės → `ltSynonyms` (lines 471-486).
4. `ltAllForms = [ltName, ...ltSynonyms]` (lines 489-493).

Esmė: **build script'as neturi nieko, kas atskirtų genus-level pavadinimą nuo species-level pavadinimo** — jei kandidatas normalizuojasi į kitokią formą, jis automatiškai gauna "synonym" statusą.

### Pollution šaltinio detalė

**gasp-detail.json (Sansevieria pavyzdys):**
```json
{
  "ltName": "Sansevjera trijuostė",       ← SPECIES name (S. trifasciata)
  "latinGenus": "Sansevieria",            ← BET indexuojama pagal gentį
  "latinSpecies": "trifasciata",
  "sourceUrl": ".../trijuoste-sansevjera.htm"
}
```

`build-lt-names.mjs:299-310` kodas:
```js
for (const p of gaspDetailPairs) {
  const latinGenus = p.latinGenus || p.latin?.split(/\s+/)[0]
  ...
  gaspadoriusByLatin.set(key, { ltName: p.ltName, ... })   // ← species LT name'as priskirtas genčiai
}
```

Ignoruojama `latinSpecies` reikšmė — jei būtų `latinSpecies != null`, šis įrašas turėtų eiti į `species-lt-names.json`, ne į genus-level dict.

**inat-names.json (Streptocarpus pavyzdys):**
```json
"Streptocarpus": { "preferredLtName": "Sanpaulija", "taxonId": 343506 }
```
iNat API grąžino "Sanpaulija" kaip populiariausią LT vernacular Streptocarpus genčiai, nors tai yra kitos genties (Saintpaulia) tradicinis pavadinimas. Build script'as priima šią reikšmę be cross-genus patikrinimo.

---

## 4. Pollution skaičiai (audit script'as)

```
Total genera entries:                   1641
Entries with ltAllForms (non-empty):    888

Total ltAllForms entries (across all):  1356
  clean (genus variant):                1148   (84.7%)
  species-polluted:                       68   ( 5.0%)
  cross-genus:                            23   ( 1.7%)
  unknown / ambiguous:                   117   ( 8.6%)

Entries with >=1 species-polluted:       66
Entries with >=1 cross-genus:            23
Entries with >=1 unknown:               104
Entries with ANY pollution:              88   (~10% iš ne-tuščių)
```

**Klasifikacijos heuristika** (`audit-lt-names-pollution.mjs`):
- **clean** — vienažodė forma, kurios normalized = genus ltName normalized, ARBA vienažodė alternatyva, kuri nesusiduria su jokia kita gentimi.
- **species-polluted** — 2+ žodžių forma, kurioje vienas žodis = genus ltName, kitas = LT descriptor adjective (-asis/-oji/-inis/-uotas/-tinis ir t.t.).
- **cross-genus** — forma, kurios normalized = KITO genus įrašo ltName.
- **unknown** — viskas kita (dauguma — žmogiškos garbage formos kaip „šią gėlę Amarilis", „ikona laikomas žalčialunkis"). Konservatyvus skaičius — realiame audite dauguma "unknown" tikriausiai yra šiukšlės, ne legitimūs sinonimai.

### Top-20 prasčiausių (didžiausias pollution count)

| Genus | ltName | Užteršti įrašai |
|---|---|---|
| Malva | Dedešva | „priskirta gėlė dedešva" [species-pol], „Dedešva miškinė" [species-pol] |
| Rosa | Erškėtis | „erškėtis kininis" [species-pol], „rožė" [**cross-genus** → Rhodiola] |
| Solidago | Rykštenė | „gulsčioji rykštenė" [species-pol], „Auksaspalvė rykštenė" [species-pol] |
| Acorus | AJERAS | „Ajeras viksvinis" [species-pol] |
| Amaryllis | amarilis | „šią gėlę Amarilis" [garbage prefix] |
| Ampelopsis | Vytenis (augalas) | „vynmedis" [**cross-genus** → Vitis] |
| Aristolochia | Kartuolė | „Kartuolė (augalas)" |
| Athyrium | Paprastasis blužniapapartis | „papartis" [**cross-genus** → Cystopteris/Dryopteris/Pteris] |
| Billbergia | Bilbergija | „Bilbergija svyrančioji" [species-pol] |
| Camellia | Kamelija | „rožes primenančios kamelijos" [garbage] |
| Canna | Kana | „Kana (augalas)" |
| Chamaedaphne | Bereinis | „Bereinis durpyninis" [species-pol] |
| Chionodoxa | Sniegdryžė | „Scylė" [**cross-genus** → Scilla] |
| Chrysanthemum | Chrizantema | „Chrizantema indinė" [species-pol] |
| Convallaria | Pakalnutė | „Paprastoji pakalnutė" [species-pol] |
| Cydonia | Paprastoji cidonija | „svarainis" [**cross-genus** → Chaenomeles] |
| Daphne | žalčialunkis | „ikona laikomas žalčialunkis" [garbage] |
| Duchesnea | žemuogžalė | „Sidabražolė" [**cross-genus** → Potentilla] |
| Echinacea | Ežiuolė | „Ežiuolė rasvažiedė" [species-pol] |
| Euonymus | Ožekšnis | „Ožekšnis japoninis" [species-pol] |

### Visi 23 cross-genus atvejai

```
Rosa            → rožė             (=Rhodiola)
Ampelopsis      → vynmedis         (=Vitis)
Athyrium        → papartis         (=Cystopteris,Dryopteris,Pteris)
Chionodoxa      → Scylė            (=Scilla)
Cydonia         → svarainis        (=Chaenomeles)
Duchesnea       → Sidabražolė      (=Potentilla)
Hebe            → Veronika         (=Veronica)
Juglans         → riešutas         (=Carya)
Lavatera        → Dedešva          (=Malva)
Lunaria         → mėnulis          (=Menispermum)
Lychnis         → Naktižiedė       (=Silene)
Mahonia         → Raugerškis       (=Berberis)
Matthiola       → leukojai         (=Leucojum)
Mespilus        → Gudobelė         (=Crataegus)
Michelia        → Magnolija        (=Magnolia)
Pistacia        → šio augalo vardas (=Cistus,Myrtus,Sisyrinchium)
Pyracantha      → ugniažolė        (=Chelidonium)
Pyrola          → kriaušė          (=Pyrus)
Streptocarpus   → Sanpaulija       (=Saintpaulia)   ← bug-report case
Thymus          → šio augalo vardas (=Cistus,Myrtus,Sisyrinchium)
Lycopersicon    → Kiauliauogė      (=Solanum)
Piper           → Pipirai          (=Macropiper)
Rhoeo           → Tradeskantė      (=Tradescantia)
```

> Pastaba: kai kurie cross-genus atvejai botaniškai turi taksonomijos pagrindą (pvz. Michelia anksčiau buvo Magnolia synonymas), tačiau search UI kontekste tai vis tiek klaidina — vartotojas, ieškantis vienos genties, gauna chip'us su kitos genties pavadinimu.

---

## 5. Root cause analysis

### Kur tiksliai užteršimas atsiranda

1. **Šaltinio lygmuo (gaspadorius-detail.json):** 83 iš 217 (38%) porų turi `ltName` kuri yra dviejų-žodžių species-level forma su `latinSpecies != null`. Šaltinis (gaspadorius.lt) parašytas straipsniais per species, ne genus.

2. **Šaltinio lygmuo (inat-names.json):** iNat API endpoint'as grąžina `preferredLtName` lauką, kuris yra **populiariausias** vernacular LT vardas tam taxon'ui. Bet šis populiarumo signalas ignoruoja taksonominę giminystę → Streptocarpus iNat'e dažnai pavadinama "Sanpaulija", nors botaniškai tai yra Saintpaulia.

3. **Build script logika (`build-lt-names.mjs:299-310`):**
   ```js
   for (const p of gaspDetailPairs) {
     const latinGenus = p.latinGenus || p.latin?.split(/\s+/)[0]
     ...
     gaspadoriusByLatin.set(key, { ltName: p.ltName, ... })
   }
   ```
   **Trūksta filtro:** jei `p.latinSpecies != null`, įrašas turėtų eiti į species-lt-names pipeline, ne būti registruotas kaip genus-level kandidatas.

4. **Build script logika (`cleanLtName`):** patikrina garbage prefixus ir forbidden words, bet **nedaro morfologinės analizės**, kuri atskirtų bare genus name nuo „[genus noun] [adjective]" species formos.

5. **Build script logika (grouping, lines 422-431):** `normalizeForCompare` nuima diacritikus ir kai kurias galūnes, bet **nestrip'ina** descriptor adjective'ų. Dėl to „Sansevjera" ir „Sansevjera trijuostė" patenka į skirtingas grupes ir antroji tampa "synonym".

### Idealus `ltAllForms` šablonas

Genus-level įraše `ltAllForms` turėtų talpinti **tik tas formas, kurios reprezentuoja PAČIĄ GENTĮ** — pirminį LT genus vardą + jo morfologinius variantus (singular/plural, diacritic variantai, transliteracijos), ne species ar related-genus vardus.

Pavyzdžiui Sansevieria:
- ✓ "Sansevjera", "Sansevierija", "Sansevierios" (plural), "Sanseviera" (variant)
- ✗ "Sansevjera trijuostė" (species → species-lt-names.json)
- ✗ "Driežliežuvis" (cross-genus → nesvarbu Sansevieria entry'je)

Tikri alt LT genus vardai legitimūs (Beaucarnea atveju „Dramblio koja", „Arklio uodega" — istoriniai vernacular vardai TAI PAČIAI genčiai). Tas atvejas turėtų likti, bet tik per žmogaus tikrinimą (MANUAL_LT_OVERRIDES pattern).

---

## 6. Pasiūlytos fix strategijos (NEįgyvendinta)

### Opcija A — Build-time strict filter (rekomenduojama)

Modifikuoti `build-lt-names.mjs`, kad būtų **du atskiri kanalai**:
- jei kandidato šaltinis pateikia `latinSpecies != null` ARBA pats `name` turi 2+ žodžių ir antras yra LT adjective shape → eina į species-lt-names.json kanalą, **nepateikiamas genus candidate'ų sąrašui**.
- atskira "synonyms whitelist" lentelė manual override'ams, kur žmogus pažymi legitimius alt genus vardus.

**Pliusai:** root-cause fix, idempotent, lengvai re-run'inamas. Apsaugo nuo ateities pollution'o iš naujų šaltinių.
**Minusai:** reikia atskirti reguliarius species LT name'us nuo legitimių multi-word genus name'ų (pvz. „Paprastoji cidonija" = Cydonia genus name, ne species). ~1-2 dienų darbo + manual whitelist'o.

### Opcija B — Post-hoc cleanup script

Naujas `scripts/cleanup-lt-names-pollution.mjs`, kuris paima esamą `lt-names.json`, pažymi pollution kandidatus (kaip šis audit script'as), išmeta juos iš `ltAllForms` + `ltSynonyms` ir įrašo atgal. Manual override file'as legitimius alt vardus išsaugotų.

**Pliusai:** greitas (~kelios valandos darbo), apsaugo `build-lt-names.mjs` nuo perrašymo, leidžia incrementally apdoroti.
**Minusai:** bandaid — kitas `build` perrašys ir grąžins pollution'ą. Reikia užtikrinti, kad cleanup ž'is integruotas į build pipeline arba kad rezultatas commitintas.

### Opcija C — Runtime filter `ltDictionary.js`

Palikti lt-names.json kaip yra, bet `resolveLt()` lygiu filtruoti `ltAllForms` per heuristiką (kaip jau dabar daroma species-qualified atveju, žiūr. `src/utils/ltDictionary.js:192-200`).

**Pliusai:** zero data migracija, hot-fix lygis.
**Minusai:** filtrai dubliuojami visur, kur naudojamas `ltAllForms` (`searchStage1.js:317` ir kt.); reverse map (`getReverseMap`) vis tiek pasiims užterštas formas → cross-genus klaidos paieškoje. **Nesprendžia root-cause.**

**Rekomendacija:** A opcija (build-time filter) + Opcija B kaip vienkartinis cleanup po pirminio A patch'o, kad atstatyti istorinę būklę be reikalo perscrap'inti.

---

## 7. Downstream consumers (impact estimate)

| Failas | Naudojimas | Impact |
|---|---|---|
| `src/utils/ltDictionary.js:200, 248` | `getAllLtForms()` grąžina `genusEntry.ltAllForms` UI'ui | **Aukštas** — synonym chips polluted |
| `src/utils/searchStage1.js:317` | `ltSynonyms: ltEntry?.ltAllForms` perduodama į pre-DB base result | **Aukštas** — search result kortelė |
| `api/_lib/ltDictionary-server.js:80, 85` | Server-side mirror — ta pati logika | **Aukštas** — API atsakymai |
| `src/utils/preDbBaseResult.js:42` | Dedupe per Set — bet jei pollution sintetinis, dedup nepadeda | Vidutinis |
| `src/utils/plantPromptConfig.js:71` | Tik komentaras (genus-level note), nebenaudoja `ltAllForms` reikšmės | Žemas |
| `src/utils/plantTransform.js:386` | Tik komentaras | Žemas |
| `scripts/validate-pre-db.mjs`, `scripts/generate-curated-300.mjs`, `scripts/build-lt-indoor-whitelist.mjs`, `scripts/build-species-lt-names.mjs`, `scripts/apply-lt-names-*.mjs`, `scripts/fix-genus-fallback-names.mjs`, `scripts/cleanup-pre-db-phantoms.mjs` | Read `lt-names.json` įvairiais būdais — kai kurie skaito tik `ltName`, kiti — `ltAllForms` | Vidutinis (priklauso nuo to, ką tiksliai naudoja; species-pol formoms patenkant į curated-300 ar lt-indoor-whitelist gali iškreipti rekomendacijas) |
| `api/_lib/dataLoader-server.js:54` | Loader (kešavimas) | Neutralus |

**Žinomos workaround'os jau egzistuoja:**
- `src/utils/ltDictionary.js:192-200` (speices-qualified branch) — `ltAllForms` rezultate naudojamas tik kai querry yra GENUS-only; species-level query atveju kuriamas „[ltName] [epithet]" + bare ltName, ignoruojant `genusEntry.ltAllForms`. Komentaras eksplicitiškai nurodo lt-names.json data quality issue (cituojamas task #37).

---

## Priedai

- **Audit script'as:** `/Users/kestutissmigelskis/lapasid/scripts/audit-lt-names-pollution.mjs` (run-once safe; pure JSON parsing)
- **Build script'as:** `/Users/kestutissmigelskis/lapasid/scripts/build-lt-names.mjs`
- **Master data:** `/Users/kestutissmigelskis/lapasid/data/lt-names.json` (48716 eilučių)
- **Šaltiniai:**
  - `/Users/kestutissmigelskis/lapasid/data/gaspadorius-detail.json` (217 porų, 83 multi-word)
  - `/Users/kestutissmigelskis/lapasid/data/inat-names.json` (cross-genus „Sanpaulija" Streptocarpus atveju)
  - `/Users/kestutissmigelskis/lapasid/data/derlingas-pairs.json`
  - `/Users/kestutissmigelskis/lapasid/data/sodospalvos-names.json`
  - `/Users/kestutissmigelskis/lapasid/data/lt-names-wiki.json`
  - `/Users/kestutissmigelskis/lapasid/data/plants.json`
