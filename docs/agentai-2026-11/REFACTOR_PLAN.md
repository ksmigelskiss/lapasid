# LapasID — refaktoriaus planas (toksiškumo-pirma kryptis)

> **Paskirtis.** Suklasifikuoti kiekvieną modulį/ekraną pagal naują kryptį ir pateikti
> strategiją, kaip atskirti antraeilius modulius **nesulaužant CORE** (feature flag'ai, maršrutai).
> Techninis žemėlapis — `docs/ARCHITECTURE.md`. Parengta 2026-11-03 iš kodo.

---

## 1. Nauja kryptis (kontekstas)

**CORE — kambarinių augalų toksiškumo duomenų bazė ir namų rizika.** Toksiškumas žmonėms
(vaikams), šunims, katėms ir kt., surenkamas esamu enrich pipeline'u, ateityje tikrinamas
mokslo akademijos ekspertų. Vartotojas susideda savo augalus, nurodo, kas gyvena namuose
(vaikai, šunys, katės), ir mato: kuris augalas kam ir kiek toksiškas, ką laikyti aukščiau /
ant žemės / geriau ne namuose, bei **toksikologinę kortelę** medikams ar veterinarui.

**ANTRAEILIA (OPCIJA / PAYWALL arba atsisakyti).** Priežiūros app (prognozės, korekcijos) ir
augalų „charakteriai" su pokalbiais.

**ATEITIES IDĖJOS.** „Wallet" objektas; nuasmeninti agreguoti duomenys verslui.

> Ši kryptis sutampa su konsiliumo „trijų segmentų" sinteze (`tasks/konsiliumas-2026-06/`):
> (1) atvira saugumo biblioteka + akademija = CORE; (2) Pro freemium (care, chat) = OPCIJA;
> (3) komercija/agregatai = ateities durys. Seną V1 kryptį (žymos/NFC/marketplace kaip pamatas,
> EU „mandatas") naudojame tik kaip istoriją.

**Klasifikavimo žymos:** 🟢 **CORE** · 🟡 **OPCIJA/PAYWALL** · 🔴 **ATSISAKYTI / archyvuoti**.

---

## 2. Svarbiausia išvada (gap analizė)

CORE **duomenų sluoksnis didžia dalimi jau yra**, bet **namų-rizikos produkto branduolys dar ne**:

| CORE elementas | Būsena kode |
|---|---|
| Toksiškumas iš ASPCA/PFAF (`deriveToxicity`) | ✅ veikia (žmonėms/gyvūnams, severity) |
| Struktūruotas sluoksnis `toxin-classes.json` (19 kl.) + `genus-toxin-map.json` (72 g.) | ✅ duomenys yra |
| **`resolveToxinProfile(plant, household)` resolveris** | ❌ **tik SPEC** (`docs/toksiskumo-integracija.md`); kode nėra |
| **Namų profilis** `{vaikai, gyvunai[]}` | ❌ nėra (nei UI, nei saugojimo) |
| **Per-adresatą rizika** (vaikai/šuo/katė) | ⚠️ tik žmonės↔gyvūnai lygmuo (`HeroSafetyStrip`) |
| **Toksikologinė kortelė medikams/veterinarui** | ❌ nėra (yra `medikui_lt` duomenyse, bet ne kortelė) |
| **Padėjimo patarimas** (aukščiau / ant žemės / ne namuose) | ❌ nėra (yra zonos — care kontekste) |
| Vieša biblioteka (CORE paviršius) | ✅ `PublicLibrary` + `/api/catalog/public` (allowlist be care) |
| Enrich pipeline (katalogo pildymas) | ✅ `save-plant` + `batch-enrich-catalog` |
| Katalogo integralumas (write apsauga) | ❌ 🔴 `firestore.rules:84-86` — write atviras bet kuriam auth user'iui |

**Esmė:** refaktorius nėra „išimti care" — tai **CORE paviršiaus pastatymas ant esamo duomenų
pamato** + antraeilių modulių atskyrimas už flag'ų/paywall. Daug CORE primityvų (toksiškumo
badge'ai, vieša kortelė, allowlist, F1 overlay) jau egzistuoja.

---

## 3. Modulių klasifikacija

### 3.1. Backend (`api/`, `data/`)

| Modulis | Klasė | Pastaba / veiksmas |
|---|---|---|
| `api/catalog/public.js` | 🟢 CORE | Viešas saugumo paviršius. Išplėsti: naujas toksiškumo sluoksnis + „household" (ne-PII) query. |
| `api/save-plant.js` + `_lib/*` (RAG, toxicity, catalog, taxon) | 🟢 CORE | Enrich pipeline — CORE pildymo variklis. Lieka. |
| `scripts/batch-enrich-catalog.mjs` + scrape/audit scripts | 🟢 CORE | Katalogo masinis pildymas. Lieka. |
| `api/_lib/deriveToxicity-server.js` / `src/utils/deriveToxicity.js` | 🟢 CORE | Deterministinis toksiškumas. Lieka; bazė `resolveToxinProfile`. |
| `api/generate-hero.js` + `_lib/heroGen.js` + `watermark.js` | 🟢 CORE* | Vizualus identitetas (akvarelė) — CORE kortelės dalis. *AI kaštas: paliekam, bet galima flaginti/kešuoti. |
| `api/plant-image.js`, `api/rehost-image.js` | 🟢 CORE | Katalogo nuotraukų tiekimas enrich'ui. |
| `api/claude.js` (paieška) | 🟡 OPCIJA | AI paieška — kaštas; už auth+limit. Vieša paieška lieka be AI (`/api/catalog/public?q=`). |
| `api/claude/stream.js` (chat'ai) | 🟡 OPCIJA/PAYWALL | „Charakterių" pokalbiai — už paywall (`limitType:'chats'`). |
| `api/viewer.js`, `api/viewer/water.js` | 🟡 OPCIJA | Plant-sitter — care funkcija. |
| `api/passport/care.js`, `api/passport/water.js` | 🟡 OPCIJA | NFC paso care log'as — care. (Pats pasas/kortelė gali būti CORE — žr. žemiau.) |
| `api/vision-unlock.js` + `middleware.js` | 🔴 ATSISAKYTI* | Investorinės „vision" dokumento gate — ne produkto dalis. *Palikti jei reikia investoriams, bet ne CORE. |
| `/api/dev-toxicity-test` (kviečiamas, bet neegzistuoja) | 🔴 | Dev harness — pašalinti kabantį ryšį `SearchModal.jsx:186`. |

### 3.2. Frontend puslapiai (`src/pages/`)

| Ekranas | Klasė | Pastaba / veiksmas |
|---|---|---|
| `PublicLibrary.jsx` | 🟢 CORE | Viešas CORE landingas. Priekyje. |
| `PlantPassportPage.jsx` | 🟢 CORE* | „Pasas augalui" brand linija; natūralus toksikologinės kortelės hostas. *Care-log dalis lieka OPCIJA. |
| „Mano augalai" (kolekcija — dabar `Dashboard`) | 🟢 CORE | Reikalingas, kad household rizika būtų taikoma per vartotojo augalus. **Bet** care mode/forecast/reward dalis = OPCIJA (žr. 3.3). Perrėminti kaip „rizikos apžvalga + kolekcija". |
| `Biblioteka.jsx` (`nori`+`istorija`) | 🟡 OPCIJA | Asmeninė biblioteka — naudinga, bet ne CORE šerdis. Palikti; wishlist/istorija antraeiliai. |
| `Zinynas.jsx` (pastabos + chat) | 🟡 OPCIJA | Pastabos + AI chat — antraeilis turinys/paywall. |
| `History.jsx` | 🔴 ATSISAKYTI | Našlaitis (neimportuojamas). Ištrinti. |
| `Wishlist.jsx` | 🔴 ATSISAKYTI | Našlaitis (neimportuojamas). Ištrinti. |

### 3.3. Frontend komponentai / hooks / utils

| Modulis | Klasė | Pastaba |
|---|---|---|
| `PublicPlantCard.jsx`, `brand/PlantSavybesPills.jsx`, `plant-detail/HeroSafetyStrip.jsx` | 🟢 CORE | Saugumo kortelės UI — bazė per-adresatą rizikai + medikų kortelei. |
| `deriveToxicity.js`, `toxicityNarrative*`, `toxinClasses.test.js` | 🟢 CORE | Toksiškumo logika. |
| `buildPlantRagContext.js`, `preDb*`, `latinName`, `latinResolver`, `ltDictionary`, `taxonGroups`, `catalog.js`, `plantTransform.js`, `plantPromptConfig.js` | 🟢 CORE | Katalogo/identiteto/enrich infrastruktūra. |
| `PlantCard.jsx`, `brand/PlantImage`, `BrandLoader`, `T4*` | 🟢 CORE | Bendras UI pamatas (naudoja ir vieša biblioteka). |
| `SearchModal.jsx`, `EnrichmentProgress.jsx` | 🟢 CORE* | Augalo pridėjimas + enrich. *AI paieškos žingsnis — už limit/paywall. |
| `useAuth.js`, `usePlants.js`, `firebase.js`, `DetailHostContext` | 🟢 CORE | Pamatinė app infrastruktūra. |
| Care: `CareOverview`, `CareWateringSheet`, `CareSessionSummary`, `CareToast`, `CareCircuitToast`, `PostFertilizePrompt`, `ForecastCards`, `AccuracyButton`/`Sprite`, `BarcodeLifeline`, `*Forecast.js`, `careBuckets`, `careWeekStats`, `constants/careCopy` | 🟡 OPCIJA | Priežiūros app — antraeilė. Už `VITE_CARE_ENABLED` / Pro. |
| Charakteriai/chat: `PlantChat`, `CollectionChat`, `ZinynasChat`, `useChatStream`, `plantMood`, `plantChatContext`, `collectionChatContext`, `plantVoicePersona`, `icons/ChatIcons`, `brand/Mascot` | 🟡 OPCIJA/PAYWALL | „Charakteriai su pokalbiais". Maskotas gali likti kaip brand (pigus), bet chat — už paywall. |
| `widgets/WeatherWidget`, `useWeather` | 🟡 OPCIJA | Care kontekstas. |
| `widgets/CareChartWidget`, `CareHeatmapWidget` | 🟡 OPCIJA | Care analitika. |
| `widgets/ShopWidget` | 🔴 ATSISAKYTI | Affiliate/komercija — ateities durys, ne dabar. |
| `PaywallSheet.jsx`, `limits.js`, `subscription` (useAuth) | 🟡 OPCIJA (infrastruktūra) | Freemium karkasas — paliekam, naudosim antraeiliams gated. Stripe neįgyvendintas (mailto CTA). |
| `ProfileSheet` (invite'ai), `ZoneManager`/zonos | 🟡→🟢 | Invite'ai = care/sharing (OPCIJA). **Zonos** — perkelti į CORE kaip „padėjimo rizika" (zona × `kritine_veliava`; vaiko/pasiekiama tipas). |
| Facebook posting (`fbPosts`, `useAuth` FB, `AdminPanel` FB) | 🔴 ATSISAKYTI | Soc. postinimas — ne CORE; pašalinti arba užšaldyti. |
| `PinGate.jsx` + `pinLock.js` | 🔴 ATSISAKYTI | Našlaitis; hardcoded PIN. Ištrinti. |
| `dev/*` (playgrounds, PlantExport, ThemeStudio, MascotPlayground) | ⚪ DEV | Palikti (gated), ne produkcijos paviršius. |
| admin: `AdminPanel`, `LibraryEditorV2`, `AdminPendingBadge`, `QuickApproveSheet` | 🟢 CORE | Katalogo redagavimas + vartotojų valdymas — CORE (būsima ekspertų verifikacija per čia). |

---

## 4. CORE, kurį reikia pastatyti (naujas darbas)

Prioriteto tvarka:

1. 🔴 **Užrakinti `catalog` write** — `firestore.rules:86` `allow write: if isAdmin()`
   (deploy manual per Firebase Console). Be to toksiškumo duomenys nepatikimi. **Blokuoja viešinimą.**
2. **Namų profilis** — `{vaikai:bool, gyvunai:['kate','suo','paukstis','grauzikas']}`, saugomas
   `collections/{colId}.settings.household` (arba `users/{uid}`). Minimalus UI (nustatymai).
   GDPR: vaikų faktas — jautrus; saugoti minimaliai, ne-PII.
3. **`resolveToxinProfile(plant, household)`** — pagal `docs/toksiskumo-integracija.md` kontraktą;
   client+server **mirror** pora (kaip `deriveToxicity`). Gentis → `genus-toxin-map` → `toxin-classes`
   → `sunkumas_man` (max per relevant auditorijas) + audience aprašymas + `kritine_veliava`.
   Pirmenybė jam; `deriveToxicity.pavojai[]` — fallback kol žemėlapis nepilnas.
4. **Per-adresatą kortelė** — išplėsti `PublicPlantCard`/`PlantSavybesPills`: „kam ir kiek toksiška"
   su vaikų/šuns/katės ikonomis ir sunkumo skale.
5. **Toksikologinė kortelė medikams/veterinarui** — atskiras rodinys (spausdinamas/dalinamas),
   iš `toxin-classes.medikui_lt` + antidotas + dalis + šaltiniai + disclaimer. Hostas —
   `PlantPassportPage` arba atskiras `/kortele/{slug}`.
6. **Padėjimo rizika** — zonos „pasiekiama vaikui/gyvūnui" tipas × `kritine_veliava` →
   patarimas „laikyti aukščiau / ne namuose".
7. **Vieša biblioteka į priekį** — jau yra; reikia tik įjungti `VITE_PUBLIC_LIBRARY=1` prod'e ir
   dizaino pass'o (saugumo-švarūs laukai jau allowlist'inti).

---

## 5. Atskyrimo strategija (feature flag'ai + maršrutai)

Tikslas: antraeilius modulius galima **išjungti/paslėpti be CORE lūžio**. Esami primityvai tai
jau palaiko — reikia centralizuoti.

### 5.1. Ko NEreikia keisti (jau atsparu)
- **F1 overlay** (`catalog.js`): rūšiniai duomenys ateina per overlay; care laukai (`prieziura`,
  `laistymasIntervalas`, …) yra **atskiri laukai** — paslepiami UI'je **neliečiant duomenų**.
- **Vieša allowlist** (`/api/catalog/public` `PUBLIC_FIELDS`) jau atskiria saugumą nuo care —
  tai įrodymas, kad sluoksniai švariai atskiriami vienoje vietoje.
- **Lazy chunk'ai** + `mountedTabs` + `DetailHostContext`: tab'ai/modalai jau code-split.

### 5.2. Centralizuoti feature flag'ai (naujas `src/featureFlags.js`)
Pratęsti esamą `VITE_PUBLIC_LIBRARY` šabloną:
```
export const FLAGS = {
  publicLibrary: import.meta.env.DEV || import.meta.env.VITE_PUBLIC_LIBRARY === '1',
  care:   import.meta.env.VITE_CARE_ENABLED   !== '0',   // care app (default on, galima gesinti)
  chat:   import.meta.env.VITE_CHAT_ENABLED   !== '0',   // charakterių pokalbiai
  shop:   import.meta.env.VITE_SHOP_ENABLED   === '1',   // komercija (default off)
  facebook: false,                                        // užšaldyta
}
```
Gating taškai:
- **Tab'ai** (`App.jsx` `tabs[]`): CORE tab'ai visada; `zinynas` — už `FLAGS.chat`/turinio flag'o.
  Kolekcijos ekrane **care mode** — už `FLAGS.care` (`Dashboard` jau turi `onCareModeChange`).
- **Chat FAB'ai + komponentai:** `PlantChat`/`CollectionChat`/`ZinynasChat` + `useChatStream`
  tik kai `FLAGS.chat`; UI už `PaywallSheet` kai limitas.
- **Widget'ai** (`RightPanel`): `ShopWidget` už `FLAGS.shop`; care widget'ai už `FLAGS.care`.
- **Care komponentai:** `ForecastCards`, `CareOverview`, `CareWateringSheet` renderinami tik `FLAGS.care`.

### 5.3. Maršrutų perskirstymas
- **Viešas CORE** (be auth): `/` → `PublicLibrary`; `/augalai/{slug}` → vieša kortelė;
  `/kortele/{slug}` → toksikologinė (medikų) kortelė; `/p/{plantId}` → pasas. (Dabar tik `/p/{id}`
  path-based `main.jsx` — pridėti daugiau path match'ų arba įvesti lengvą router'į.)
- **Prisijungęs CORE:** „Mano augalai" (rizikos apžvalga) + namų profilis + vieša biblioteka.
- **OPCIJA/PAYWALL:** care mode, chat, Zinynas, plant-sitter — už flag'ų/Pro.

### 5.4. Backend atskyrimas
- Always-on (CORE): `/api/catalog/public`, toksiškumo derivacija, enrich pipeline, hero.
- Gated/paywall: `/api/claude` (paieška — auth+limit), `/api/claude/stream` (chat — paywall),
  `/api/viewer*`, `/api/passport/*` (care). Serverinis `checkLimit` + `subscription` jau yra.

### 5.5. Ko NEdaryti (kad nesulaužtum CORE)
- Nekeisti `deriveToxicity`/`catalog`/`taxonGroups` client↔server mirror be abiejų pusių.
- Negriauti F1 overlay — CORE rizika priklauso nuo `catalog.savybes` realtime.
- Neištrinti `subscription`/`limits` karkaso — jis reikalingas antraeilių gating.
- Care laukų **netrinti iš duomenų** — tik slėpti UI (ekspertai/ateitis gali juos naudoti).

---

## 6. Siūloma seka

**Fazė 0 — higiena/sauga (būtina pirma):**
- 🔴 `firestore.rules` catalog write → `isAdmin()` (manual deploy).
- Pašalinti kabantį `/api/dev-toxicity-test` ryšį; ištrinti našlaičius (`History.jsx`,
  `Wishlist.jsx`, `PinGate.jsx`/`pinLock.js`).
- Atnaujinti pasenusius `.md` (žr. `docs/ARCHITECTURE.md` §14).

**Fazė 1 — flag'ų karkasas (atskyrimas be lūžio):**
- `src/featureFlags.js`; apgaubti care mode, chat, Zinynas, shop/care widget'us, FB.
- Įjungti `VITE_PUBLIC_LIBRARY=1` prod'e.

**Fazė 2 — CORE branduolys:**
- Namų profilis → `resolveToxinProfile` (mirror) → per-adresatą kortelė → medikų kortelė →
  zonų padėjimo rizika.

**Fazė 3 — CORE paviršius:**
- Perrėminti „Mano augalai" į rizikos apžvalgą; vieša biblioteka + kortelės maršrutai; dizaino pass'as.

**Fazė 4 — antraeiliai (sprendimas):**
- Care ir charakteriai: palikti už paywall (pigus eksperimentas) **arba** atsisakyti — pagal
  konsiliumo „2 segmento" logiką (Stripe + Pro be lūkesčių, chat per pigesnį modelį, soft cap'ai).

**Ateitis (durys, 0 val. dabar):** „wallet" objektas; nuasmeninti agreguoti duomenys verslui
(GDPR: vartotojų duomenų neparduoti; tik nuasmeninti agregatai).

---

## 7. Rizikos
- **Katalogo write atviras** (🔴) — iki fix'o toksiškumo duomenys nepatikimi; blokuoja viešinimą.
- **Toksiškumas ne eksperto verifikuotas** (~85–90%) — reikalingas disclaimer + akademijos partnerystė;
  „nėra duomenų" geriau nei klaidinga žyma.
- **Mirror poros** (`deriveToxicity` ir kt.) — lengva prasilenkti keičiant vieną pusę.
- **AI kaštai** — chat/paieška/hero; antraeilius riboti limitais/paywall/pigesniu modeliu.
- **GDPR + vaikai** — namų profilis liečia jautrius duomenis; laikyti minimaliai, ne-PII, su DPIA.
- Teisinis (PLD griežtoji atsakomybė už app'ą) — disclaimer architektūra, saugos info 100% atvira,
  bet ne medicininis patarimas (tik „medikui" faktai + „kreipkis").

---

_Žr. taip pat: `docs/ARCHITECTURE.md`, `docs/toksiskumo-integracija.md`,
`docs/toksiskumo-klasifikacija.md`, `tasks/konsiliumas-2026-06/60-galutine-santrauka.md`._
