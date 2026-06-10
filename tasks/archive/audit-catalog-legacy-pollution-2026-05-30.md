# Catalog Legacy Pollution Audit — 2026-05-30

Statusas: **Planuojama** — script'as parašytas, NEPALEISTAS (user'is rm'ino
`.env.local`, credentials reikia atstatyti prieš run'inant).

## 1. Executive Summary

Šiandien (2026-05-30) į produkciją pateko 4 fix'ai, kurie užkardo NAUJUS
sugadintus catalog'o įrašus:

| Fix | Commit | Užkarda |
|---|---|---|
| Vendor echo ban | `024a756` | AI nebegrąžins vendor name'ų (pvz. „Dracaena aubrytiana 'Nite Lite'") kaip accepted name'ų |
| Species-qualified genus fallback | `f7a7b4e` | `Sansevjera zeylanica` vietoj bare `Sansevjera` |
| Sinonimai cross-species pollution | `6b330fb` | `sinonimai` nebeturės kitos rūšies LT vardų (`Sansevjera trijuostė` neatsiras Sansevieria zeylanica įraše) |
| LT name strict convention | `ed0707a` | AI nebegrąžins istorinių/vernacular pavadinimų kaip primary name'ų („kanapė" Sansevieria atveju) |

**LEGACY įrašai, save'inti PRIEŠ šituos fix'us, vis dar gali turėti šias
problemas.** Catalog yra cross-user (vienas docId per Latin name, visi
vartotojai naudoja tą patį referenc'ą per `resolvePlantView`), tad blogas
įrašas pollute'ina visus naujus user'ius.

Šis audit'as suklasifikuoja įtartinus catalog'o įrašus į keturias kategorijas
ir leidžia priimti pagrįstą sprendimą, kaip valyti.

### Tikėtinas mastas (UNKNOWN — script'as dar nepaleistas)

Kataloge dabar ~500-2000 įrašų (CATALOG_LIMIT). Be realių skaičių —
estimate'ai paremti prieš tai daryto audit'o duomenimis ir bug'ų gyvavimo
laikotarpiu:

- **vendor-echo suspected**: estimuojama ~5-30 įrašų. Bug'as buvo specifinis
  ir reikalavo, kad user'is pateiktų vendor query'ą. Daugumai user'ių
  tipinis flow'as (žinomos rūšys) jo nepataikė.
- **genus-only fallback bug**: po commit'o `1933fe4`
  (fix-genus-fallback-names.mjs) dauguma turėjo gauti vardus iš plants.json.
  Liko įrašai be plants.json mappingo — estimuojama ~10-40 įrašų.
- **kanapė-style hallucination**: tipiškai retas (specifinė
  kalbinė/istorinė hallucination). Estimate ~5-20.
- **cross-species sinonimai**: bug'as gyvavo neilgai (atsirado kartu su
  f7a7b4e regression'u tame pačiame day session'e ir pataisytas 6b330fb).
  Estimate ~5-15.

**SVARBU**: visi šie skaičiai yra spėjamų rezultatų estimate'ai. Tikslūs
skaičiai bus žinomi tik po script'o paleidimo.

## 2. Catalog Schema — Pollution-Relevant Fields

`/Users/kestutissmigelskis/lapasid/src/utils/catalog.js` aprašo catalog
įrašo struktūrą. Pollution liečia šiuos field'us:

| Field | Tipas | Pollution forma |
|---|---|---|
| `lotyniskas` (`latinName`) | string | Vendor name (pvz. `Dracaena aubrytiana 'Nite Lite'`), genus-only įrašas turintis cultivar pavadinimą, garbled epithet. Doc ID generuojamas iš jo per `catalogDocId()` → polluted Latin → polluted docId, ir blogas docId LIEKA net jei vėliau pataisysim `lotyniskas` field'ą. |
| `lietuviškas` (`name`) | string | (a) Genus-only fallback kai turi būti species-qualified. (b) Hallucinated word'as (kanapė, ąžuoliukas, palmė…) priklausantis kitai genčiai. |
| `sinonimai` | string[] | Cross-species/cross-genus LT vardai iš senų `ltAllForms` šaltinių (Sansevieria įrašas turi „Sansevjera trijuostė" = trifasciata, ne zeylanica). |
| `ltSynonyms` (AI source) | string[] | Save flow'as šitą merge'ina į `sinonimai` ir delete'ina (`save-plant.js:369`). Tad catalog'e neturėtų egzistuoti, BET legacy įrašuose iš seno flow gali būti likę. |
| `englishNames` | string[] | Šiuo audit'u neliečiame — pollution būtų atskira tema. |
| `ref` (per-plant snapshot) | object | F2 freeze-on-death pattern — mirę augalai turi įšaldytą snapshot'ą įdėtą į user-plant doc'ą. Audit'as NEAPDOROJA user-plant kolekcijų; jei mirę augalai turi polluted ref, tai atskira tema. |

### Plant write paths (kur ir kaip catalog'as gauna duomenis)

1. **`POST /api/save-plant` → `processPlant`** (`api/save-plant.js`):
   - Phase 2 AI call → `normalizeAIResponse` → spread į `fullPlant` →
     `saveCatalogWithParentServer(fullPlant)`.
   - `fullPlant.lietuviškas = name` (iš client'o request'o, kuris paima
     baseResult'o LT name'ą — t.y. PASKUTINIO POINT'O išvada).
   - `fullPlant.sinonimai` = baseResult'o sinonimai + AI `ltSynonyms` merge
     (dedup'inta).
   - **Pataisymai veikia per `baseResult` (preDb) + AI prompt** — todėl po
     šiandienos commit'ų NAUJAS save → švarus įrašas.

2. **`saveToCatalog` (client)** (`src/utils/catalog.js:360`):
   - Naudojamas senesniame client-side save flow'e (pre-Variant B) ir
     `catalogPreviewUpsert`.
   - Merge: `setDoc(..., { merge: true })` — naujas blogas write
     OVERWRITE'INS field'us, tad pollution gali grįžti jei user'is su senu
     client'u būna online (mažai tikėtina po deploy'o, bet teoriškai).

3. **Admin Biblioteka edit** — direct setDoc, gali pravalyti rankiniu būdu.

### Doc ID generation rizika

`catalogDocId()` ima `lotyniskas` ir normalizuoja į slug'ą. Jei `lotyniskas`
yra polluted (pvz. `dracaena_aubrytiana_nite_lite`), doc ID irgi polluted.
**Per `setDoc({merge:true})` field'ų pataisymas NEPATAISO doc ID.** Norint
pataisyti doc ID, reikia create-and-delete (sukurti naują doc su švariu ID,
perkelti turinį, ištrinti seną). Tai svarbu Strategy A/C aptarime.

## 3. Audit Script — Usage

**Script:** `scripts/audit-catalog-legacy-pollution.mjs`

### Credentials (BŪTINA prieš run'inant)

User'is rm'ino `.env.local` — credentials reikia atstatyti vienu iš trijų
būdų:

**Variantas A — atstatyti `.env.local` iš Vercel:**

```bash
cd /Users/kestutissmigelskis/lapasid
vercel env pull .env.local
# Patikrinti, kad FIREBASE_SERVICE_ACCOUNT yra faile:
grep FIREBASE_SERVICE_ACCOUNT .env.local
```

**Variantas B — inline:**

```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
  node scripts/audit-catalog-legacy-pollution.mjs
```

**Variantas C — Application Default Credentials:**

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
  node scripts/audit-catalog-legacy-pollution.mjs
```

### Run

```bash
# Žmogui skaitomas output (default):
node --env-file=.env.local scripts/audit-catalog-legacy-pollution.mjs

# JSON output downstream tool'ams arba diff'ams tarp run'ų:
node --env-file=.env.local scripts/audit-catalog-legacy-pollution.mjs --json > audit-2026-05-30.json

# --apply flag yra NO-OP placeholder (ateičiai, kai admin'as nori
# žymėti įrašus per `needsManualReview: true`):
node --env-file=.env.local scripts/audit-catalog-legacy-pollution.mjs --apply
```

### Tikėtinas runtime

~5-30s — vienas full collection read iš Firestore (~500-2000 docs),
local reference data load'as (pre-db.json ~3MB, lt-names.json ~1.5MB).

### Output format (žmogui)

```
=================================================
CATALOG LEGACY POLLUTION AUDIT
=================================================
Scanned at:     2026-05-30T...
Total entries:  N

Category counts (strong signals only):
  vendor-echo suspected:       X  (weak: Y)
  genus-only fallback bug:     X  (weak: Y)
  hallucination-style names:   X
  cross-species sinonimai:     X
  missing latinName:           X
  missing lietuviškas:         X

--- Samples: vendorEchoSuspected (max 10) ---
  • dracaena_aubrytiana_nite_lite
    latin: Dracaena aubrytiana 'Nite Lite'
    lt:    Dracaena
    reason: vendor-marketing-cultivar
    ...
```

`weak` = silpnesnis signal'as (pvz. genus žinomas, BET species ne
mūsų pre-DB'e — gali būti legitimate, gali būti garbage). Šitie neeina į
sample'us, tik į skaičius.

### Output format (JSON)

```json
{
  "meta": { "scannedAt": "...", "totalEntries": N, "credentialSource": "...", "flagApply": false },
  "categories": {
    "vendorEchoSuspected": { "count": N, "weak": N, "samples": [...] },
    "genusOnlyBug":         { "count": N, "weak": N, "samples": [...] },
    "hallucinationLikely":  { "count": N, "samples": [...] },
    "crossSpeciesSinonimai":{ "count": N, "samples": [...] },
    "missingLatinName":     { "count": N, "samples": [...] },
    "missingLtName":        { "count": N, "samples": [...] }
  }
}
```

### Klasifikatorių heuristika (svarbu suprasti, kad išvengtum false-positive'ų)

- **vendor-echo**: 3 signal'ai sumuojami → `unknown-genus` (strong),
  `vendor-marketing-cultivar` (strong, regex `nite|lite|silver|gold|pearl|royal|mystic|fantasy|magic|wonder`), `species-not-in-predb` (weak).
- **genus-only-fallback**: latin turi 2+ žodžius (species/cultivar rank),
  `lietuviškas` turi 1 žodį IR tas žodis atitinka `lt-names.json` genus
  entry `ltName`. Weak case'as kai genus LT nežinoma.
- **hallucination**: HARDCODED `HALLUCINATION_GENUS_WORDS` map'as
  (kanapė→CANNABIS, ąžuolas→QUERCUS, beržas→BETULA, pušis→PINUS,
  eglė→PICEA/ABIES, liepa→TILIA, klevas→ACER, kaštonas→AESCULUS/CASTANEA,
  rožė→ROSA, tulpė→TULIPA, lelija→LILIUM, pelargonija→PELARGONIUM).
  „palmė" ir „orchidėja" SĄMONINGAI IŠJUNGTOS — per platūs žodynai
  (Arecaceae/Orchidaceae yra šeimos, ne gentys).
- **cross-species-sinonimai**: sinonimai turi 2+ žodžių LT name'ą, kurio
  reverse lookup (per `species-lt-names.json` + `plants.json`) duoda kitą
  binomial'ą nei įrašo `lotyniskas`. Stipriausias signal'as — visiškai
  KITAS genus (`cross-genus`), silpnesnis — tas pats genus, kita rūšis
  (`cross-species`).

False-positive rizikos:
- AI legitimately gauna LT vardą, kurio nėra mūsų plants.json (priklauso
  nuo training data kokybės). Bus klaidingai pažymėtas „weak vendor".
- Vienžodis LT name'as gali būti legitimate user-override'as (pvz. user'is
  nori savo plant'ą vadinti „Mama"). Šitie eis į „missing/weak" — sample
  duomenis žiūrint, akivaizdu, ar tai pollution, ar custom.

## 4. Cleanup Strategies

### Strategy A — Auto-fix (RIZIKINGA)

Script'as patenkant į suspect kategorijas iškart pataiso įrašą:
- `genus-only-bug`: rewrite `lietuviškas` į `[genus LT] [epithet]`
  (mirror'as `resolveLt` species-qualified path'o).
- `cross-species-sinonimai`: filter out kross-genus/cross-species
  įrašus iš `sinonimai`.
- `hallucination`: pakeičia LT name'ą į genus LT vardą iš
  `lt-names.json` (gali pridėti epithet po Strategy A logikos).
- `vendor-echo`: REIKIA AI re-identification — auto-fix nepritaikoma
  saugiai, nes nežinom, koks turi būti accepted name.

**Pro:** vienu run'u išvalo daugumą polution'o.

**Con / rizikos:**
- Net pataisius `lietuviškas` field'ą, **doc ID lieka polluted** —
  user'iai vis tiek matys jį per `_id`. Jei docId yra `dracaena_aubrytiana_nite_lite`, search'as tą pačią rūšį „Dracaena trifasciata 'Nite Lite'" rems į naują doc (good doc ID), o senas tampa orphan'u.
- Auto-fix gali sulaužyti legitimacy edge case'us (vienžodžiai vardai,
  kuriuos kažkas rankiniu būdu pridėjo per Admin Biblioteką).
- Auto-fix nereversabili be backup'o.
- Nėra QA loop — jei klaidos plinta, jas bus sunku rasti vėliau.

**Vertinimas:** NEREKOMENDUOJU savaime, NEBENT pirmiau atliekam ribotą pilot
(N=5-10 įrašų, manual review po apply).

### Strategy B — Flag-for-review (SAUGI, BET LĖTA)

Script'as su `--apply` pažymi suspect įrašus `needsManualReview: true`
flag'u (+ struktūrizuota `reviewReason` su category ir details). UI
Admin Bibliotekoje filtruoja pagal šitą flag'ą — admin'as vienu kliku
review'ina, sutaiso, ar tvirtina (`needsManualReview: false`).

**Pro:**
- Zero data loss rizikos — niekas neperrašoma be admin'o akivaizdumo.
- Audit'as palieka audit trail Firestore'e — kitas run'as gali žinoti, ką
  jau review'inom.
- Galima palaipsniui kalibruoti detection heuristikas (žiūrėti, kiek
  flag'intų pasirodo legit).

**Con:**
- Reikia Admin Bibliotekos UI extension'o (read-only flag'as → batch
  review screen). Nedidelis darbas, bet darbas.
- Lėtas — admin'as turi rankiniu būdu pereiti per kiekvieną įrašą.
- Doc ID pollution lieka neišspręsta (flag'as nepervadina doc'o).

**Vertinimas:** GERIAUSIAS COMPROMISE'AS. Pradėti nuo flag'inimo, ateityje
build'inti Admin review UI ir/arba kombinacija su Strategy C konkretiems
high-confidence atvejams.

### Strategy C — Targeted nuke + re-search (SURGINĖ)

Tik HIGH-confidence pollution'ui (specifiškai `hallucinationLikely`
kategorija — kanapė/ąžuolas-stiliaus, kur 100% žinom, kad blogai):

1. Script'as identifikuoja įrašus.
2. Admin'as patvirtina (žiūri sample'us, scan'ina visus).
3. Delete catalog doc'ą.
4. User-plants, kurie referenc'ino šitą doc'ą per `catalogId`, automatiškai
   fall back'ina į inline `plant.ref` snapshot'ą (žiūr.
   `resolvePlantView` logiką). Jei snapshot'as ir-gi polluted (legacy
   freeze-on-death), reikia atskirai handle'inti.
5. Sekantis search'as toks pat Latin name'ui sukurs naują švarų catalog
   entry per dabartinį (pataisytą) flow'ą.

**Pro:**
- 100% švari rezolucija — naujas docId, naujas content, naujas AI
  re-derivation.
- Doc ID problema išspręsta natural'iai.

**Con:**
- Reikalauja, kad kažkas vėl search'intų tą Latin name'ą — kitaip
  permanent „šios rūšies neturim" iki kito spontaneous search'o.
- Mirę augalai (refFrozen=true) NEBE-fetch'ins live catalog'o, todėl
  jiems pollution pasilieka per `plant.ref` (atskira tema).
- Reikalauja sąmoningos admin akcijos kiekvienam.

**Vertinimas:** TINKAMIAUSIA `hallucinationLikely` kategorijai, kur
confidence aukšta.

## 5. Recommended Approach

**Žingsniai (incremental risk):**

1. **Paleisti audit'ą** su atstatytais credentials (Vercel env pull
   variantas tikriausiai paprasčiausias).
   ```bash
   vercel env pull .env.local
   node --env-file=.env.local scripts/audit-catalog-legacy-pollution.mjs --json > audit-2026-05-30.json
   ```

2. **Manual review sample'ų** kiekvienoje kategorijoje (10 per kategoriją
   max). Patvirtinti, kad heuristikos veikia gerai → kalibruoti
   `HALLUCINATION_GENUS_WORDS`, `VENDOR_MARKETING` regex'ą jei matos
   false-positive'ai.

3. **`hallucinationLikely` → Strategy C** (targeted nuke). Šitie yra
   100% pollution (kanapė Sansevieria įraše = neabejotinas bug'as).
   Maža N (estimate 5-20), admin'as gali peržiūrėti rankomis ir delete'inti
   via Firebase console arba scriptu.

4. **`genusOnlyBug` strong cases → Strategy A** SU PRECONDITION:
   prieš tai backup'inti catalog'ą. Auto-fix saugus, nes mes turim
   deterministinį `[genus LT] [epithet]` rule'ą (mirror'as production
   resolveLt logic).
   - Backup variantas: `gcloud firestore export gs://geliu-db-backups/catalog-pre-cleanup-2026-05-30`
   - Po apply — sanity check'as: ar suspect count'as nukrito iki 0?

5. **`crossSpeciesSinonimai` → Strategy A** (saugesnė nei #4, nes
   `sinonimai` yra additive metadata; klaidingai pašalintas legit synonym
   nesulaužys UI/search'o, tik nukris discoverability).

6. **`vendorEchoSuspected` → Strategy B** (flag-for-review). Šitie
   reikalauja AI re-identification — nepritaikoma auto-fix saugiai.
   Build'inti Admin UI flag'ų review'inimui kaip atskirą task'ą.

7. **`weak` skaičiai (vendor + genus-only weak)** — palikti rankiniam
   reviewui ateityje. Jie per-noisy auto-actionui.

### Rizikos matrica

| Strategija | Reversibility | Effort | Risk |
|---|---|---|---|
| Audit-only (no apply) | N/A | 5min | žero |
| Strategy A (auto-fix) | Reikia backup'o | 1h | mid (gali sulaužyti edge cases) |
| Strategy B (flag) | Pilna | 1h apply + Admin UI work | low |
| Strategy C (nuke) | Sunki — user'iai jau matė šituos | 2h (manual) | mid (orphan user-plant ref'ai) |

### Atviras klausimas

`resolvePlantView` overlay'ina LIVE catalog reikšmes ant inline
plant.ref/inline laukų. Jei catalog'e pataisom įrašą per Strategy A,
**visi user'iai, kurie auginant šitą rūšį, iškart pamatys naują vardą**
(no client cache invalidation needed — onSnapshot push'ins delta'ą). Tai
gerai (greitas heal'inimas), BET reiškia, kad user'is gali pamatyti
„mano augalas anksčiau buvo Sansevjera, dabar Sansevjera zeylanica"
viduryje dienos be jokio veiksmo iš jo pusės. UX nuoroda: tikriausiai
verta toast'o „atnaujinome rūšies vardus mūsų katalogue".

## 6. Files Touched

- **Created**: `/Users/kestutissmigelskis/lapasid/scripts/audit-catalog-legacy-pollution.mjs`
- **Created**: `/Users/kestutissmigelskis/lapasid/tasks/audit-catalog-legacy-pollution-2026-05-30.md` (šis dokumentas)

## 7. Next Action

User'iui — atstatyti `.env.local` (per `vercel env pull`) ir paleisti
audit'ą --json mode (žr. §3). Po realių skaičių grįžti į šitą doc'ą ir
nuspręsti, kurią Strategy kombinaciją taikom (rekomendacija — §5).
