# „+ Visa serija" bulk save — strateginis permąstymas

**Data:** 2026-05-30
**Tikslas:** Background research before a design conversation. Read-only —
jokio kodo keitimo, jokio sprendimo, tik medžiaga pokalbiui.

Šaltiniai:
- `src/components/SearchModal.jsx` (TOOL_BULK_SERIES @ L471, `bulkSaveSeries` @ L1569, render @ L2625)
- `src/utils/taxonGroups.js` (`saveCatalogWithParent`, `mergeWithSeries`, `MAX_BULK_BATCH=25`)
- `src/components/admin/LibraryEditorV2.jsx` (3-level hierarchy: genus → series → cultivar)
- `src/components/admin/AdminPanel.jsx` (4 tabs: users / collections / library / invites)
- Single-save flow: `fetchDetails` @ L561 — RAG + D-strict toxicity + per-cultivar narrative

---

## 1. Current state — kur gyvena ir ką daro

### 1.1 Kur atsiranda mygtukas

`SearchModal.jsx` L2629-2638. Atsiranda kai `result.candidates.length >= 2` — t. y.
kai AI grąžino bent 2 disambiguation kandidatus (cultivar serija arba similar
species). Visualinis stilius — outline, secondary (ne pagrindinis CTA), po
„Kitos galimybės" sąrašo.

```jsx
{result.candidates.length >= 2 && (
  <button onClick={() => bulkSaveSeries(query.trim() || result.latinName, result.candidates)}>
    + visa serija ({MAX_BULK_BATCH} cv · ~$0.10)
  </button>
)}
```

### 1.2 KRITIŠKAS RADINYS — mygtukas **NĖRA admin-only**

Inline comment'as @ L2625 sako „Admin bulk save", `bulkState` description @ L1453
sako „kai admin'as save'ina visus serijos cultivars'us", BET:

- `SearchModal` importuoja `useAuth` tik dėl `collectionId` (L3379), `isAdmin`
  nenaudojamas niekur faile
- Nėra jokio `user.isAdmin && ...` conditional'o aplink button'ą
- Bet kuris vartotojas, kuris atidaro paiešką ir AI grąžina >=2 kandidatus,
  matys „+ visa serija" mygtuką

Tai gali būti:
- a) sąmoninga, bet komentarai pasiliko iš anksto admin-only plano (regresija
  ar nutekėjimas)
- b) bug — turėjo būti gated, niekas to nepastebėjo

Bet kokiu atveju — vartotojui kyla klausimas „kodėl man siūlo importuoti 25
augalus į katalogą, kai aš tik bandau identifikuoti vieną?" — atitinka jo
„kodėl čia siūlo o kitur ne" jausmą.

### 1.3 Flow apžvalga (`bulkSaveSeries` @ L1569)

1. **AI call** (`TOOL_BULK_SERIES`, web_search max 3 use):
   - Vienas Claude call'as su ~8000 maxTokens — grąžina `series` block
     (shared atributai) + `cultivars` array (iki 25)
   - System prompt'as = `PLANT_SYSTEM` (NĖRA `VOICE_PERSONA`, NĖRA RAG context'o,
     NĖRA `RAG_PRIORITY_INSTRUCTION`)
2. **Save series doc** į `taxonGroups` collection'ą (vienas Firestore write)
3. **Per-cultivar fetch + save (lygiagrečiai)**, kiekvienam:
   - `fetchBraveImage → fetchInatCultivarImage → fetchWikiThumbnail` (image chain)
   - `fetchWikidataPlant(latinName)` (verification)
   - `saveCatalogWithSpeciesParent(entry)` — saugoma su `verificationStatus: 'auto-verified'`
4. **„Done" state** → BulkSaveOverlay rodo picker'į (sortinta pagal LT vardą)
   su „+ Pridėti" mygtuku kiekvienam → klikinus iškviečiamas `handleCatalogAdd`
   → tas vartotojo augalas tampa jo kolekcijos dalimi (`mergeWithSeries` —
   inherit'ina care info iš serijos)

### 1.4 Kainos / greitis

- 1 AI call vs 25 (single-save flow) — ekonomika reali, ~$0.10 vs ~$2.50
- Bet visa kaina krenta uždedant 25 catalog entries, kurių vartotojas tikriausiai
  niekada nematys (jis ieškojo VIENO augalo)

---

## 2. Kokybės findings — kas SKIRIASI nuo single save

Tai pati svarbiausia dalis pokalbiui. Skirtumas didelis:

### 2.1 Single save (`fetchDetails` @ L561) **TURI**:

1. **RAG context'as** (`buildPlantRagContext`) — surinkti faktai iš pre-DB
   + PFAF + ASPCA + Cheng + Wikipedia, paduodami kaip system prompt'as
2. **D-STRICT toxicity** (`deriveToxicityFromSources`):
   - Deterministinis hazard check iš MŪSŲ ASPCA/PFAF DB
   - AI narrative — translator, ne creator
   - `aiSupplementaryHazard` gap-fill su whitelist + hospitalization bar
3. **VOICE_PERSONA** + `RAG_PRIORITY_INSTRUCTION` (consistent LT tonas)
4. **TOOL_DETAILS** schema verčia AI:
   - `idomybes` (2-3 LT sakiniai)
   - `problemos` (3-5 simptomas/sprendimas pairs)
   - `dauginimas` (2-4 metodai)
   - `prieziura` narrative — 4 LT lauks (sviesa/laistymas/temp/dregme)
5. **`verificationStatus` logika su Phase 2 upgrade** — jei `aiConfidence='high'`
   ir `!fallbackInfo` → `auto-verified`. Jei ne → `unverified` (admin
   review).

### 2.2 Bulk save (`bulkSaveSeries` @ L1569) **NETURI**:

| Safeguard | Single save | Bulk save |
|---|---|---|
| RAG context (PFAF/ASPCA/Cheng) | TAIP | **NE** |
| D-strict toxicity per-cultivar | TAIP | **NE** (savybes apima series-level — bet cultivars often turi skirtingą bloom-time pollen alergiją etc.) |
| VOICE_PERSONA prompt | TAIP | **NE** (tik PLANT_SYSTEM) |
| idomybes per augalą | TAIP | TIK series-level (visi cultivars dalinasi tomis pačiomis 2-3) |
| problemos / dauginimas per augalą | TAIP | TIK series-level |
| Phase 2 enrichment kai vartotojas „+ Pridėti" | TAIP (per `fetchDetails`) | **NE** — `handleCatalogAdd` daro tik `mergeWithSeries`, neenriching |
| Wikidata verification | TAIP | TAIP (`fetchWikidataPlant`) |
| `verificationStatus` upgrade logika | TAIP — gali pasilikti 'unverified' | Visada **`auto-verified`** (HARDCODED L1645, L1716) |

### 2.3 Hallucination risk — kritiškas

**TOOL_BULK_SERIES** prašo AI „Surašyk VISUS žinomus cultivars (iki 25)". Tai
yra **list-completion task** — AI'ui yra natūralus stimulas pildyti maximum
quota'ą (25), o ne pasakyti „aš tikrai žinau tik 6". Klaidingi cultivar names'ai
patenka tiesiai į katalogą kaip `auto-verified`.

Egzistuoja minor mitigacija:
- `web_search max_uses=3` — gali patikrinti RHS / breeder svetainę
- Wikidata verification per-cultivar (`wikidataVerified` flag'as save'ojant)

Bet `wikidataVerified=false` nestabdo save'o — entry'is vis tiek saugomas
`auto-verified` statuse. Vartotojas atidarys library ir matys 25 entries su
forest checkmark badge'iu, iš kurių gal 5 yra fake cultivars'ai.

### 2.4 „Auto-verified" semantikos drift'as

`verificationStatus: 'auto-verified'` REIKŠMĖ pradžioje (žiūr. `plantTransform.js`
L334): `aiConfidence === 'high' && !fallbackInfo`. T. y. „AI labai užtikrintai
identifikavo, mes pasitikim".

Bulk path'e `'auto-verified'` HARDCODED'inta, NIEKADA nepatikrinta'. Vienas
status — du visiškai skirtingi quality bar'ai. Tas pats badge'as Library tab'e
nereiškia to paties.

---

## 3. Use case mapping — kur bulk save **galėtų** turėti prasmę?

### 3.1 Search result (current placement) — KAM TINKA?

**Pro:** AI ką tik atpažino, kad užklausa yra serija — natural moment'as siūlyti
„noriu visos"

**Con:**
- Vartotojo intent'as paprastai: „aš turiu šitą konkretų augalą — noriu jį
  pridėti". Pridėti 25 augalus į katalogą yra **nelaukiama** šalutinė pasekmė.
- Catalog yra `tenant-wide` (visiems vartotojams matomas per `searchCatalog`).
  Vienas vartotojas, save'inęs „visą Boulevard seriją", pakeičia kitų vartotojų
  paieškos autocomplete'ą.
- 25 entries su skirtinga kokybe sukuria nuolatinį admin review burden'ą.

**Verdict:** Šiandien — tinka tik admin'ui kuriam reikia greitai užpildyti
katalogą. Vartotojui — neaiški value, „+ visa serija" yra noise.

### 3.2 AdminPanel — yra ar tinkamas namas?

`AdminPanel` šiandien turi 4 tabs: `users / collections / library / invites`.
Library tab'as (`LibraryEditorV2`) jau atvaizduoja 3-level hierarchiją (genus →
series → cultivars) ir leidžia EDIT'inti. Bet — **NĖRA** „add series" entry
point'o iš admin'o. Vienintelis būdas pridėti seriją yra paspausti „+ visa
serija" SearchModal'e kaip įprastas vartotojas.

**Idealus admin flow būtų:**
1. Library tab'e: „+ Import series" mygtukas
2. Input: serijos pavadinimas („Clematis Boulevard")
3. AI surenka kandidatus → **review queue** (NE iškart save'as)
4. Admin akimis perziuri kiekvieną cultivar, žymi keep/discard/edit
5. Save'ina tik patvirtintus su `verificationStatus: 'auto-verified'`

`taxonGroups` infra jau yra — tik UI orchestrate'oriaus nėra.

### 3.3 Library tab (vartotojui) — bulk save iš known series?

Library tab'e (vartotojo apps'e) galėtų būti „Looking for cultivars of X?"
discovery widget'as. Bet:
- Tai duplikuoja paieškos funkciją
- Vartotojui retai reikia „pridėti visus" — jis turi konkretų augalą
- Quality concerns tas pats kas search'e

**Verdict:** netinka. Library yra browse/manage, ne import.

### 3.4 Single plant detail — „pridėti kitas atmainas"?

Plant detail rodo VIENO augalo info. Šiandien NĖRA „kitos serijos atmainos"
sekcijos (patikrinau `PlantDetail.jsx` — jokio `_seriesId`/`taxonGroupId` cross-
reference UI). Galima būtų pridėti „Iš serijos Boulevard — žiūr. 19 cultivars'ų",
BET tai yra discovery, ne bulk save.

Bulk save ant single plant detail = „pridėti visus brolius/seseris į katalogą"
— vartotojo žvilgsnio tai random ir invazyvu.

**Verdict:** netinka. Bet „žiūr. kitas atmainas" link'as (read-only, naviguoja
į admin-kuratorintą series page'ą) — tai SEPARATE feature, verta apsvarstyti.

---

## 4. Trys placement opcijos

### Option A — Likti kur yra, BET sutankinti quality

**Pakeitimai:**
1. **Admin-only gate** — `useAuth().isAdmin` check'as prie button render'o
   (5 min darbo). Komentaras jau tai sako, bet kodas to nedaro.
2. **Preview state vietoj instant-save** — AI grąžinta sąrašą rodome
   modal'e su checkbox'ais. Admin uncheck'ina hallucinated'us
   cultivar'us prieš save. Tas pats schema'oje, kitas UI šaltinis.
3. **Quality bar `verificationStatus`** — bulk path'ui pavadinti `'bulk-auto'`
   ar `'auto-unreviewed'`, ne `'auto-verified'`. Library tab UI vizualiai
   atskirtų badge'u „needs admin review".
4. **Per-cultivar enrichment kai vartotojas „+ Pridėti"** — `handleCatalogAdd`
   bulk-saved entries atveju kviestų `fetchDetails` (full RAG + D-strict
   toxicity). Pirmas vartotojas, pridėjęs konkretų cultivar, gauna full
   quality. Bulk save'as lieka tik kaip „placeholder catalog scaffold".

**Pliusai:**
- Mažas darbas, maksimalus existing infra reuse
- Iškart sutvarko admin-leak problemą
- Quality concern dingsta, nes catalog entry'iai promote'inami iš
  `bulk-auto → auto-verified` per single save flow

**Minusai:**
- Vis dar admin'o instinktas — „kodėl admin daro tai search'e?". Search
  paskirtis yra rasti VIENĄ augalą, ne admin'o batch tool'as
- Du UI mode'ai tame pačiame modal'e (search + bulk import)

**Pastangos:** ~3-5 h
**Rizika:** žema (additive, ne refactor)

---

### Option B — Perkelti į AdminPanel kaip dedicated tool

**Naujas Library tab'o action: „+ Importuoti seriją"**

**Flow:**
1. Library tab → toolbar'e „+ Importuoti seriją" mygtukas (admin-only)
2. Modal: input „serijos pavadinimas" (free text) ARBA „genus" autocomplete
3. AI gauna `TOOL_BULK_SERIES` call — grąžina seriją + cultivars
4. **Review queue UI** (split view):
   - Left: kandidatų sąrašas su checkbox'ais, default'iškai checked tik
     `wikidataVerified=true` cultivars
   - Right: pasirinkto cultivar preview (image + distinguishingFeature +
     bloom info)
   - Admin gali edit'inti latinName, distinguishingFeature, attach photo
5. „Saugoti pasirinktus" mygtukas → tik patvirtinti entries patenka į catalog
6. Series doc save'inamas su `verificationStatus: 'expert-verified'` (admin
   touch'ino), cultivars — `verificationStatus: 'auto-verified'`

**Pliusai:**
- Aiški atsakomybės atskirtis: search = identifikavimas, admin = curation
- Vartotojas niekada nematys „+ visa serija" — search UI lieka švarus
- Quality gate'as įmontuotas į flow'ą (review queue)
- `LibraryEditorV2` jau turi 3-level hierarchy UI — bulk import natūraliai
  įlieja į esamą medį

**Minusai:**
- Daug daugiau darbo nei Option A (~12-20 h)
- Reikia naują „review queue" komponentą
- Admin žmonės turi atskirai eiti pas seriją kurią matė search'e
  (= context-switch)

**Pastangos:** ~12-20 h
**Rizika:** vidutinė (naujas UI komponentas, naujas state machine)

**Mitigacija šalutiniams projektams:** SearchModal'e galima palikti
„Žiūr. seriją admin'e" link'ą (kai AI grąžina cultivarsExist=true) — nukreipia
admin'ą į Library → series creation, su pre-filled input'u. Maintains
context, atskiriame intent'us.

---

### Option C — Pašalinti visiškai

**Argumentai už:**

1. **Kokybės skirtumas didžiulis.** Bulk save praleidžia RAG + D-strict
   toxicity + per-cultivar narrative. Tai yra MŪSŲ #1 tikslo — tikslumas —
   tiesioginis pažeidimas (žiūr. MEMORY.md / project_accuracy_goal.md).
2. **Hallucination amplifier.** „Iki 25" cultivars'ų stimulas + jokio
   factual grounding = fake names patenka į katalogą kaip `auto-verified`.
3. **Misleading badge'as.** `'auto-verified'` reiškia du skirtingus dalykus
   priklausomai nuo šaltinio — quality signal degradacija.
4. **Vartotojo intent mismatch.** Vartotojas ieško VIENO augalo, gauna 25 į
   katalogą — confusing.
5. **Admin'as gali tą patį daryti vienetiniu save'u** — paspausti per kandidatą,
   single save flow'as veikia (high quality). Lėčiau, bet teisingai.
6. **„Long-term TODO" framework'as = bandaid"** (lessons.md @ 2026-05-27) —
   palaikyti suboptimal feature'į „nes jau yra" yra tas pats anti-pattern'as.
7. **Backlog/audit'as nemini bulk save'o** kaip kritinio. Jis nebuvo pillar
   feature, jis buvo eksperimentas.

**Argumentai prieš:**

1. **Investicija jau įdėta** — TOOL_BULK_SERIES schema + saveTaxonGroup
   pipeline + BulkSaveOverlay UI = ~2-3 dienos darbo. Trinti skausminga.
2. **`taxonGroups` infra naudinga ir be bulk save'o** — single save flow'as
   irgi kuria parent series doc'us per `ensureParentTaxonGroup` (žiūr.
   `taxonGroups.js` L195). Jei reikės kada nors atstatyti — schema lieka.
3. **Lyginant su admin manual save** — admin'ui realiai gali užimti 25× ilgiau
   pridėti visus Boulevard cultivars'us po vieną.
4. **Galbūt verta perduoti kaip „backlog" feature**, ne ištrinti — jei kada
   nors prireiks didelio catalog seeding'o (pvz. partnerystė su daigynu),
   galima reanimuoti.

**Praktinis pašalinimas:**
- Trinti tik `bulkSaveSeries` + button render @ L2625-2638 + `BulkSaveOverlay`
  (~150 LOC) — schema'ą (`TOOL_BULK_SERIES`) palikti, nes ją reference'ina
  kiti komentarai ir ji nedaro žalos, jei niekas nekvieča
- `taxonGroups.js` infra LIEKA — naudoja single save flow

**Pastangos:** ~1 h
**Rizika:** žema (delete-only, nesujungia su kuo nors)

---

## 5. Rekomendacija

**Hybrid: Option C (remove from search) + lengva Option B versija (admin queue minus bulk AI).**

### Argumentai:

1. **„+ visa serija" SearchModal'e PAŠALINTI iškart.** Tai yra:
   - admin-leak (gated reklamai, bet neapsaugotas kodu)
   - vartotojo intent mismatch
   - quality concern (autoverified ≠ verified)

2. **Admin'o realus poreikis išliks** — kaip užpildyti katalogą su žinomais
   cultivar'iais? Atsakymas: per single save flow'ą per kandidatų sąrašą
   SearchModal'e. Tas pats AI call'as, geresnė kokybė, lėčiau (5× lėčiau)
   bet teisingai. Kol catalog'as nepasieks ~200 entries, manual'us darbas
   tempu (~25 augalai per savaitę).

3. **NE statyti pilno review-queue admin tool'o DABAR.** „Long-term TODO"
   bandaid risk. Pirma — pažiūrėt ar admin'ui realiai kuria pain'ą po
   pašalinimo. Jei taip — tada Option B kaip 2-week sprint.

### Kodėl ne Option A?

Option A (tighten in place) reikalauja admin gate + preview + status downgrade
+ promote-on-add — tas pats ~10h darbo kiekis kaip Option B mini-version'ai,
bet su feature, kurio strateginė vertė nepatvirtinta. Statome komplikaciją
ant suabejotinio feature'o.

### Rizikos vertinimas (pašalinant)

- **Žemo dydžio:** bulk save'as nėra core flow. Jo nebuvimas neuždraus admin'o
  ar vartotojo nuo nieko esminio.
- **Vienkartinis adjustment'as admin'ui:** vietoj „+ visa serija" — admin
  pasirenka po vieną kandidatą kaip įprastas vartotojas. Atsiras catalog
  augimo lėtėjimas, kuris vis tiek savaime stabdomas kitur (vartotojų pridėjimas
  augalo = 1 entry).
- **Backup'as:** galima trinti `bulkSaveSeries` funkciją + button'ą, palikti
  `TOOL_BULK_SERIES` schema'ą + `saveTaxonGroup` helper'ą — jei reikia
  reanimuoti, vienos PR'o reikalas.

### Pastangos

- Pašalinimas: **~1 h** (delete + smoke test)
- Su admin gate'u kaip safety net (jei nuspręstume Option A): **~30 min**
  papildomai

### Patikrinimo planas po pašalinimo (1 savaitė)

1. Track'inti admin'o feedback'ą: ar trūksta?
2. Pažiūrėt esamus catalog'e bulk-saved entries — kelis spot-check'inti
   kokybei (kurie cultivars'ai fake, kurie tikri)
3. Jei admin'ui realiai pain'as → Option B mini-version (review queue,
   bet be naujo AI call'o — tiesiog naudoja esamą single save per kandidatą)

---

## 6. Atviri klausimai pokalbiui

1. **Kiek bulk-saved entries jau yra catalog'e?** (Need runtime query —
   filter by `verificationStatus='auto-verified'` AND `taxonGroupId IS NOT NULL`
   AND no `enrichmentStartedAt`). Tai pasakys, kiek „pollution" jau yra.

2. **Ar kažkuris vartotojas atrado bulk save'ą atsitiktinai?** (Could ask Vercel
   analytics arba Firestore audit). Jei taip — yra signal'as „kažkas naujas
   suklysta žmonėms".

3. **Admin'o pain'as kuriant katalogą — kiek jis realiai egzistuoja šiandien?**
   Jei admin'as catalog'ą daugiau augina per vartotojų save'us (organinis),
   bulk save tampa irrelevant. Jei admin'as turi sąmoningą goal „seedinti
   prieš launch" — tada bulk turi value.

4. **Series-level care info kokybė** — ar ji pakankamai tiksli vienam shared
   blokui per visą seriją? (Pvz., Boulevard clematises iš tikrųjų yra
   skirtingų hardiness'ų.) Tai paveiks ir SINGLE-save flow'ą per
   `ensureParentTaxonGroup`.

5. **Ar `verificationStatus='auto-verified'` semantika reikia patikslinimo
   ANYWAY?** Šiandien yra mažiausiai 3 šaltiniai (Phase 2 high-confidence,
   bulk save, preview upgrade) — visi naudoja tą patį status'ą. Galbūt reikia
   `auto-verified-phase2` vs `auto-verified-bulk` semantika nepriklausomai nuo
   bulk feature'o likimo.
