# LapasID — saugumo ir privatumo auditas

**Data:** 2026-11-03
**Apimtis:** `middleware.js` cookie gate, visi `api/` endpoint'ai (auth + teisės),
Firestore + Storage security rules, secrets kliento bundle'e, AI endpoint'ų
piktnaudžiavimas + rate limiting (Anthropic kaštai), prompt injection per augalų
pokalbius. Atskirai — GDPR / privatumas (namų ūkio duomenys, ištrynimas, eksportas,
ateities nuasmeninti agreguoti duomenys).
**Metodas:** statinė kodo peržiūra (branch `claude/hopeful-pascal-y1ra5g`). Prod
duomenys / Firestore / Storage NELIESTI, nieko nedeploy'inta, prod secrets nenaudoti.
**Kontekstas:** auditas atliktas pagal NAUJĄ produkto kryptį — kambarinių augalų
**toksiškumo DB** (žmonėms / vaikams / šunims / katėms), vartotojas susideda augalus
ir nurodo kas gyvena namuose. Dėl to privatumui ir namų ūkio duomenims skirta ypatinga
dalis, net jei ta funkcija dar neįgyvendinta (žr. §6).

---

## 0. Santrauka vadovybei

LapasID serverio (`api/`) sluoksnis po 2026-06-02 audito yra pataisytas gerai: Firebase
ID token'as verifikuojamas kriptografiškai (`verifyAuthToken` → `admin.auth().verifyIdToken`),
SSRF blokuojamas, secrets kliento bundle'e **nėra**. Tai geras pamatas.

**TAČIAU** pagrindinis autorizacijos sluoksnis klientui yra ne serveris, o **Firestore
security rules** (nes klientas tiesiogiai šneka su Firestore per Web SDK). Ir būtent
šis sluoksnis turi kritinių spragų, kurių ankstesni auditai nepalietė:

- **Bet kuris prisijungęs vartotojas gali tapti admin'u** (pasirašyti `isAdmin: true` į
  savo `users/{uid}` dokumentą), o tada skaityti **visų** vartotojų duomenis.
- **Bet kuris prisijungęs vartotojas gali prisidėti prie bet kurios svetimos kolekcijos**
  (rules leidžia pačiam įsirašyti į `members[]` be jokio invite patikrinimo), o kolekcijų
  ID nuteka per viešai skaitomus `invites`. Tai reiškia **visų vartotojų augalų, nuotraukų
  ir (ateityje) namų ūkio duomenų** prieinamumą.
- **AI proxy (`/api/claude`) yra atviras relay** — auth ir limitai tikrinami TIK kai
  klientas atsiunčia `limitType`. Praleidus šį lauką, bet kas (net neprisijungęs) gauna
  neribotą Anthropic prieigą mūsų sąskaita.
- **AI limitai apeinami** — skaitiklis (`aiUsage`) gyvena vartotojo paties redaguojamame
  dokumente.

Žemiau — prioritetizuotas sąrašas. **Kritinius** reikia taisyti prieš bet kokį viešą
paleidimą ir ypač prieš renkant namų ūkio duomenis apie vaikus/gyvūnus.

### Prioritetų lentelė

| # | Radinys | Prioritetas | Vieta |
|---|---|---|---|
| **K1** | AI proxy atviras relay (auth/limit tik su `limitType`) + nevaldomas client system prompt | 🔴 Kritinis | `api/claude.js:23`, `api/claude/stream.js:21` |
| **K2** | Privilegijų eskalacija iki admin per savo `users/{uid}` dokumentą | 🔴 Kritinis | `firestore.rules:25-30` |
| **K3** | Kolekcijų izoliacijos apėjimas (self-join į bet kurią kolekciją) + colId nutekėjimas | 🔴 Kritinis | `firestore.rules:50-59, 106-111` |
| **K4** | AI rate-limit apėjimas per klientui rašomą `aiUsage` / `beta` / `subscription` | 🔴 Kritinis | `api/_firestore.js:39-74`, `firestore.rules:25-30` |
| **A1** | `plant-sitter-tokens` skaitomi visiems (`if true`); `invites` sąrašas skaitomas bet kuriam authed | 🟠 Aukštas | `firestore.rules:106-127` |
| **A2** | `/api/plant-image` be auth ir be rate-limit (Brave kvotos piktnaudžiavimas) | 🟠 Aukštas | `api/plant-image.js:24` |
| **A3** | `/api/viewer/water` — read-only viewer įrašo nevaliduotą `event` objektą; nėra `expiresAt` tikrinimo | 🟠 Aukštas | `api/viewer/water.js:5-19` |
| **A4** | Storage `plants/**` — bet kuris authed skaito/rašo bet kieno nuotraukas (nėra savininko tikrinimo) | 🟠 Aukštas | `storage.rules:38-40` |
| **A5** | Vieši augalo pasai — neautentifikuoti rašymai į bet kurį viešą pasą, be rate-limit | 🟠 Aukštas | `api/passport/water.js`, `api/passport/care.js` |
| **A6** | Informacijos atskleidimas klaidų atsakymuose (`step`, `hasServiceAccount`, raw `e.message`) | 🟠 Aukštas | `api/viewer.js:35-40`, `api/claude.js:55` |
| **V1** | Vision gate: ne constant-time slaptažodžio palyginimas, viešas PEPPER, 7 d. cookie | 🟡 Vidutinis | `api/vision-unlock.js:30` |
| **V2** | SSRF liekana — DNS rebinding neuždengtas | 🟡 Vidutinis | `api/rehost-image.js:82` |
| **V3** | Nėra CORS ribojimo, robots.txt, TOS/privatumo politikos | 🟡 Vidutinis | (nėra) |
| **V4** | Savęs patvirtinimas (`approved:true`) per viešai skaitomus invites | 🟡 Vidutinis | `src/hooks/useAuth.js:148-150` |
| **V5** | 30MB nuosavų duomenų (`pfaf.json`, `pre-db.json`) kliento bundle'e | 🟡 Vidutinis | `vite.config.js` / P0-10 |
| **G1–G8** | GDPR: namų ūkio duomenys, ištrynimas, eksportas, Anthropic procesorius, agreguoti duomenys | žr. §6 | — |

---

## 1. `middleware.js` cookie gate

`middleware.js` (Vercel Edge) saugo TIK viziją (`/vision/doc`, `/vision-doc.html`) per
`vision_auth` cookie = `SHA-256(PEPPER + ':' + VISION_PASSWORD)`.

**Gerai:** fail-closed (be `VISION_PASSWORD` → blokuoja / 503), cookie `HttpOnly; Secure;
SameSite=Lax`, slaptažodis niekada nepatenka klientui (tik hash'as), matcher siauras.

**Trūkumai (žr. V1):**
- `PEPPER = 'lapasid-vision-v1'` yra viešas (repo + edge bundle). Apsauga priklauso tik
  nuo `VISION_PASSWORD` entropijos. Jei slaptažodis silpnas, cookie = `SHA256(viešas
  pepper : slaptažodis)` yra offline-brute-force'inamas.
- `password !== PASSWORD` (`vision-unlock.js:30`) — ne constant-time; teoriškai timing
  leak. Žemos vertės turtui (strateginis dok.), bet lengva pataisyti.
- 7 dienų cookie be galimybės atšaukti (jokio session invalidation).

Tai **žemos rizikos** komponentas (saugo rinkodaros/strategijos dokumentą, ne vartotojų
duomenis). Palikta kaip vidutinis prioritetas.

---

## 2. `api/` endpoint'ai — auth ir teisės

### 2.1 Autentifikuojantys endpoint'ai (gerai)

| Endpoint | Auth | Teisės | Vertinimas |
|---|---|---|---|
| `api/save-plant.js` | `verifyAuthToken` (privaloma) | membership (`isUidMember`) arba `isUidAdmin` | ✅ Teisinga |
| `api/generate-hero.js` | `verifyAuthToken` (privaloma) | — (bet kuris authed gali regeneruoti hero) | ⚠️ Nėra admin-gate, žr. pastabą |
| `api/rehost-image.js` | `verifyAuthToken` (privaloma) + SSRF guard + path whitelist | — (bet kuris authed) | ✅ Geras (V2 liekana) |
| `api/claude.js`, `api/claude/stream.js` | **tik jei `limitType`** | limit (apeinamas) | 🔴 **K1 / K4** |

**`generate-hero` pastaba:** reikalauja tik prisijungimo, ne admin. Bet kuris vartotojas
gali trigerinti Gemini/Sonnet hero generavimą bet kuriam katalogo įrašui (kaštų
piktnaudžiavimas, nors kuklesnis nei K1). Rekomenduojama gate'inti admin'u arba rate-limit'inti.

### 2.2 🔴 K1 — AI proxy atviras relay

`api/claude.js:23` ir `api/claude/stream.js:21`:

```js
if (limitType) {
  if (!idToken) return res.status(401).json({ error: 'Unauthorized' })
  uid = await verifyAuthToken(idToken)
  if (!uid)   return res.status(401).json({ error: 'Invalid token' })
  // ... limito patikra
}
// jei limitType NĖRA — jokio auth, jokio limito, tiesiai į Anthropic
```

`limitType` yra **kliento kontroliuojamas** laukas. Užtenka POST'inti į `/api/claude` su
`{ "messages": [...] }` **be** `limitType` — ir gauni neribotą, neautentifikuotą prieigą
prie `claude-sonnet-4-6` mūsų `ANTHROPIC_API_KEY` sąskaita.

**Poveikis:**
- **Anthropic kaštai** — nekontroliuojamas sąskaitos augimas (botas gali siųsti tūkstančius
  užklausų; `max_tokens` taip pat kliento kontroliuojamas → galima prašyti didelių atsakymų).
- **Atviras LLM proxy** — `system` ir `messages` perduodami Anthropic'ui **be jokio serverio
  filtravimo**. Tai reiškia, kad endpoint'as yra bendros paskirties, jailbreak'inamas Claude
  proxy (bet koks turinys, bet kokia tema) — reputacinė + Anthropic ToS rizika.

**Taisymas (įgyvendinta atskirame PR, žr. §7):** auth tikrinimą iškelti iš `if (limitType)`
bloko — kiekviena užklausa privalo turėti galiojantį Firebase ID token'ą. Limitai lieka
pagal `limitType`. (Visi teisėti klientai jau siunčia token'ą ir `limitType`: `SearchModal`
→ `searches`, `useChatStream` → `chats`.)

**Papildomai (rekomendacija):** serveris turėtų nustatyti `model` ir maksimalų `max_tokens`
pats (ne iš kliento), ir riboti/validuoti `system` (žr. §5 prompt injection).

### 2.3 Token/isPublic valdomi endpoint'ai (viešai pasiekiami)

| Endpoint | Vartai | Problema |
|---|---|---|
| `api/viewer.js` | invite `token` | Atskleidžia **visą** kolekcijos augalų sąrašą bet kam su token'u. Tikrina `active` + `expiresAt`. |
| `api/viewer/water.js` | invite `token` | 🟠 **A3** — tikrina tik `active`, **ne** `expiresAt`; priima nevaliduotą `event` objektą |
| `api/passport/water.js` | `plant-passports/{id}.isPublic` | 🟠 **A5** — neautentifikuotas rašymas, be rate-limit (bet tipas/ilgis validuojami) |
| `api/passport/care.js` | `plant-passports/{id}.isPublic` | 🟠 **A5** — kaip aukščiau (validuoja tipą, max 5 event'ai, 100 simb.) |
| `api/catalog/public.js` | — (viešas, allowlist laukai) | ✅ Allowlist teisingas; be rate-limit (cache mažina riziką) |
| `api/plant-image.js` | — (be auth) | 🟠 **A2** — Brave kvotos piktnaudžiavimas |

**🟠 A3 — `api/viewer/water.js:5-19`:**

```js
const { token, plantId, event } = req.body
// ...
const wateringEvent = event ?? { id: `w_${Date.now()}`, type: 'watering', ... }
await plantRef.update({ timeline: [wateringEvent, ...(plantSnap.data().timeline ?? [])] })
```

Viewer (pagal rolių modelį — **tik skaitymas**) gali:
1. Įrašyti **laisvos formos** `event` objektą (jokio tipo/dydžio/schemos tikrinimo) į augalo
   `timeline` → duomenų tarša, dokumento išpūtimas, galimas stored-XSS jei `komentaras`/laukai
   kažkur renderinami be escaping'o.
2. Veikia net po `expiresAt` (tikrinamas tik `active === false`).

Palyginimui `api/passport/*` validuoja tipą + riboja ilgį — `viewer/water` turi būti
sulygintas (allowlist tipai, server-built event, ilgio limitas, `expiresAt` tikra).

**🟠 A2 — `api/plant-image.js`:** be auth, be rate-limit. Anonimas gali išeikvoti Brave
2000/mėn free tier (po to $3/1000). Žinoma spraga (dok. `tasks/data-protection-sprint.md`
A7) — sąmoningai atidėta dėl auth↔cache įtampos; teisingas sprendimas = edge rate-limit
(Vercel Firewall/BotID arba per-IP counter), ne Bearer header (griauna CDN cache).

**🟠 A6 — informacijos atskleidimas:** `api/viewer.js:35-40` grąžina klientui `step`,
`e.message` ir `hasServiceAccount` — infrastruktūros detalės. `api/claude.js:55` /
`stream.js:67` grąžina raw `e?.message` (gali nutekėti Anthropic/vidinės klaidos). Klaidas
logini serveryje, klientui — bendras `server_error`.

---

## 3. Firestore + Storage security rules

Tai **svarbiausia** audito dalis, nes klientas (PWA) autorizuojamas būtent per rules, ne
per serverį. Ankstesni auditai (`tasks/audit-2026-06-02.md`) sutvarkė serverio JWT ir SSRF,
bet **rules self-escalation / horizontal-access spragų nepalietė**, nors dok. teigia
„auditas 100% uždarytas / backbone saugus" (žr. §8 — md vs kodas prieštaravimas).

### 3.1 🔴 K2 — privilegijų eskalacija iki admin

`firestore.rules:25-30`:

```
match /users/{uid} {
  allow read, write, delete: if request.auth != null && (
    request.auth.uid == uid || isAdmin()
  );
}
```

Jokio laukų ribojimo. Vartotojas turi **pilną rašymą į savo `users/{uid}` dokumentą**, o
`isAdmin()` (`firestore.rules:12-16`) tikrina būtent `users/{uid}.isAdmin == true`. Vadinasi:

**Exploit:** bet kuris prisijungęs vartotojas per Web SDK:
```js
setDoc(doc(db, 'users', MY_UID), { isAdmin: true }, { merge: true })
```
→ tampa admin'u. Tada admin branch'as atrakina:
- `users/{*}` **read** → **visų** vartotojų dokumentai (el. paštai, profiliai, o pagal naują
  kryptį — namų ūkio sudėtis: vaikai, gyvūnai);
- `users/{*}` **write/delete**, `collections/{*}` **read/write/delete**, `taxonGroups` write,
  `invites` delete.

Tas pats dokumentas leidžia nusistatyti `beta: true` ir `subscription` (žr. K4).

**Taisymas (atskiras PR, §7):** savęs rašymo (self-write) šakoje uždrausti privilegijuotus
laukus (`isAdmin`, `beta`, `subscription`, `aiUsage`); admin branch'as lieka atviras (admin
flag'as nustatomas tik per Firebase Console). `approved` laukas paliktas rašomas (reikalingas
invite auto-approve flow'ui, žr. V4).

### 3.2 🔴 K3 — kolekcijų izoliacijos apėjimas

`firestore.rules:50-59` (`collections/{colId}` update):

```
allow update: if request.auth != null && (
  request.auth.uid in resource.data.members ||
  isAdmin() ||
  (
    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['members']) &&
    request.resource.data.members.hasAll(resource.data.members) &&
    request.resource.data.members.hasAll([request.auth.uid])
  )
)
```

Trečioji šaka (invite accept flow'as) leidžia **bet kuriam** prisijungusiam vartotojui
įsirašyti save į kolekcijos `members[]` — **be jokio invite token'o patikrinimo rules
lygyje**. Užtenka žinoti `colId`. O `colId`:
- **nuteka** per `invites` (žr. A1 — `invites` sąrašą gali nuskaityti bet kuris authed),
- yra nuspėjamas: `collectionId = col_${uid.slice(0,8)}` (`src/hooks/useAuth.js:39`), o
  vartotojų UID matomi `members[]`, `roles`, `createdBy`, chat ir kt.

**Exploit:** bet kuris authed vartotojas → nuskaito `invites` sąrašą → paima svetimą `colId`
→ `updateDoc(doc(db,'collections',colId), { members: arrayUnion(MY_UID) })` → tampa nariu →
`members` branch'as suteikia **pilną read/write/delete** tos kolekcijos ir jos `plants/*`
(`firestore.rules:68-76`). Tai **visų vartotojų asmeninių augalų, nuotraukų, užrašų, o
ateityje namų ūkio duomenų** prieinamumas.

**Pastaba apie rolių modelį:** README/PROJECT.md aprašo `owner/member/viewer` roles, bet
rules jų **neatskiria** — kiekvienas `members[]` narys turi pilną rašymą; „viewer" ribojamas
tik kliente (apeinama). Dokumentuotas rolių modelis ≠ realiai užtikrinamas.

**Taisymas (reikalauja dizaino, NEįtraukta į skubų PR — žr. §7 pastaba):** prisijungimą prie
kolekcijos reikia perkelti į serverį (`/api/accept-invite`, kuris admin SDK patikrina invite
token'ą, jo galiojimą, `used`, ir tik tada prideda narį), o rules self-join šaką pašalinti.
Alternatyva vien rules lygyje (silpnesnė) — reikalauti, kad invite dokumentas būtų perduotas
ir patikrintas, bet rules negali saugiai „suvartoti" token'o. **Rekomenduojamas server-mediated
join.** Tai #1 likęs kritinis darbas.

### 3.3 Kiti rules radiniai

- **🟠 A1 — `plant-sitter-tokens/{token}` `allow read: if true`** (`firestore.rules:124-127`):
  kolekcija skaitoma **visiems** (įsk. neprisijungusius). Firestore `read` apima `list`, tad
  klientas gali nuskaityti **visą** `plant-sitter-tokens` kolekciją ir enumeruoti visus
  share-link token'us. `invites` (`:106-111`) `read: if auth != null` — bet kuris authed gali
  **listinti visus invites** (iš čia ir K3 colId nutekėjimas). Reikia: `get`-only prieiga
  pagal konkretų token'ą (ne `list`), arba perkelti validaciją į serverį (kaip `api/viewer`).
- **`catalog`, `taxonGroups`, `invites` create/write** — `catalog` write atviras bet kuriam
  authed (`:84-87`); dokumentuota kaip laikina (moderation vėliau). Žemas prioritetas, bet
  reiškia, kad vartotojas gali teršti globalų katalogą.
- **`plant-passports/{id}` read** — `isPublic == true || auth != null`: bet kuris authed mato
  **visų** pasų duomenis (ne tik viešų). Vidutinė privatumo pastaba.

### 3.4 Storage rules

`storage.rules:38-40`:
```
match /plants/{allPaths=**} {
  allow read, write: if request.auth != null;
}
```

**🟠 A4:** kelias `plants/{plantId}/...` neturi `colId`, tad taisyklė **negali** patikrinti,
ar authed vartotojas valdo tą augalą → **bet kuris prisijungęs vartotojas gali skaityti ir
rašyti bet kieno augalų nuotraukas**, jei žino `plantId`. `plantId` generuojamas silpnai
(`Math.random().toString(36).slice(2,10)`, ~8 simb. — `src/utils/plantTransform.js:7`), ne
kriptografiškai. Dokumentuota kaip „struktūrinis apribojimas, demo stage'e priimtina", bet
**pagal naują kryptį nuotraukose gali būti vaikai/namų aplinka** → privatumo rizika kyla.
Rekomenduojama: kelias `collections/{colId}/plants/{plantId}/*` + `firestore.get()` members
patikra; `catalog/*` default-deny (jau taip) palikti.

`catalog/*` hero iliustracijos daromos viešos (`makePublic()`) — sąmoninga (viešas turinys +
watermark). OK, bet hotlinking atviras (žr. `data-protection-sprint.md` B3 signed URLs).

---

## 4. Secrets kliento bundle'e

**✅ Švaru.** Patikrinta `src/` ir `api/`:
- `ANTHROPIC_API_KEY`, `BRAVE_API_KEY`, `FIREBASE_SERVICE_ACCOUNT` / `FIREBASE_PRIVATE_KEY`
  naudojami **tik** per `process.env` serverio `api/` funkcijose. Į kliento bundle'į nepatenka.
- Firebase Web `apiKey` (`src/utils/firebase.js:13`) yra **viešas identifikatorius pagal
  dizainą** (ne secret). Apsauga — HTTP referrer restrikcijos Console'je (padaryta dalinai,
  dok. P0-2). Palikta kaip žinoma, nepavojinga.
- `.gitignore` teisingai ignoruoja `.env`, `.env.local`, `.env*.local`; commit'intas tik
  `.env.example` (be reikšmių). Git istorijoje secrets failų nerasta.

**V5 (vidutinis, ne secret):** `pfaf.json` (~21MB) + `pre-db.json` (~8MB) + `species-lt-names`
emituojami į bundle'į ir pasiekiami kliento (nuosava duomenų bazė). Tai ne asmens duomenys,
bet intelektinės nuosavybės/kaštų rizika (P0-10, data-protection Phase B — server-side
derivation). UX + bandwidth problema taip pat.

---

## 5. AI piktnaudžiavimas, rate limiting, prompt injection

### 5.1 🔴 K4 — rate-limit apėjimas

Limitų logika (`api/_firestore.js:65-74` `checkLimit`): skaito `users/{uid}.aiUsage`,
`beta`, `subscription`. Skaitiklis didinamas `fsIncrement` (`:39-54`) naudojant **vartotojo
paties ID token'ą** (Firestore REST), tad write'as priklauso nuo rules — o rules (K2) leidžia
vartotojui pilnai rašyti savo dokumentą. Todėl vartotojas gali:

- `setDoc(users/MY_UID, { aiUsage: {} })` — **nunulinti skaitiklį** bet kada;
- `setDoc(users/MY_UID, { beta: true })` — **visiškai apeiti limitus** (`checkLimit` grąžina
  `false` jei `beta === true`);
- `setDoc(users/MY_UID, { subscription: { plan: 'pro', validUntil: '2099-...' }})` —
  apsimesti mokamu vartotoju.

→ efektyvaus AI kaštų limito **nėra** net prisijungusiems.

**Taisymas (atskiras PR, §7):** (1) rules uždraudžia klientui rašyti `aiUsage`/`beta`/
`subscription` (K2 fix); (2) `fsIncrement` perkeltas į **admin SDK** (serverio credentials),
kad skaitiklio didinimas nepriklausytų nuo kliento teisių ir vartotojas jo neperrašytų.
`beta`/`subscription` nustatomi tik admin/serverio.

### 5.2 Rate limiting bendrai

- Nėra **jokio** IP-based ar global rate-limit'o nė viename endpoint'e. Visi limitai —
  per-UID skaitikliai (apeinami, K4) ir tik ten, kur `limitType` (apeinama, K1).
- `/api/plant-image`, `/api/passport/*`, `/api/generate-hero` — be jokio rate-limit'o.
- **Rekomendacija:** edge-level rate limiting (Vercel Firewall / BotID arba Durable per-IP+UID
  counter su trumpu TTL) priešais AI + brangius endpoint'us. Tai vienintelis patikimas būdas
  apriboti Anthropic kaštus (per-UID skaitiklis Firestore'e nepakankamas).

### 5.3 Prompt injection per augalų pokalbius

Srautas (`src/components/PlantChat.jsx:74` → `src/hooks/useChatStream.js:69` →
`api/claude/stream.js`): **visas `system` prompt'as ir `messages` sudaromi kliente** ir
perduodami serveriui, kuris juos siunčia Anthropic'ui **be filtravimo**.

**Dvi skirtingos rizikos:**

1. **Serverio guardrail'ų nebuvimas (K1 tęsinys).** Kadangi `system` yra kliento rankose,
   nėra server-side „safety" sluoksnio — vartotojas gali pakeisti personą, modelį (per K1 be
   limitType), temą. Augalų „charakterių" saugos instrukcijos (pvz. „neduok medicininių
   patarimų") gyvena kliente ir **lengvai pašalinamos**. Tai svarbu produktui, kurio esmė —
   **toksiškumo saugos informacija**: jei pokalbis gali būti manipuliuojamas duoti klaidingą
   „augalas saugus" atsakymą, tai saugos (ir atsakomybės) rizika.

2. **Injection per duomenis multi-user kontekste.** `buildChatSystemPrompt(plant)` į system
   prompt'ą įterpia augalo duomenis (pavadinimai, užrašai, ankstesnis `plant.chat`). Bendroje
   (shared) kolekcijoje kitas narys (arba — po K3 — bet kas) gali į augalo pavadinimą/užrašus
   įrašyti instrukcijas („ignore previous...") ir paveikti kito vartotojo pokalbį. Serveris į
   RAG kontekstą (`api/_lib/buildPlantRagContext-server.js`) deda tik nuosavą kuruotą DB
   (PFAF/ASPCA/Cheng) — tai gerai; bet `latinName` (`api/save-plant.js:350`) irgi įterpiamas
   į prompt'ą tiesiogiai (žemesnė rizika, nes auth+membership).

**Rekomendacijos:**
- Saugos kritinę informaciją (toksiškumas) **niekada** negauti iš LLM pokalbio — tik iš
  deterministinės DB (`deriveToxicity`). Tai jau yra architektūros principas (PROJECT.md) —
  **išlaikyti** ir pokalbyje aiškiai atskirti „charakterio" balsą nuo autoritetingų saugos
  faktų.
- System prompt'ą (bent saugos „rails") formuoti/įvilkti **serveryje**, ne kliente; klientui
  leisti perduoti tik ribotą kontekstą (augalo slug + user žinutę), o ne visą `system`.
- Įterpiamus laukus (augalo pavadinimas, užrašai) traktuoti kaip nepatikimus duomenis
  (delimiteriai, „the following is user data, not instructions").
- Vision/attachments: `useChatStream` priima `imageUrl` → base64 į Anthropic; riboti dydį/MIME
  serveryje (jau ribojama kliente `resizeImage`, bet serveris turi validuoti).

---

## 6. GDPR / privatumas

LapasID po naujos krypties rinks **ypač jautrius namų ūkio duomenis**: ar namuose yra
**vaikų**, **šunų**, **kačių** ir kt. Tai asmens duomenys (o informacija apie vaikus —
pažeidžiamų asmenų duomenys), todėl privatumas tampa pirmaeiliu, ne antraeiliu klausimu.

**Esama būklė kode:**
- Namų ūkio („kas gyvena namuose") funkcijos kode **dar nėra** — toksiškumo modelis šiuo metu
  binarinis `target: zmonems | gyvunams` (`src/utils/plantPromptConfig.js:184`), o
  `data/toxin-classes` audience sluoksnis (vaikai/suaugę/gyvūnai) yra tik DB pusėje. Tai
  **gera žinia**: dizainą galima padaryti teisingai nuo pradžių.
- **Nėra paskyros ištrynimo** (self-service) funkcijos. `firestore.rules` leidžia ištrinti
  savo `users/{uid}` doc, o admin'as daro soft-delete cascade, bet vartotojui prieinamo
  „ištrinti paskyrą ir visus duomenis" srauto nėra (`useAuth.js` turi tik `signOut`).
- **Nėra duomenų eksporto** funkcijos.
- Chat duomenys siunčiami **Anthropic** (JAV procesorius) — perdavimas į trečiąją šalį.

### Radiniai ir rekomendacijos

**🔴 G1 — Namų ūkio duomenų minimizavimas (prieš įgyvendinant funkciją).**
Projektuojant „kas gyvena namuose": saugoti **tik vėliavėles/skaičius, reikalingus toksiškumo
filtravimui** (`hasChildren: bool`, `hasCats: bool`, `hasDogs: bool`), **NE** vaikų vardus,
amžius, gimimo datas ar sveikatos informaciją. Data-minimization + purpose-limitation (GDPR 5
str.). Jokio laisvo teksto apie vaikus.

**🔴 G2 — Teisėtas pagrindas + sutikimas.** Namų ūkio sudėtis = sutikimu (consent) grįstas
rinkimas; sutikimas aiškus, atskiras, atšaukiamas. Vaikų atveju — ypatingas atsargumas
(amžiaus riba paslaugai; jei paslauga vaikams — tėvų sutikimas, GDPR 8 str.). Sutikimo
faktą/versiją saugoti (audit trail).

**🔴 G3 — Prieigos kontrolė (priklauso nuo K2/K3/A4).** Namų ūkio ir augalų duomenys turi būti
realiai izoliuoti. **Kol K2 (admin self-escalation), K3 (self-join) ir A4 (Storage) neištaisyti,
GDPR „integralumo ir konfidencialumo" (5(1)(f)) reikalavimas pažeidžiamas** — bet kuris
vartotojas gali pasiekti kitų namų ūkio duomenis. Tai privaloma sutvarkyti prieš renkant.

**🟠 G4 — Teisė būti pamirštam (ištrynimas).** Įgyvendinti self-service „Ištrinti paskyrą":
serverio (admin SDK) cascade, kuris ištrina `users/{uid}`, jo kolekcijas + `plants/*`,
`collections/*/memberProfiles.{uid}`, Storage `plants/*` nuotraukas, `plant-passports`,
`invites` (createdBy), chat istoriją, ir Firebase Auth įrašą. Numatyti retenciją / grace
period ir patvirtinimą.

**🟠 G5 — Teisė į duomenų perkeliamumą (eksportas).** Endpoint'as, grąžinantis vartotojo
duomenis struktūrizuotu formatu (JSON): kolekcijos, augalai, timeline, užrašai, namų ūkio
nustatymai, chat. (Ne katalogo duomenys — tie nuosavi.)

**🟠 G6 — Anthropic kaip procesorius.** Chat/paieška siunčia vartotojo tekstą (ir galimai
nuotraukas su namų aplinka) į Anthropic (JAV). Reikia: (a) DPA su Anthropic; (b) privatumo
politikoje atskleisti procesorių + perdavimą į trečiąją šalį + teisinį mechanizmą (SCC);
(c) neperdavinėti namų ūkio / vaikų duomenų į prompt'ą be būtinybės (data minimization —
pvz. perduoti „yra kačių" vietoj vardų); (d) retencija (Anthropic treniruoti nenaudoja API
duomenų, bet tai dokumentuoti).

**🟡 G7 — Privatumo politika / TOS / cookie.** Šiuo metu nėra (V3). Reikia privatumo
politikos (kokie duomenys, pagrindas, procesoriai, retencija, teisės), TOS ir, jei naudojami
analitiniai/ne būtinieji cookie — sutikimo juostos. `vision_auth` + Firebase auth cookie yra
būtinieji (sutikimo nereikia), bet politikoje paminėtini.

**🟡 G8 — Ateities nuasmeninti agreguoti duomenys verslui (projektuoti iš anksto).**
Jei planuojama parduoti agreguotus duomenis verslui:
- **Sutikimas prie rinkimo** — atskiras, opt-in sutikimas šiam tikslui (negalima vėliau
  „perskirti" tikslo be naujo pagrindo; purpose limitation). Sutikimo versijavimas.
- **Tikra anonimizacija, ne pseudonimizacija.** Agregacija turi būti negrįžtama (k-anonimiškumas:
  slenkstis, pvz. ≥k namų ūkių grupėje; mažų grupių / retų augalų kombinacijų suppression;
  jokių tikslių lokacijų, laiko žymių granularumo, unikalių ID). Pseudonimizuoti duomenys
  **vis dar yra asmens duomenys** pagal GDPR.
- **Architektūra iš anksto:** atskirti „raw" asmens duomenis nuo „analytics" sluoksnio;
  anonimizacijos pipeline su dokumentuota metodika; DPIA (poveikio vertinimas) prieš paleidžiant,
  nes apima jautrius (vaikų) duomenis ir didelio masto profiliavimą.
- **Sutikimo atšaukimas** turi pašalinti vartotoją iš būsimų agregacijų.

---

## 7. Kas ištaisyta (atskiras kritinių taisymų PR)

Pagal užduotį, kritiniai taisymai pateikiami **atskirame draft PR** (branch
`claude/security-critical-fixes`). Įtraukti **saugūs, aukšto pasitikėjimo** taisymai, kurie
neardo teisėtų srautų:

1. **K1 — AI proxy privaloma auth.** `api/claude.js` + `api/claude/stream.js`: Firebase ID
   token'o patikra iškelta iš `if (limitType)` — kiekviena užklausa reikalauja galiojančio
   token'o. Limitai lieka.
2. **K2 — admin self-escalation blokas.** `firestore.rules` `users/{uid}` self-write šaka
   nebeleidžia rašyti `isAdmin` / `beta` / `subscription` / `aiUsage`. Admin branch'as
   nepaliestas (admin flag'as — tik per Console).
3. **K4 — rate-limit skaitiklis serverio pusėje.** `api/_firestore.js` `fsIncrement`
   perkeltas į admin SDK, kad `aiUsage` didinimas nepriklausytų nuo kliento teisių (dera su
   K2 rules uždraudimu rašyti `aiUsage` klientui).

**⚠️ `firestore.rules` diegiamos rankiniu būdu per Firebase Console** (repo nėra
`firebase.json` CLI deploy). PR pakeičia tik repo artefaktą; prieš diegiant prod'e
**privaloma** patikrinti invite-accept, viewer ir profile flow'us. Nieko nedeploy'inta
šio audito metu.

**Į skubų PR SĄMONINGAI NEĮTRAUKTA** (reikalauja dizaino + testavimo, rizika sulaužyti prod):
- **K3 — kolekcijos self-join** → reikia server-mediated `/api/accept-invite` (admin SDK
  tikrina invite) + rules self-join šakos pašalinimo. **#1 likęs kritinis darbas.**
- **A1 `invites`/`sitter-tokens` `list`** → perkelti validaciją į serverį arba apriboti iki
  `get` (susiję su K3).
- **A3/A4/A2** ir GDPR funkcijos (G4 ištrynimas, G5 eksportas) — atskiri darbai.

---

## 8. `.md` dokumentai vs kodas (prieštaravimai)

- **`tasks/audit-2026-06-02.md`** teigia „AUDITAS 100% UŽDARYTAS", „Backbone švarus + saugus".
  **Prieštarauja kodui:** tas auditas sutvarkė serverio JWT (P0-1) ir SSRF (P0-7), bet
  **Firestore rules self-escalation (K2), kolekcijos self-join (K3), AI proxy `limitType`
  gating (K1) ir limitų apėjimas (K4) liko neištaisyti**. „Saugus backbone" teiginys
  nepagrįstas kliento autorizacijos sluoksniui.
- **`PROJECT.md`**: „Klientas: OAuth-gated SDK" — reiškia, kad rules saugo. Realiai rules
  leidžia horizontalią prieigą (K3) ir eskalaciją (K2). Taip pat „raktas niekada klientui"
  galioja, bet „/api/claude auth-verified" galioja **tik su `limitType`** (K1).
- **README.md / PROJECT.md** aprašo roles `owner/member/viewer` — rules jų neatskiria
  (§3.2 pastaba); „viewer" tik kliente.
- **`tasks/data-protection-sprint.md`** teisingai įvardija daug rizikų (A7 plant-image,
  Phase B server proxy, open catalog), bet jo threat-model'is orientuotas į **duomenų
  vagystę/scraping** (katalogas, iliustracijos), o ne į **vartotojų tarpusavio prieigą** (K2/K3)
  — ši spraga dokumentuose nepastebėta. Threat „Personal data leaker" įvardytas kaip „žema
  tikimybė", bet realiai K2/K3 daro jį **triviliai įmanomą**.
- **Sena kryptis** (dok. `tasks/konsiliumas-2026-06/*`, EU parduotuvių reikalavimai, priežiūros
  app kaip pagrindas, NFC/hardware, marketplace) — pagal naują KONTEKSTĄ laikoma istorija;
  šiam auditui nenaudota kaip reikalavimas. Toksiškumo DB + namų ūkis yra naujas pagrindas.

---

## 9. Rekomenduojama eilės tvarka

1. **Dabar (kritiniai, prieš viešą paleidimą / namų ūkio duomenis):** K1, K2, K4 (šio audito
   PR) → tada **K3 (server-mediated invite join)** + A1.
2. **Greitai (aukšti):** A3 (viewer/water validacija + expiry), A4 (Storage members patikra),
   A2 (edge rate-limit), A6 (klaidų atsakymai), A5 (pasų rate-limit).
3. **Prieš renkant namų ūkio duomenis:** G1 (minimizavimas), G2 (sutikimas), G3 (priklauso
   nuo K2/K3/A4), G4 (ištrynimas), G5 (eksportas), G6 (Anthropic DPA + politika), G7 (privatumo
   politika/TOS).
4. **Projektuojant ateities verslo duomenis:** G8 (anonimizacija, atskiras sutikimas, DPIA).
5. **Vidutiniai / nuosava IP:** V1 (vision constant-time), V2 (DNS-pinning jei prireiks),
   V3 (CORS/robots), V5 (bundle duomenys, Phase B).

---

_Auditą atliko automatizuota statinė peržiūra. Prieš diegiant taisymus prod'e — žmogaus
peržiūra + testavimas (ypač `firestore.rules`, diegiamos rankiniu būdu per Console)._
