# Data Protection Sprint — Phase A · B · C

**Statusas:** PLANUOJAMAS (ne dabar — po `audit-2026-06-02.md` debug fix'ų)
**Estimuotas darbas:** Phase A — 1-2d / Phase B — 1-2 sav / Phase C — ateities kvartalas
**Priklausomybė:** P0-1 JWT verification (iš audit'o) — **būtina** prieš pradedant, kitaip visi šie fix'ai išlieka teorinai

---

## Konteksto suvestinė

LapasID yra PWA su client-side Firestore SDK. Architektūriškai tai reiškia: **bet kuris auth'intas vartotojas gali tiesiogiai paklausti Firestore'o per Web SDK ir gauti visą catalog'ą be jokio proxy/server gating'o**. Tai standartinė Firebase Web SDK architektūra, optimizuota offline UX + real-time sync, bet ne data protection.

Tikslas: ne paversti tai impossible'iniu (PWA + JS bundle = visada reverse-engineerable), bet **labai pasunkinti** mass scraping, traceable'inti leak'us, ir uždėt'i abuse circuit breaker'ius.

### Threat model — kas mūsų rūpi

| # | Threat actor | Motyvas | Tikimybė | Impact'as |
|---|---|---|---|---|
| 1 | **Konkuruojantis Lt plant app** | Pavogt cataloog'ą start'uoti panašų produktą | Vidutinė | Aukštas — daug žmogaus darbo prarasta |
| 2 | **Random scraper / scientific user** | Akademinis tyrimas, hobby botanikas | Aukšta | Žemas — bet copyright violation jei publikuojama |
| 3 | **Cost abuser** | Naudoja tavo Firebase/AI Gateway pinigams išleisti | Vidutinė | Vidutinis — $ utėliuose, gali apkainoti $$$ |
| 4 | **Personal data leaker** | Bandymas pasiekti kitų user'ių kolekcijas | Žema | Aukštas — privatumo įstatymai (LT, EU GDPR) |
| 5 | **Watercolor iliustracijų vagis** | Naudoja iliustracijas savo svetainei | Aukšta | Vidutinis — copyright + brand dilution |

Žemiausi tikimybės užima Tier 3 (DRM-style) priemonės. Aukštos tikimybės užtinka Tier 1 + 2.

### Esama būklė (kas atvira)

| Asset | Dabartinis exposure | Kas saugo |
|---|---|---|
| Catalog (Latin, LT, narrative, care) | ✅ Visiškai matomas auth'intam user'iui | Firestore rules `read: if auth != null` |
| Watercolor iliustracijos | ✅ Public Storage URLs, no auth | `heroFile.makePublic()` |
| `pre-db.json` / `pfaf.json` (botanical dataset) | ✅ Bundled į client bundle, 30MB raw | Nieko |
| AI prompts (`plantPromptConfig.js`) | ⚠️ Mišriai server + client | Mūsų sprendimu |
| Lt-names dictionary | ✅ Bundled į `species-lt-names.json` | Nieko (built per `scripts/build-lt-names-v2.mjs`) |
| User personal collection (status, photos, etc.) | 🟢 Firestore rules apsaugo per `members[]` | Firestore rules |
| User chat / komentaras | 🟢 Same | Firestore rules |

---

## Phase A — Foundations (1-2d)

**Tikslas:** Cheap + immediate friction + traceability. Niekas iš šių neapsaugos nuo determined attacker, bet:
- ~80% casual scraper'ių sustabdys
- Suteiks legal grounds + įrodymus jei prireiks DMCA / teismo
- Padarys cost spike'us matomus

### A1 · Robots.txt + meta noindex (~30 min)

**Tikslas:** Sustabdyti search engine indexing public puslapių (jeigu yra) ir set'inti norm'ą scraper'iams.

**Veiksmai:**
1. Sukurti `public/robots.txt`:
   ```
   User-agent: *
   Disallow: /admin
   Disallow: /api/

   User-agent: GPTBot
   Disallow: /

   User-agent: ClaudeBot
   Disallow: /

   User-agent: Google-Extended
   Disallow: /
   ```
2. Pridėti `<meta name="robots" content="noindex, nofollow">` į `index.html` head'ą (jei nenori, kad app shell'as būtų index'inamas)
3. Patikrinti, ar `public/` directory'oje yra dabar — Vite serv'ina iš `public/` static'ai

**Verifikacija:** Po deploy'o, `lapasid.lt/robots.txt` grąžina turinį. Google Search Console patikrinimas.

---

### A2 · Firebase Console API key restrictions (~15 min, manual)

**Tikslas:** Nors API key public, restrict'inti referrer'iai sustabdo direct REST API abuse iš ne-lapasid domain'ų.

**Veiksmai:**
1. Firebase Console → Project Settings → APIs (https://console.cloud.google.com/apis/credentials)
2. Rasti Web API key, edit
3. **Application restrictions:** HTTP referrers (web sites)
   - Add: `https://lapasid.lt/*`
   - Add: `https://*.lapasid.lt/*` (subdomains)
   - Add: `http://localhost:*/*` (dev)
   - Add: `http://localhost:3000/*` (Vite dev)
4. **API restrictions:** Restrict key — leisti tik:
   - Firebase Authentication API
   - Cloud Firestore API
   - Cloud Storage API
   - Firebase Installations API
   - Firebase Hosting API (jei naudojam)
5. Save

**Verifikacija:** Curl POST `https://firestore.googleapis.com/v1/...` su API key bet be referrer'io → 403.

⚠️ **Caveat:** Nepasieks atacker'iui per `<iframe>` su Referrer-Policy spoofing'u, bet stabdo curl/script kiddies.

---

### A3 · Watercolor watermark'inimas (~1h)

**Tikslas:** Visa generuojama iliustracija turi LapasID brand markeris kampe. Casual reposters automatiškai cite'ina šaltinį, scientific copy detection veikia.

**Du variantai:**

**A3a — Subtle visible watermark (rekomenduoju)**

Modifikuoti `api/_lib/heroGen.js` STYLE_BASE prompt'ą Gemini'ui:

```js
const STYLE_BASE = `Soft watercolor botanical illustration on warm cream paper.
... (esama formatting'a) ...

WATERMARK: Include a small, subtle "lapasid.lt" text in muted grey (#888),
2-3% canvas height, positioned bottom-right corner with 10% margin from edges.
Should be visible but not distracting from the plant illustration.`
```

Pliusas: zero post-processing'o, Gemini'as įveda tiesiog. Cheap.
Minusas: Galima nukirpti su cropping'u. Bet visada lieka pirminiame URL'e.

**A3b — Post-processing'o watermark (sharp)**

Po `forceAspect3x2()` ir `transparentizeBg()`, prieš `heroFile.save()`:

```js
import sharp from 'sharp'
const watermarkSvg = `<svg width="200" height="40"...>
  <text x="10" y="28" font-family="...">lapasid.lt</text>
</svg>`
heroBuf = await sharp(heroBuf)
  .composite([{ input: Buffer.from(watermarkSvg), gravity: 'southeast' }])
  .toBuffer()
```

Pliusas: tiksli kontrolė pozicijos, dydžio, opacity.
Minusas: tik visible, ne invisible. Vis tiek nukirpamas crop'u.

**A3c — Steganographic watermark (overkill šitam stage'ui)**

Embed'inti unique UID į pixel LSB'us, kad galėtum identify'inti, kuris user'is download'ino. Šiandien overkill, palieku Phase C.

**Rekomendacija:** A3a (Gemini prompt'o pakeitimas). Greitas, pigus, hidden in artistic style.

**Veiksmai:**
1. Update STYLE_BASE konstantą `heroGen.js`
2. Regen sample augalui, verify watercolor turi watermark
3. Optional: per `Atnaujinti foto` admin'as gali re-gen'ti esamus augalus

---

### A4 · Honeypot entries (~1h)

**Tikslas:** Tracetable canary'ai catalog'e. Jei kažkas reposts'ina mūsų data'ą, šitie unique entries paklius — galim įrodyti šaltinį.

**Veiksmai:**
1. Pridėti 2-3 fake augalus catalog'e:
   - Lotyniškas: kažkas plausible bet ne-realus (e.g. `Pseudomonstera lapasidica`)
   - Lietuviškas: unique, niekur internete ne-egzistuojantis (e.g. „Lapasido kvapnioji")
   - Tikras-atrodantis care info (kad scraper'is neatpažintų kaip honeypot)
   - Mark'inti server-side per `_honeypot: true` lauk'ą (kad mūsų UI rodytų taggintai admin'ams, normaliems user'iams nebūtų matomas)
2. Periodiškai (kas savaitę / per Cloud Function) Google search'inti:
   - „Lapasido kvapnioji"
   - „Pseudomonstera lapasidica"
3. Jei rezultatų atsiranda ne mūsų domain'e → leak indicator'ius

**Filtravimas client-side:**
```js
// resolvePlantView ar usePlants
const visiblePlants = library.filter(p => !p.refFrozen && !p._honeypot)
```

**Effort:** ~1h pirmas setup, ~5min/savaitę checking.

---

### A5 · Terms of Service + LICENSE (~2h, ne kodas)

**Tikslas:** Legal grounds DMCA / teismo atvejui.

**Veiksmai:**
1. Sukurti `LICENSE.md` repo'je (jei dar nėra) — pasirinkimas:
   - **AGPL-3.0** — copyleft, atveria source bet visi forks turi būti open
   - **CC BY-NC-SA 4.0** — content (catalog, illustrations) ne-commercial, attribution required, share-alike
   - **Proprietary** — „all rights reserved", reikės custom legal text'o
2. Sukurti `terms.html` page'ą + linkint'i iš app footer'io:
   - Data scraping draudžiamas
   - Attribution required jei publikuojama
   - Watercolor iliustracijos copyright lapasid.lt
   - Naudojimas akademiniam tyrimui — kontaktuoti
3. Pridėti TOS akceptavimą prie sign-up flow'o (Firebase Auth)

**Rekomendacija:** Pasitarti su žmogumi-juristu (~$200 vienkartinis fee LT kontekstui). Šablonai online'e geri start, bet validation reikia.

---

### A6 · Devtools + right-click „security theater" (~30 min)

**Tikslas:** Symbolic deterrent — casual scrapers paspaudžia F12, gauna „neleidžiama" — perka kitur. NEefektyvu prieš determined attacker'į.

**Veiksmai:**
1. `index.html`:
   ```html
   <script>
   document.addEventListener('contextmenu', e => e.preventDefault())
   document.addEventListener('keydown', e => {
     if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key))) {
       e.preventDefault()
     }
   })
   </script>
   ```
2. Detect DevTools open per `window.outerHeight - window.innerHeight > 200` heuristic'ą → console.warn + telemetry'į

**Caveats:**
- Accessibility cost'as (screen readers gali būti paveikti)
- 100% bypass'inama per `Disable JavaScript` browser flag
- Tiesiog **signal'inanti**, kad domeinas turi terms restriction'ą — ne tikra apsauga
- **Galim NEdaryti** — minimum effort win, bet ne ten, kur dirba realiai

**Rekomendacija:** SKIP. Per maža naudos, accessibility minus'as didesnis.

---

### A7 · plant-image (Brave proxy) abuse hardening ⚠️ TRACKED iš Block 1 (2026-06-02)

**Kontekstas:** `/api/plant-image` (Brave Image Search proxy) yra PUBLIC + be auth.
Cost-abuse rizika: anonim'as gali sudeginti Brave 2000/mėn free tier'ą unikaliomis
užklausomis. Audit'as (P0-8) siūlė „Bearer token + rate limit".

**KODĖL ATIDĖTA Block 1 metu (NE bandaid — sąmoningas scoping):**
Gilesnė analizė atskleidė **auth vs cache įtampą**. plant-image turi Vercel edge
cache 30d (`s-maxage=2592000`) — populiarūs augalai cache'inami, pakartotinės
užklausos NEmokamos Brave kvotai. Tai esminė cost-apsauga.
  - Pridėjus `Authorization: Bearer` header'į → shared CDN cache'ai dažnai
    NEcache'ina auth'intų request'ų → KIEKVIENA legit paieška kerta Brave →
    DAUGIAU kvotos sudeginama. Atvirkščias efektas.
  - Origin/Referer check (be auth header'io) → same-origin GET dažnai NEsiunčia
    nei Origin nei Referer (referrer-policy) → arba lūžta legit, arba trivialiai
    apeinama curl'u. **Tai būtų bandaid.**

**TEISINGAS SPRENDIMAS (public-release prep metu):**
Edge-level rate limiting, kuris NEpaliečia cache + NEpaliečia client'o:
  - **Vercel Firewall / BotID** (config-level, prieš function, edge) — IDEALU,
    bet gali reikalauti ne-Hobby tier'o (patikrinti planą)
  - ARBA Firestore per-IP/per-UID counter su trumpu TTL (latency, bet robust)

**4 client callsite'ai** (jei vis tiek eitume auth keliu — NErekomenduoju dėl cache):
`previewParallelFetch.js:125`, `SearchModal.jsx:964` + `:1017`,
`LibraryEditorV2.jsx:2489`. previewParallelFetch yra pure util — token per opts param.

**Statusas:** demo stage'e cost-abuse rizika maža (mažai user'ių, cache mitigation,
graceful iNat/Wiki fallback jei kvota išsemta). Daryti public-release prep metu su
tinkamu edge rate-limit setup'u. **Auth header — NE, dėl cache regresijos.**

---

### Phase A — Suvestinė

**Effort total:** ~3-5h kodas + 2h legal + 15min manual Console
**Cost:** ~$200 jurist (vienkartis)
**Apsauga delta:** Casual scrapers žemyn ~70%, traceability up 100%, legal grounds 100%

**Verifikacijos checklist'as:**
- [ ] `lapasid.lt/robots.txt` grąžina turinį
- [ ] Curl be referrer'io → 403 Firestore REST
- [ ] Nauja iliustracija turi watermark'ą
- [ ] 2 honeypot entries Firestore'e su `_honeypot: true`
- [ ] LICENSE.md + terms.html publicly available

---

## Phase B — Server proxy (1-2 sav)

**Tikslas:** Pakeisti paradigm'ą iš „client gauna visą catalog'ą per Firestore SDK" į „client klausia server'io kiekvieno reikalingo augalo". Attack surface'as susitraukia 95%.

**Architektūrinis pakeitimas (didelis):**

```
PRIEŠ (dabar):
  Browser → Firebase Web SDK → Firestore catalog/* (visi 100+ docs, real-time)

PO Phase B:
  Browser → /api/catalog/list (paginated, rate-limited)
         → /api/catalog/{slug} (per-plant, signed)
         → /api/catalog/search?q=... (server-side fuzzy)
```

### B1 · `/api/catalog/list` endpoint (~3h)

**Specifika:**
- `GET /api/catalog/list?limit=20&cursor=<doc_id>` — paginated
- Returns slim: `[{ slug, lietuviškas, lotyniskas, heroThumb, savybes.pavojingumas.yra }]`
- Be aprašymas, narrative, care details — tik tiek, kiek reikia listui rodyti
- Rate limit: 50 calls / min per UID
- Auth required (Firebase Admin SDK token verify)

**Client-side pakeitimai:**
- Remove `subscribeCatalog()` Library/Search'e
- Replace su React Query / SWR su keys per slug
- Search modal naudoja `/api/catalog/search` endpoint'ą (server-side fuzzy via fuzzysort lib)

### B2 · `/api/catalog/{slug}` endpoint (~3h)

**Specifika:**
- `GET /api/catalog/oxalis_triangularis` — full entry (be hero URL, kuris ateina per B3)
- Per-request rate limit
- Server-side decide kas matoma:
  - Free tier user'is — only top 50 plants
  - Premium user'is — full catalog
- Honeypots filter'inami server-side (atacker'is mato tik honeypots, jeigu kažką paklausia neeggzistuojančio)

### B3 · Signed Storage URLs (~2h)

**Tikslas:** Sustabdyti direct hotlinking, traceable per UID.

**Specifika:**
- Catalog entry'is **ne** turi `heroIllustration` plain URL'o
- Vietoj jo: `heroFilename` (path Storage'e, `catalog/{slug}/hero-illus.png`)
- Endpoint'as `/api/catalog/{slug}/hero-url` grąžina **signed URL'ą su 1h TTL**
- Client'as cache'ina su short TTL, regen'ina prieš expiration
- Storage objects **NE makePublic()** — be signed URL'o niekas neprieina

```js
// /api/catalog/[slug]/hero-url.js
const bucket = admin.storage().bucket(...)
const file = bucket.file(`catalog/${slug}/hero-illus.png`)
const [url] = await file.getSignedUrl({
  action: 'read',
  expires: Date.now() + 60 * 60 * 1000, // 1h
})
return res.json({ url, expiresAt: Date.now() + 60 * 60 * 1000 })
```

**Tradeoff:**
- ✅ Direct hotlinking nebeįmanomas — kiekvienas image fetch reikalauja auth
- ❌ Extra roundtrip per kiekvieną image load (mitigation: client cache + batch endpoint)
- ❌ SW caching turi prisitaikyti (TTL match'inti su signed URL TTL)

### B4 · `/api/catalog/search?q=...` endpoint (~3h)

**Tikslas:** Client'as ne turi visą catalog'ą fuzzy search'ui.

**Specifika:**
- Server-side `fuzzysort` lib pagal cached `_catalogByLang` map'ą (server module'iniame scope'e, kraunamas iš Firestore'o on cold start)
- Top 10 rezultatų grąžinami
- Rate limited (kaip B1)
- Honeypots gali atrodyti kaip rezultatai (tikslingai — pavogti pavadinimą paklausus)

### B5 · JSON bundle elimination (~4h)

**Tikslas:** `pfaf.json` (22MB) + `pre-db.json` (8MB) + `species-lt-names.json` (6MB) iš client bundle'o.

**Veiksmai:**
1. **PFAF** — server-side only. Naują `/api/lookup/pfaf?latinName=...` endpoint'ą, naudoja module-scope cache'ą.
2. **pre-db** — same approach: `/api/lookup/pre-db?query=...`
3. **species-lt-names** — server-side fallback resolveLt'ui, klienatas pasiima per /api/lookup/lt-name endpoint'ą
4. Update'inti `vite.config.js` — exclude šituos JSON'us iš bundle'o (kad neperkrauti į `dist/assets/`)

**Win:** First visit gzip transfer 3.3MB → ~500KB. UX win'as visiems user'iams.

### B6 · Anomaly tracking foundations (~3h)

**Tikslas:** Visible signal'as scraping attempts'ams. Be tikrojo blocking dar (tas Phase C), bet logging+alerting setup'as.

**Veiksmai:**
1. Cloud Function trigger ant Firestore `users/{uid}` write'ų — log'inti requestRate `{ts, endpoint, uid}` į BigQuery (arba Firestore subcollection)
2. Periodic (daily) job — analyse:
   - Top 10 users by request count
   - UIDs with >500 catalog reads / 24h
3. Alert per Slack/email if threshold viršytas
4. Manual review per Vercel logs + Firestore audit logs

**NEdarom čia:** automatic blocking (Phase C). Tik observability.

### B7 · CORS strict (~30 min)

**Tikslas:** Sensitive endpoints reject'ina ne-lapasid origin'us.

**Veiksmai:**
1. Helper'is `api/_lib/cors.js`:
   ```js
   const ALLOWED = ['https://lapasid.lt', 'https://www.lapasid.lt']
   export function checkOrigin(req, res) {
     const origin = req.headers.origin
     if (process.env.NODE_ENV === 'production' && !ALLOWED.includes(origin)) {
       res.status(403).json({ error: 'origin not allowed' })
       return false
     }
     return true
   }
   ```
2. Use'inti visuose `/api/catalog/*` endpoint'uose

---

### Phase B — Suvestinė

**Effort total:** ~15-20h focused work, ~1.5-2 savaitės palyginus su feature work'u
**Cost:** Vercel function bills'ai padidės — kiekvienas catalog read'as = Vercel invocation (~$0.20 / 1M invocations). Su 100 users × 100 reads/day = 10K invocations/day = $0.06/mėn. Nykštukinis.
**Apsauga delta:**
- Mass scraping nebeįmanoma — paginated, rate-limited
- Hotlinking sustabdytas
- Honeypots automatiškai veikia
- AI / botanical dataset nebe pasiekamas iš client bundle'o

**Verifikacijos checklist'as:**
- [ ] Curl GET `firestore.googleapis.com/.../catalog` → 403 (rules blokuoja, nors API key restrict'inti)
- [ ] `/api/catalog/list` veikia, rate-limit'as efektyvus
- [ ] Storage URL'ai signed, expire po 1h
- [ ] First visit gzip transfer < 1MB (pakl. nuo bundle audit'o)
- [ ] Anomaly tracking grąžina log'us / alerts

**Pareiškia naują foundation'ą** — Phase C galimas (subscription gating, automatic blocking).

---

## Phase C — Tolimesnė ateitis (kvartalas+)

**Statusas:** Vision'inis. Įgyvendinama tik kai turim:
- Paid users (subscription revenue justifies effort)
- Žmogus moderation'ui (anomaly response'as ne tik automatinis)
- Stable backbone'as (Phase A+B padaryta)

### C1 · Subscription gating

- Free tier limit'as: max 10 augalų savo collection
- Bendroji biblioteka tik premium ($X/mėn) — esamiems user'iams pereiti į grace period
- AI chat tik premium
- Hero regen / admin features tik admin'ams visada

**Stripe / Paddle integration**, Firebase Auth custom claims, server-side subscription validation.

### C2 · Automatic blocking + anomaly response

- Cloud Function — jei UID viršija X reads/min → temporary block (15 min), email warning
- Repeat offenders → permanent ban (revoke Auth token, blacklist IP if can identify)
- ML detection — pattern'ai (sequential slug fetches, no UI interactions) → flag suspicious

### C3 · Steganographic watermarks per UID

- Embed UID hash į iliustracijos pixel LSB'us
- Po leak'o reverse search → identify konkretų user'į

### C4 · WebGL canvas rendering (text security)

- Aprašymas, narrative rodomas per `<canvas>` (pixel'inis tekstas)
- Selection / copy-paste / OCR — pasunkinta
- Tradeoffs: accessibility crash, SEO crash, bundle size up
- Worth it tik jei iš tikrųjų svarbu

### C5 · Native mobile app

- Native iOS / Android (React Native arba Flutter)
- DRM per App Store / Play Store certificate pinning
- API requests signed su device-specific keys
- Šitas yra **didelis projektas**, ne enhancement — atskiras milestone

---

## Dependencies + Sequencing

```
Audit fix'ai (audit-2026-06-02.md)
  └─ P0-1 JWT verification ✓ BŪTINA pirma
      │
      ▼
  Phase A — Foundations (1-2d, low risk)
      ├─ A1 robots.txt
      ├─ A2 Console restrictions
      ├─ A3 Watermark (Gemini prompt)
      ├─ A4 Honeypots
      ├─ A5 TOS / LICENSE
      ▼
  Phase B — Server proxy (1-2 sav, high refactor)
      ├─ B1-B4 /api/catalog/* endpoints
      ├─ B5 JSON bundle elimination
      ├─ B6 Anomaly tracking foundations
      ├─ B7 CORS strict
      ▼
  Phase C — Future (kvartalas+)
      ├─ C1 Subscription gating
      ├─ C2 Automatic blocking
      ├─ C3 Steganographic watermarks
      ├─ C4 WebGL canvas
      ├─ C5 Native mobile
```

---

## Success criteria

**Po Phase A:**
- Casual scraping (curl scripts, browser extensions) sumažėjo ~70%
- Traceability per honeypots = 100%
- Legal grounds for DMCA = ✓

**Po Phase B:**
- Direct Firestore REST API ne-naudingas (catalog/* read blocked per rules + server proxy)
- Mass scraping per Web SDK ne-įmanomas (rate limits)
- First visit transfer < 1MB
- Watercolor hotlinking sustabdytas
- Anomaly visibility = stebime patterns realtime

**Po Phase C (vizija):**
- Sustainable revenue per subscription model
- Active anti-abuse posture (blocking + alerting)
- Traceability per individual user (steganographic)
- Native app brand presence

---

## Decision points

Šios spręstina prieš pradedant:

1. **Pasirinkti LICENSE** — AGPL vs CC vs Proprietary? (Affects A5)
2. **Watermark style** — Gemini prompt (A3a) vs sharp post-process (A3b)? (Rekomendacija: a)
3. **Subscription model** — Phase C punctum: kada uždedam paywall? Reikia user count + retention duomenų prieš sprendžiant.
4. **Premium UX/price** — Phase C: $X/mėn? Lt rinkai kas adekvatu? Survey + competitive research'as.

---

## Next steps (kai paruošti)

1. **Read this doc** + audit-2026-06-02.md
2. **Confirm Phase A scope** — ar visi 5 taškai (A1-A5) tinka? Skip A6 (security theater).
3. **Estimate Phase B impact** — admin'iniai endpoint'ai keisis daug; reikia paplanui-pertekstui
4. **Decision points** — atsakymai prieš pradedant
5. **Sprint planning** — paskaičiuoti `tasks/todo.md` įrašus per Phase A, B
6. **Build dashboards** — anomaly tracking iš Phase B nori vizualizuoti

---

## Žinoma — kas NE'sprendžiama

- **PWA reverse engineering** — JS bundle'as visada decompil'iuojamas. Apsauga = friction + traceability, ne impossibility.
- **Screen capture** — niekada nesustabdys (OS lygmens screenshot'as)
- **Authorized leak** — premium user'is gali downloads'inti viską ir publikuoti. Watermark / honeypot įrodys, bet ne sustabdys.

Šitie yra inherent PWA constraint'ai. Native app + DRM yra atsakas, bet projekto stage'as šito dar nepalaiko.

**Bottom line:** Phase A+B padarys atakų cost'ą didesnį už value gain'ą daugumai. Tai ir yra realistic goal'as.
