# LapasID — architektūros žemėlapis

> **Paskirtis.** Vientisas techninis žemėlapis: visos `api/` funkcijos, Firestore
> kolekcijos ir laukai, enrich pipeline, duomenų srautai, env kintamieji (be reikšmių),
> visos AI kvietimų vietos ir modeliai. Skirta kūrėjui ir būsimam refaktoriui.
>
> **Būsena.** Parengta 2026-11-03 iš kodo (ne iš senų `.md`). Kur seni dokumentai
> prieštarauja kodui — pažymėta skiltyje [§14](#14-prieštaravimai-tarp-dokumentų-ir-kodo).
> Domeno logikos tiesos šaltinis — kodas; šis failas — navigacija.
>
> **Kryptis.** Produkto klasifikacija (CORE / OPCIJA / ATSISAKYTI) pagal naują
> toksiškumo-pirma kryptį — atskirame `docs/REFACTOR_PLAN.md`.

---

## 1. Repo situacija (du repo, viena kodo giminė)

GitHub'e yra du susiję repo; abiejų `package.json` vardas — `geliu-db`:

| Repo | Vaidmuo | Būsena | Numatytoji šaka |
|---|---|---|---|
| **`ksmigelskiss/lapasid`** | **Dabartinis produktas** (šis failas aprašo jį) | Aktyvus; naujausi commit'ai 2026-06; pilnas enrich pipeline, toksiškumo duomenys, katalogas | `main` |
| `ksmigelskiss/geliu-db` | Istorinis pirmtakas | Senesnis snapshot'as; baigiasi commit'u „Brand rename: Gėlių žinynas → LapasID" (2026-05) | `master` |

`lapasid` yra `geliu-db` pervadinta ir toli pastūmėta versija (superset). **Visa toliau
aprašyta architektūra — `lapasid` repo.** `geliu-db` naudok tik kaip istoriją.

> Pastaba: abu repo šiuo metu klonuoti seklūs (50 commit'ų gylis), tad pilna git
> istorija matoma ne visa.

---

## 2. Sistemos apžvalga

LapasID — lietuviška augalų kolekcijos PWA su globaliu rūšių katalogu ir AI enrichment'u.

```
                 ┌─────────────────────────────────────────────┐
  Naršyklė /     │  React 18 + Vite PWA (src/)                  │
  PWA  ──────────│  - state-based routing (ne React Router)     │
                 │  - Firebase JS SDK (Auth/Firestore/Storage)  │
                 └──────────────┬──────────────────────────────┘
                                │ fetch('/api/...') + Firebase ID token
                 ┌──────────────┴──────────────────────────────┐
  Vercel         │  Serverless funkcijos (api/)                 │
  serverless ────│  - Anthropic / Gemini proxy (raktai serveryje)│
                 │  - Firebase Admin SDK (verifyIdToken)        │
                 │  - RAG + enrich pipeline (save-plant)        │
                 └───┬───────────────┬───────────────┬──────────┘
                     │               │               │
          ┌──────────┴───┐  ┌────────┴──────┐  ┌─────┴─────────┐
          │ Anthropic    │  │ Firebase       │  │ Išoriniai     │
          │ Claude API   │  │ Firestore +    │  │ API: Brave,   │
          │ Gemini (via  │  │ Storage        │  │ iNat, Wiki,   │
          │ Vercel GW)   │  │ (projektas     │  │ PFAF, Open-   │
          │              │  │  geliu-db)     │  │ Meteo         │
          └──────────────┘  └────────────────┘  └───────────────┘
```

Tech dėklas: React 18 + Vite, Tailwind, Framer Motion, Lucide; Firebase (Firestore +
Storage + Auth); Anthropic Claude + Google Gemini; Vercel serverless + hosting; Sentry;
Vitest; vite-plugin-pwa (Workbox). Firebase projektas: **`geliu-db`**; Storage bucket:
**`geliu-db.firebasestorage.app`**; prod domenas: **lapasid.lt** (deploy iš `main`).

---

## 3. Frontend architektūra

### 3.1. Įėjimo maršrutizacija — `src/main.jsx`
Nėra React Router. `main.jsx` pagal `window.location` parenka vieną iš viršutinio lygio
vaizdų (prieš `<App>`):

| Sąlyga | Renderinama | Pastaba |
|---|---|---|
| `?export=plants` | `dev/PlantExport.jsx` | reikalauja realios auth |
| `?playground=loaders\|login\|theme\|mascot` | atitinkamas `dev/*` playground | gated `VITE_USE_MOCK_USER` (išimtis: `mascot` visada) |
| kelias `/p/{plantId}` | `pages/PlantPassportPage.jsx` | viešas augalo pasas, be pilno app |
| default | `<ErrorBoundary><App/></ErrorBoundary>` | |

### 3.2. App.jsx vartai ir tab'ai — `src/App.jsx`
Vaizdai perjungiami `useState`'u (ne URL). Vartai (eilės tvarka):

1. `authLoading` → `BrandLoader` splash
2. **neprisijungęs** (`!user && !viewerToken`):
   - jei `showLogin` **arba** `!PUBLIC_LIBRARY_ENABLED` → `LoginScreen`
   - kitaip → **`PublicLibrary`** (vieša biblioteka, 1 segmentas / CORE)
3. `pendingApproval` → `PendingApprovalScreen` (naujas user laukia admin patvirtinimo)
4. `showAdmin && isAdmin` (`?admin=1`) → `AdminPanel`
5. `!collectionId` → klaidos/retry ekranas
6. kitaip → **app shell** su 3 tab'ais:

| Tab | Ekranas | Paskirtis |
|---|---|---|
| `dashboard` | `pages/Dashboard.jsx` | pagrindinis „Augalai" — auginami augalai pagal zonas/karantiną, care mode (bulk laistymas/tręšimas), sveikinimas + accuracy |
| `biblioteka` | `pages/Biblioteka.jsx` | „Biblioteka" — `nori` + `istorija` augalai, fuzzy paieška, kolekcijos AI chat |
| `zinynas` | `pages/Zinynas.jsx` | „Žinynas" — išsaugotos pastabos (markdown), paieška, žvaigždutė, per-įrašą AI chat |

Modalai (ne maršrutai, App state): `PlantDetail`, `SearchModal`, `ProfileSheet`,
`DeathModal`, `DeleteModal`, `DuplicateBuyModal`, `WelcomePhotoSheet`, `DiscoveryToast`.
Desktop (≥1100px): `desktop/DesktopLayout` + `RightPanel`; modalai portal'inasi į dešinį
panelį per `contexts/DetailHostContext`.

Duomenų centras — **`usePlants(collectionId, viewerToken)`** hook'as (prop-drilling nuo
App žemyn; nėra globalaus state konteksto be `DetailHostContext`).

### 3.3. Puslapiai — `src/pages/`
- `Dashboard.jsx` — pagrindinis auginamų augalų ekranas; zonų/karantino grupavimas, care mode, sort/paieška, kolekcijos chat FAB.
- `Biblioteka.jsx` — `nori` + `istorija`; kategorijų tab'ai, fuzzy paieška, library chat.
- `Zinynas.jsx` — pastabų bazė su minimaliu markdown rendereriu + per-note chat.
- `PublicLibrary.jsx` — **vieša** (be auth) katalogo naršyklė; `/api/catalog/public`; atidaro `PublicPlantCard`. Landingas neprisijungusiems.
- `PlantPassportPage.jsx` — standalone `/p/{plantId}` pasas; skaito `plant-passports/{plantId}` + renderina `PlantCareCard`.
- `History.jsx` — **našlaitis** (seno stiliaus istorijos grid; App/main neimportuoja).
- `Wishlist.jsx` — **našlaitis** (seno stiliaus wishlist grid; neimportuojamas).

### 3.4. Komponentai — `src/components/` (grupėmis)
- **Saugumas/toksiškumas:** `plant-detail/HeroSafetyStrip.jsx` (worst-case toksiškumo/valgomumo/vaistinio juosta po hero), `brand/PlantSavybesPills.jsx` (PAVOJAI/VALGUMUMAS/VAISTINIS sekcijos; `PlantSafetyCallout`), `PublicPlantCard.jsx` (vieša kortelė — tik saugumas + įdomybės), hazard pills `PlantCard.jsx`.
- **Priežiūra (care):** `CareOverview.jsx` (+ `useCareLists`), `CareWateringSheet.jsx`, `CareSessionSummary.jsx`, `CareToast.jsx`, `CareCircuitToast.jsx`, `PostFertilizePrompt.jsx`, `ForecastCards.jsx`, `AccuracyButton.jsx`/`AccuracySprite.jsx`, `PlantCareCard.jsx` (viešas pasas → `/api/passport/care`), `brand/BarcodeLifeline.jsx`.
- **Charakteriai/chat/maskotas:** `PlantChat.jsx` (pirmo asmens augalo persona chat), `CollectionChat.jsx`, `ZinynasChat.jsx`, `icons/ChatIcons.jsx` (`PlantAvatar`), `brand/Mascot.jsx` (Animus SVG, `plant`/`gardener`, mood būsenos).
- **Pridėjimas/enrichment:** `SearchModal.jsx` (didelis AI pridėjimo srautas), `EnrichmentProgress.jsx` (progresyvus atskleidimas).
- **Kita:** `Navigation.jsx`, `MobileHeader.jsx`, `ProfileSheet.jsx` (invite generavimas), `PlantTimeline.jsx`/`AddEventSheet.jsx`, `StatusPicker.jsx`, `ZoneManager.jsx`, `DeathModal/DeleteModal/DuplicateBuyModal`, `UpdatePrompt.jsx` (PWA), `ErrorBoundary.jsx`, `PinGate.jsx` (**našlaitis**, neimportuojamas; PIN hardcoded).
- **admin/** `AdminPanel.jsx` (vartotojai + kolekcijos; toggle `isAdmin`/`beta`/`subscription.plan`), `LibraryEditorV2.jsx` (3-panelių katalogo redaktorius; `/api/generate-hero`,`/api/save-plant`,`/api/plant-image`,`/api/rehost-image`), `AdminPendingBadge.jsx`, `QuickApproveSheet.jsx`.
- **brand/** `T4Icon/T4Mark/T4Word`, `BrandLoader`, `Mascot`, `PlantImage`, `PlantSavybesPills`, `BarcodeLifeline`.
- **desktop/** `DesktopLayout`, `DesktopHeader`, `RightPanel` (backdrop + widget'ai + portal host).
- **widgets/** `WeatherWidget`, `CareHeatmapWidget`, `CareChartWidget`, `ShopWidget`.

### 3.5. Hooks — `src/hooks/`
- `useAuth.js` — auth (Google/Facebook/redirect/viewer-token), user/collection provisioning, approval gate, invite'ų apdorojimas, `subscription {plan, validUntil, stripeCustomerId}`, `isAdmin`, `beta`; viewer token'ą validuoja per `/api/viewer`.
- `usePlants.js` — plant/zinynas/zones state + CRUD, Firestore `onSnapshot` sync, katalogo snapshot write'ai; viewer kelias poll'ina `/api/viewer` ir POST'ina `/api/viewer/water`.
- `useChatStream.js` — `/api/claude/stream` SSE; 403 `limit_reached` → atidaro paywall; prisega Firebase ID token'ą.
- `useWeather.js` (Open-Meteo), `useIsDesktop.js` (≥1100px), `useCollapsible.js`, `useLongPress.js`, `usePullToRefresh.js` (**deprecated/no-op**).

### 3.6. Kontekstai, konstantos, duomenys
- `contexts/DetailHostContext.jsx` — desktop split-panel portal host (be Firestore/API).
- `constants/plant.js` (`KATEGORIJA`, `STATUS`), `constants/careCopy.js` (visa care kalba).
- `src/data/plants.json`, `src/dev/realPlants.json` — mock/dev duomenys.

### 3.7. Feature flag'ai (env + URL) — žr. [§11](#11-environment-kintamieji) ir REFACTOR_PLAN
- `VITE_PUBLIC_LIBRARY` — įjungia viešą biblioteką prod'e (`App.jsx:60`: `DEV || VITE_PUBLIC_LIBRARY === '1'`).
- `VITE_USE_SERVERSIDE_SAVE` — „Variant B" server-side save (`SearchModal.jsx`).
- `VITE_USE_MOCK_USER` — mock režimas (be Firebase).
- `VITE_SENTRY_DSN` — Sentry on/off.
- URL-param vartai: `?admin=1`, `?playground=…`, `?export=plants`, `?invite=`/`?role=viewer`.
- **Nėra** remote-config / A-B servisų (LaunchDarkly, Firebase Remote Config nėra).

---

## 4. Backend — `api/` serverless funkcijos

Visos — Vercel serverless (`export default handler`). Auth mašina: `verifyAuthToken`
(`admin.auth().verifyIdToken`) iš `api/_lib/firestore-admin.js`.

### 4.1. HTTP endpoint'ai

| Failas | Metodas / kelias | Auth | Paskirtis |
|---|---|---|---|
| `api/claude.js` | POST `/api/claude` | ID token kai `limitType` | Ne-stream Anthropic proxy (SearchModal paieška). Tikrina `aiUsage`/limitą, po sėkmės `fsIncrement`. Model `claude-sonnet-4-6`. |
| `api/claude/stream.js` | POST `/api/claude/stream` | ID token kai `limitType` | SSE stream proxy chat'ams (PlantChat/CollectionChat/ZinynasChat). Model `claude-sonnet-4-6`. |
| `api/save-plant.js` | POST `/api/save-plant` | ID token (membership arba admin) | **Enrich pipeline branduolys** — 202 ACK → `waitUntil(processPlant)` background. Žr. [§8](#8-enrich-pipeline). `maxDuration: 300`. |
| `api/generate-hero.js` | POST `/api/generate-hero` | ID token | Watercolor hero iliustracija per Gemini (per `_lib/heroGen.js`); įrašo `catalog.heroIllustration/heroThumb`. `maxDuration: 300`. |
| `api/plant-image.js` | GET `/api/plant-image?q=` | — (serverio raktas) | Proxy į Brave Image Search (edge-cache 30d; 4s timeout). |
| `api/rehost-image.js` | POST `/api/rehost-image` | ID token | Fetch išorinį paveikslą → sharp resize 1200px → Firebase Storage. SSRF guard + protokolo whitelist. `maxDuration: 30`. |
| `api/catalog/public.js` | GET `/api/catalog/public` (`?list=1`/`?q=`/`?slug=`) | **— VIEŠAS** | Atvira biblioteka (1 segmentas). Admin SDK apeina rules, bet grąžina TIK `PUBLIC_FIELDS` allowlist'ą (be care). In-memory cache 5 min, edge-cache 5 min. |
| `api/viewer.js` | GET `/api/viewer?token=` | invite token | Plant-sitter skaito kolekciją+augalus per invite token'ą. |
| `api/viewer/water.js` | POST `/api/viewer/water` | invite token | Plant-sitter įrašo laistymo event'ą į timeline. |
| `api/passport/care.js` | POST `/api/passport/care` | — (viešas pasas) | NFC paso kombinuotas care log'as (iki 5 event'ų vienu write'u). |
| `api/passport/water.js` | POST `/api/passport/water` | — (viešas pasas) | NFC paso vienas watering/fertilizing event'as. |
| `api/vision-unlock.js` | POST `/api/vision-unlock` | slaptažodis | Vision-doc gate: SHA-256(PEPPER+slaptažodis) → httpOnly cookie; `middleware.js` tikrina. Fail-closed. |

> ⚠️ **Kabantis ryšys:** `src/components/SearchModal.jsx:186` kviečia `POST /api/dev-toxicity-test`,
> bet tokio endpoint'o `api/` **nėra** (dev/diagnostinis harness'as, prod'e grąžintų 404).

### 4.2. Serverio bibliotekos — `api/_lib/` ir `api/_*`

| Failas | Paskirtis |
|---|---|
| `api/_lib/firestore-admin.js` | Firebase Admin init (singleton), `adminFirestore()`, `serverTimestamp()`, **`verifyAuthToken()`** (RS256 verifikacija). |
| `api/_admin.js` | Firestore REST klientas per service-account JWT (naudoja `viewer.js`/`water.js`), `adminDb()`. |
| `api/_firestore.js` | Firestore REST helper'iai su **vartotojo** ID token'u (`fsGet`, `fsIncrement`); `FREE_LIMITS = {searches:5, chats:5, fbPosts:2}`; `checkLimit()`. |
| `api/_lib/buildPlantRagContext-server.js` | RAG konteksto surinkimas (pre-DB + LT names + PFAF + ASPCA + Cheng + reclassification). Mirror `src/utils/buildPlantRagContext.js`. |
| `api/_lib/deriveToxicity-server.js` | Deterministinis toksiškumas iš ASPCA + PFAF (be AI). Mirror `src/utils/deriveToxicity.js`. Žr. [§13](#13-toksiškumo-sistema). |
| `api/_lib/toxicityNarrativeGenerator-server.js` | AI toksiškumo narrative (TRANSLATOR) + `aiSupplementaryHazard` (AUDITOR). Model `claude-sonnet-4-6`. |
| `api/_lib/catalog-server.js` | `catalogDocId()` slug, `toCatalogEntry()` (PERSONAL_FIELDS filtras), `saveToCatalogServer()` (merge + image-freeze), `isPublicPhoto()`. |
| `api/_lib/taxon-groups-server.js` | `saveTaxonGroupServer`, `ensureParentTaxonGroupServer`, `saveCatalogWithParentServer` (katalogas + parent taxon grupė). |
| `api/_lib/user-plant-server.js` | `isUidMember()` (membership gate), `saveUserPlantServer()` (merge; strip PERSONAL_STATE_FIELDS). |
| `api/_lib/heroGen.js` | Hero gen branduolys: Sonnet vision brief + foto select → Gemini restyle/text→img → sharp bg/watermark. `BRIEF_MODEL`/`IMAGE_MODEL`/`GATEWAY`. |
| `api/_lib/watermark.js` | Vizualus „LapasID.lt" ženklas + forensic LSB embed. |
| `api/_lib/dataLoader-server.js` | `data/*.json` krovimas serveryje (su cache). |
| `api/_lib/preDb-server.js` | pre-DB (genus/species/family) lookup. Mirror `src/utils/preDb.js`. |
| `api/_lib/ltDictionary-server.js` | LT↔lotynų vardų žodynas (`resolveLtServer`). |
| `api/_lib/latinResolver-server.js` | Pasenusių→kanoninių pavadinimų resolve (`resolveCanonicalServer`, `getReclassificationServer`). |
| `middleware.js` (repo šaknis) | Vercel edge middleware — vision-doc cookie patikra prieš serv'inant `/vision/*` + `/screenshots/*`. |

**Client↔server MIRROR:** `deriveToxicity`, `buildPlantRagContext`, `catalog`, `taxonGroups`
turi klientinę ir serverinę kopijas; **keičiamos tik kartu** (žr. `tasks/lessons.md`).

---

## 5. Firestore kolekcijos ir laukai

Projektas `geliu-db`. Taisyklės — `firestore.rules`. Septynios kolekcijos:

### `users/{uid}`
`isAdmin:bool`, `beta:bool`, `approved:bool`, `subscription:{plan:'free'|'starter'|'pro'|'premium', validUntil, stripeCustomerId}`, `aiUsage:{searches, chats, fbPosts}`, `primaryCollection`, + auth meta. — Rules: skaitymas/rašymas savo doc'o arba admin.

### `collections/{colId}`
`name`, `members:[uid]`, `ownerId`, `zones:[]`, `zinynas:[]`, `settings:{}`, `plants:[]`
(legacy masyvas — fallback kai subkolekcija tuščia). — Rules: read/write/delete member'ams arba
admin; create — bet kuriam auth'intam; update — papildomai leidžia ne-member'ui pridėti SAVE
į `members[]` (accept-invite).

### `collections/{colId}/plants/{plantId}` (subkolekcija — asmeninis augalas)
Asmeniniai (PERSONAL): `id`, `kategorija` (`auginama`|`nori`|`istorija`), `status`
(`healthy`|`sick`|`quarantine`), `komentaras`, `uzrasai`, `data_prideta`, `timeline:[]`,
`chat:[]`, `zonaId`, `pirkinys`, `diedDate`/`historyKind`/`deathReason`, `lesson`,
`useHistoryPhoto`, `photos:[]`, `image`, `imageThumb`, `enrichmentStartedAt`,
`phase2CompletedAt`, `enrichmentError`, `taxonGroupId`, `verificationStatus`.
Rūšiniai laukai **nedenormalizuojami** — ateina per F1 overlay iš `catalog` (žr. [§9](#9-duomenų-srautai)).
— Rules: read/write member'ams; read + delete admin'ui; **admin NEredaguoja** turinio.

### `catalog/{slug}` (globalus rūšių katalogas, F1 reference)
Slug = `catalogDocId(lotyniskas)`. Laukai:
- Tapatybė: `lotyniskas`, `lietuviškas`, `sinonimai:[]`, `englishNames:[]`
- Vaizdai: `image`, `heroIllustration`, `heroThumb`, `_heroOriginalPath` (privatus RAW), `heroPromptBrief`, `heroPhotoAssessment`, `_heroMethod`, `_heroIllustrationAt`
- **Saugumas:** `savybes.{ pavojai:[{tipas,target,severity,detales}], pavojingumas:{yra,lygis,detales}, valgomumas:{statusas,…}, vaistinis:{statusas,…}, aiSupplementaryHazard }`, `toxicitySources:[]`, `toxicityNarrativeGenerated`
- Turinys: `idomybes:[]`, `aprasymas`, `aprasymasSource`, `kilme`
- Priežiūra: `prieziura:{sviesa,laistymas,temperatura,dregme}`, `sviesa:{taskai,lygis,ppfd}`, `vanduo:{taskai,lygis}`, `laistymasIntervalas:{vasara,ziema,metodas}`, `tresimas:{intervalVasara,intervalZiema,tipas}`, `substratas`, `persodinimas`, `ziemojimas`, `dauginimas:[]`, `problemos:[]`
- Meta: `tipas`, `augimo_greitis`, `sunkumas`, `schemaVersion`, `ragSources:[]`, `ragConfidence`, `verificationStatus`, `aiConfidence`, `taxonGroupId`, `updatedAt`, `_batchEnrichedAt`, `_batchSource`
- Enrich progresas: `enrichmentStage` (`started`→`rag`→`narrative`→`image`→`complete`/`failed`), `enrichmentUpdatedAt`, `enrichmentStartedAtServer`, `enrichmentError`
- — Rules: **read + write bet kuriam auth'intam** — ⚠️ žr. [§13.3](#133-žinomos-rizikos) / REFACTOR_PLAN (atviras write — 🔴).

### `taxonGroups/{groupId}` (cultivar/serijų tėviniai grupavimai)
`type` (`species`|`genus-care`), `genus`, `name`, `scientificName`, `aprasymas`, `kilme`,
`tipas`, `augimo_greitis`, `sunkumas`, `careInfo:{…}`, `savybes:{}`, `idomybes:[]`,
`dauginimas:[]`, `problemos:[]`, `sources:[]`, `createdFrom`, `verificationStatus`,
`aiVerifiedAt`, `schemaVersion`, `updatedAt`. — Rules: read auth'intiems; **write tik admin'ui**.

### `invites/{token}` (kolekcijos share token'ai)
`colId`, `active:bool`, `expiresAt`, (+ galimai `role`). — Rules: read/create/update
auth'intiems; delete tik admin'ui.

### `plant-passports/{plantId}` (viešos paso kortelės)
`isPublic:bool`, `collectionId`, `snapshot:{lastWatered, lastFertilized, …}`. — Rules: read
kai `isPublic==true` arba auth; write auth'intiems.

### `plant-sitter-tokens/{token}` (viewer share be auth)
Viewer share link'ai. — Rules: **read: `true`** (viešas), write auth'intiems.

---

## 6. Firebase Storage

`storage.rules` (version-controlled; deploy = manual per Console):
- `plants/**` — user augalų foto; read+write auth'intiems. **Limitacija:** kelias be `colId`,
  tad bet kuris auth user teoriškai gali skaityti/rašyti bet kurią plant foto (žinant `plantId`).
- `catalog/*` — hero iliustracijos; **nėra explicit match → default DENY** SDK prieigai;
  serveris rašo per Admin SDK (bypass), vieša prieiga per `makePublic()` HTTP URL.
- Viskas kita — default deny.

Takai: `catalog/{slug}/hero-illus.png` (watermark'intas), `catalog/{slug}/hero-thumb.webp`
(švarus), `catalog/{slug}/hero-original.png` (privatus RAW), `catalog/{slug}/hero.jpg` (rehost).

---

## 7. Duomenų šaltiniai — `data/`

Enrich RAG ir toksiškumo pamatas (statiniai JSON, kraunami per `dataLoader-server.js`):
- **Toksiškumas:** `aspca-toxicity.json`, `aspca-genus-map.json`, `aspca-animals-lt.json`, `pfaf.json`, `toxin-classes.json` (19 klasių), `genus-toxin-map.json` (72 gentys)
- **Tapatybė/vardai:** `pre-db.json`, `species-lt-names.json`, `lt-names*.json`, `latin-synonyms-reverse.json`, `inat-names.json`, `lt-indoor-whitelist.json`
- **Priežiūra/enciklopedija:** `cheng.json` (premium care), `beckett.json`, `ahs.json`
- **Enrich target'ai:** `curated-300.json` (batch sąrašas su tier'ais), `plants.json`
- Auditų/migracijų artefaktai: `pfaf-v2-*`, `validation-report.json`, `*.backup.*`

> `toxin-classes.json` + `genus-toxin-map.json` — **naujas struktūruotas toksiškumo sluoksnis**
> (gentis→klasės→mechanizmas/sunkumas/antidotas/medikui). Duomenys yra; app wiring'as (resolveris) —
> dar NE (žr. [§13.2](#132-naujas-sluoksnis-spec---dar-neįgyvendinta) ir `docs/toksiskumo-integracija.md`).

---

## 8. Enrich pipeline

Du keliai, **ta pati serverio logika** (`api/_lib/*`):

### 8.1. Online — `api/save-plant.js` → `processPlant()`
```
POST /api/save-plant  (auth: membership arba admin mode)
  └─ 202 ACK iškart  → klientas gali uždaryti UI
       waitUntil(processPlant):
         0.  idempotency check (completedAt ≥ startedAt → skip)
         0.5 HERO (paraleliai): heroGen (Gemini) → sharp → watermark → Storage → catalog merge
         1.  RAG: buildPlantRagContextServer (pre-DB/LT/PFAF/ASPCA/Cheng)
         2.  AI Phase 2: Sonnet (TOOL_DETAILS 'plant_details', temp 0.3, max 3000)
         3.  Toksiškumas: deriveToxicityFromSourcesServer (DB autoritetas)
             + generateToxicityNarrativeServer (LT narrative / aiSupplementaryHazard)
         4.  Katalogas: saveCatalogWithParentServer (catalog + parent taxonGroup)
         5.  User augalas: saveUserPlantServer (collections/{colId}/plants/{plantId}; merge)
         6.  laukia hero → writeStage('complete')
```
Stage'ai rašomi į `catalog.enrichmentStage` → klientas (`EnrichmentProgress`) per `onSnapshot`
progresyviai atskleidžia (toxicity → care → narrative → hero). **Admin mode** (`!plantId && !colId`,
reikia `users/{uid}.isAdmin`): rašo tik katalogą, praleidžia user-plant write'ą ir idempotency.

### 8.2. Offline — `scripts/batch-enrich-catalog.mjs`
Pre-populina katalogą per `curated-300.json` (tier 1/2/3 arba `--all`; `--limit`, `--resume`,
`--dry-run`). Tas pats RAG+AI+toxicity+narrative, **tik catalog write** (neliečia user plant'ų).
Nuotrauka: Wiki EN→LT→genus → iNat default_photo fallback. Checkpoint `data/batch-catalog-checkpoint.json`.
Kiti `scripts/*` — scrape'riai/parser'iai/auditai (pfaf, aspca, lt-names, hero POC'ai).

### 8.3. Hero gen — `api/_lib/heroGen.js`
`createHeroGen({token})` per Vercel AI Gateway (`https://ai-gateway.vercel.sh/v1`): Sonnet
vision brief + foto select (`BRIEF_MODEL`) → Gemini restyle (img→img) arba text→img (`IMAGE_MODEL`)
→ sharp bg-transparent + 3:2 + watermark + 512 thumb. Kandidatai: iNat + Wiki + Brave.

---

## 9. Duomenų srautai

- **Paieška+pridėjimas (SearchModal):** Phase 0 katalogas → Stage 1 pre-DB slim preview →
  (vartotojas mato) → save (`VITE_USE_SERVERSIDE_SAVE` → `POST /api/save-plant`, kitaip klientinis).
  Klientas pirmas rašo slim user-plant doc'ą (Firebase SDK), serveris po to enrich'ina (merge).
- **F1 reference overlay (`src/utils/catalog.js`):** user augalas saugo tik asmeninius laukus;
  rūšiniai laukai (care, savybes, hero) ateina iš `catalog` per `resolvePlantView` realtime
  (`subscribeCatalog` + IndexedDB cache). Miręs augalas = įšaldytas snapshot (`refFrozen`).
  Katalogo pataisa pasiekia visus naudotojus be denormalizacijos.
- **Re-enrichment:** `ProfileContent`/`usePlants` → `POST /api/save-plant` (bumpina
  `enrichmentStartedAt` → serveris mato `startedAt > completedAt` → run).
- **Vieša biblioteka (CORE):** `PublicLibrary` → `GET /api/catalog/public` (allowlist, be auth)
  → `PublicPlantCard` (saugumas + įdomybės).
- **Augalo pasas (QR/NFC):** `/p/{plantId}` → `PlantPassportPage` skaito `plant-passports` →
  `PlantCareCard` → `POST /api/passport/care|water`.
- **Plant-sitter (viewer):** `?token=` → `useAuth`/`usePlants` poll'ina `/api/viewer` +
  `POST /api/viewer/water`.
- **Chat'ai:** `useChatStream` → `POST /api/claude/stream` (SSE); 403 `limit_reached` → paywall.

---

## 10. Testai, CI, monitoringas

Vitest (`*.test.js`): `deriveToxicity`, `toxinClasses`, `wateringForecast`, `fertilizingForecast`,
`forecastBase`, `NotesContent`, `StatusTransitionSheet`. `prebuild`: `build-species-lt-names.mjs`.
CI: GitHub Actions test+build ant push (žr. `docs/quality-infra.md`). Sentry env-gated
(`VITE_SENTRY_DSN`). Deploy: push `main` → Vercel → lapasid.lt (be staging — OAuth preview neveikia).

---

## 11. Environment kintamieji (be reikšmių)

**Serverio (tik Vercel env; į klientą NEpatenka):**
`ANTHROPIC_API_KEY`, `AI_GATEWAY_API_KEY`, `VERCEL_OIDC_TOKEN` (hero AI Gateway; OIDC arba key),
`BRAVE_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`,
`VISION_PASSWORD`, `VERCEL_GIT_COMMIT_SHA`, `ANALYZE` (build), `GOOGLE_APPLICATION_CREDENTIALS`
(scripts), `OPENAI_API_KEY` (**tik POC** `scripts/poc-hero-images.mjs` — DALL·E; prod'e nenaudojamas).

**Kliento (`VITE_`, įkepa build metu; visi neprivalomi):**
`VITE_PUBLIC_LIBRARY`, `VITE_USE_MOCK_USER`, `VITE_USE_SERVERSIDE_SAVE`, `VITE_SENTRY_DSN`
(+ built-in `import.meta.env.DEV`/`PROD`). Firebase kliento config — kode (`src/utils/firebase.js`).

> ⚠️ `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (minimi senuose `PROJECT.md`/`README.md`) kode
> **nerasti** — OAuth dabar klientinis Firebase Auth (`signInWithPopup`), ne serverinis callback.
> Žr. [§14](#14-prieštaravimai-tarp-dokumentų-ir-kodo).

---

## 12. AI kvietimų vietos ir modeliai

| Vieta | Modelis | Kelias / SDK | Paskirtis |
|---|---|---|---|
| `api/claude.js` | `claude-sonnet-4-6` | Anthropic SDK (`messages.create`) | SearchModal paieška (Phase 1) |
| `api/claude/stream.js` | `claude-sonnet-4-6` | Anthropic SDK (`messages.stream`) | Chat'ai (Plant/Collection/Zinynas) |
| `api/save-plant.js` | `claude-sonnet-4-6` | Anthropic SDK | Enrich Phase 2 (`plant_details` tool) |
| `api/_lib/toxicityNarrativeGenerator-server.js` | `claude-sonnet-4-6` | Anthropic SDK | Toksiškumo narrative + auditor |
| `scripts/batch-enrich-catalog.mjs` | `claude-sonnet-4-6` | Anthropic SDK | Batch enrich Phase 2 |
| `api/_lib/heroGen.js` (`BRIEF_MODEL`) | **`anthropic/claude-sonnet-4.5`** | Vercel AI Gateway `/chat/completions` | Hero morfologijos brief + foto select (vision) |
| `api/_lib/heroGen.js` (`IMAGE_MODEL`) | **`google/gemini-3-pro-image`** | Vercel AI Gateway `/chat/completions` | Hero iliustracijos generavimas (img→img / text→img) |
| `scripts/poc-*.mjs` | `google/imagen-4.0-fast-generate-001`, `gemini-3-pro-*`, DALL·E 3 | AI Gateway / OpenAI | **POC only** (ne prod) |

Pastabos:
- Pagrindinis teksto modelis visur — **`claude-sonnet-4-6`** (tiesiogiai Anthropic SDK, raktas serveryje).
- Hero vision brief naudoja **kitokį** identifikatorių `anthropic/claude-sonnet-4.5` (per Gateway) —
  modelių stringai nesuvienodinti (verta suvienodinti arba dokumentuoti kodėl).
- Bendra AI balso charta — `src/utils/plantVoicePersona.js` (VOICE_PERSONA „Sodininkas") prepend'inama
  visur. Prompt builder'iai (`plantChatContext`, `collectionChatContext`, `plantPromptConfig`,
  `toxicityNarrativePrompts`, `stage2Constants`) — tik tekstas, ne API call'ai.
- Model'io ID kodo lygyje: `claude-sonnet-4-6` / `claude-sonnet-4.5`. (Šis repo juos naudoja kaip
  yra; jei migruosi į naujesnį modelį — keisk visose [§12] vietose vienu metu.)

---

## 13. Toksiškumo sistema

### 13.1. Dabartinė (live) — `deriveToxicity`
Deterministinis (ne AI) `pavojai[]` + `pavojingumas{}` iš:
- **ASPCA** (genus map → `toxicTo` gyvūnai, floor `vidutinis`),
- **PFAF** `knownHazards` tekstas → `derivePfafSeverity` (stiprus/vidutinis/silpnas) + `derivePfafTipas`
  (toksiskas/dirginantis/alergiskas) su de-eskalacija ir `IRRITANT_ONLY_GENERA` override (Araceae
  oksalatai / Asparagaceae saponinai → „dirginantis").
AI (`claude-sonnet-4-6`) tik **verčia** EN→LT narrative (TRANSLATOR) arba **audituoja** gap-fill
(`aiSupplementaryHazard`, griežtas whitelist). AI **nėra** saugos laukų autoritetas.
Ašys: `target` ∈ {`zmonems`, `gyvunams`}, `severity` ∈ {silpnas, vidutinis, stiprus}, `tipas`.
UI: `HeroSafetyStrip`, `PlantSavybesPills`, `PublicPlantCard` (žmonės/gyvūnai ikonos).

### 13.2. Naujas sluoksnis (SPEC — dar NEįgyvendinta)
`data/toxin-classes.json` (19 cheminių klasių: mechanizmas, sunkumo lubos, rūšies jautrumas,
antidotas, simptomai, „medikui", aprašymai vaikams/suaugusiems/gyvūnams) + `data/genus-toxin-map.json`
(72 gentys → klasės + dalis + tier). Planuojamas resolveris **`resolveToxinProfile(plant, household)`**
(`docs/toksiskumo-integracija.md`): gentis → klasės → `household {vaikai, gyvunai[]}` → kortelei
paruošta struktūra (`sunkumas_man`, audience aprašymas, `kritine_veliava`, medikams).
**Kode resolverio dar nėra** (yra tik `src/utils/toxinClasses.test.js` schema testas). Tai —
naujos CORE krypties branduolys, kurį dar reikia įgyvendinti (žr. REFACTOR_PLAN).

### 13.3. Žinomos rizikos
- 🔴 **`firestore.rules:84-86` — `catalog` write atviras bet kuriam auth user'iui.** Toksiškumas
  gyvena `catalog.savybes` — bet kas gali „toksiška"→„saugu". Fix: write tik `isAdmin()`.
  (Konsiliumo URGENT; žr. `tasks/konsiliumas-2026-06/60-galutine-santrauka.md`.)
- Toksiškumo juodraštis **ne toksikologo verifikuotas** (~85–90%; žr. `docs/toksiskumo-klasifikacija.md`).

---

## 14. Prieštaravimai tarp dokumentų ir kodo

Rasti neatitikimai (seni `.md` vs dabartinis kodas) — taisyti po refaktoriaus:

1. **`src/ARCHITECTURE.md` (seniausias, iš dalies pasenęs):**
   - mini `api/stripe-webhook.js`, `api/create-checkout.js`, `api/claude/stream.js` planą —
     **Stripe endpoint'ų kode NĖRA** (Stripe neįgyvendintas; tik `subscription.stripeCustomerId` laukas).
   - teigia „Nėra React Context (intentional)" — realiai yra `contexts/DetailHostContext.jsx`.
   - mini stale domeną `augalai.crazyeuropean.eu` ir šaką `feature/multi-user`;
     realiai prod = `lapasid.lt`, deploy iš `main`.
   - „~1338 eilučių App.jsx" — realiai 827 eilutės.
2. **`docs/lapasid/README.md`:** production branch = `desktop-ux`; `README.md`/`PROJECT.md` sako
   deploy iš `main`. (Patikrinti realų Vercel production branch'ą.)
3. **`PROJECT.md` / `README.md`:** mini serverinį OAuth (`/api/auth/callback`, `GOOGLE_CLIENT_ID/SECRET`)
   — realiai OAuth klientinis Firebase Auth; `api/auth/` **nėra** (buvo `geliu-db` pirmtake).
4. **`src/components/SearchModal.jsx:186`** kviečia `/api/dev-toxicity-test` — endpoint'o nėra.
5. Seni strateginiai dokumentai (`tasks/konsiliumas-2026-06/*`, V1 vizija: žymos/NFC/marketplace
   kaip pamatas, EU „mandatas") aprašo **seną kryptį** — nauja kryptis (toksiškumas kaip CORE)
   svarbesnė; seną naudok kaip istoriją. Konsiliumo „trijų segmentų" sintezė (open DB → Pro →
   komercija) jau sutampa su nauja kryptimi.

---

## 15. Nuorodos
- Produkto klasifikacija + atskyrimo planas: **`docs/REFACTOR_PLAN.md`**
- Toksiškumas: `docs/toksiskumo-klasifikacija.md`, `docs/toksiskumo-integracija.md`
- Strategija (istorija): `tasks/konsiliumas-2026-06/60-galutine-santrauka.md`, `…/50-vizija-v2-draft.md`
- Kita: `docs/quality-infra.md`, `docs/plant-history-timeline.md`, `docs/plant-savybes-logic.md`,
  `docs/care-rewards.md`, `docs/mascot.md`, `DESIGN.md`
