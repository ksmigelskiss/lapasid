# Kokybės infrastruktūra — testai, CI, Sentry, bundle analizė

_Įdiegta 2026-06-10 (commit'ai `a9f30c4`…`fc7d340`). Šis failas — atmintinė, kaip
visa tai veikia ir kokie sprendimai priimti sąmoningai._

---

## Testai (Vitest)

```bash
npm test          # vienkartinis paleidimas (CI naudoja šitą)
npm run test:watch
```

**Kas testuojama — TIK gryni duomenų util'ai:**

| Failas | Kas dengiama |
|---|---|
| `src/utils/forecastBase.test.js` | Sezonų ribos (bal 1 / spa 1), addDays, computeNextDate, skipsWinter bump |
| `src/utils/wateringForecast.test.js` | Kategorijų defaults, AI intervalo pirmenybė, istorijos blend (confidence ⅓/⅔/1), outlier filtras (>3×), cross-season atmetimas, snooze per inspection, alert gating |
| `src/utils/fertilizingForecast.test.js` | Mėsėdis=NETRĘŠTI (per tipas IR per lotynišką gentį), orchidėja, žiemos skip, skipsWinter bazės bump |
| `src/utils/deriveToxicity.test.js` | PFAF severity heuristikos (stiprus/vidutinis/silpnas), de-eskalacija, tipas išvedimas, **trailing \b regresijos prikalimas** |
| `src/components/plant-detail/NotesContent.test.js` | komentaras→uzrasai migracija, note helpers |
| `src/components/plant-detail/StatusTransitionSheet.test.js` | Recovery summary (ligos dienos + gydymo eventai) |

**Konvencijos:**
- Laikas testuose — `vi.setSystemTime(new Date('....T12:00:00Z'))` (UTC vidurdienis →
  rezultatas nepriklauso nuo timezone'os; griežtai NE local-time konstruktoriai datoms,
  kurios virsta `toISOString()`).
- `vitest.config.js` atskiras nuo `vite.config.js` — kad testai nekrautų VitePWA.
- Testuojamoms private funkcijoms pridedami named exports (pvz. `derivePfafSeverity`,
  `computeRecoverySummary`) — elgesio tai nekeičia.

**Ko SĄMONINGAI nėra (ir kodėl):**
- Komponentų render testų — UI elgsena keičiasi dažnai, testai būtų trapūs; ROI solo
  projekte menkas.
- E2E (Playwright) — OAuth tik prod'e, prisijungimo automatizavimas brangus ir trapus.
- Verifikacijos standartas UI pakeitimams lieka: build + dev server + švari konsolė.

**Kodėl šitie testai egzistuoja — gyvas pavyzdys:** pirmas paleidimas rado tikrą
regresiją: `c3db196` buvo grąžinęs trailing `\b` į toxicity severity regex'us
(taisytus `3eb3081`) → „nausea/vomiting/irritation/poisonous" tekstai grąžindavo
null → PFAF toksiškumas tyliai numetamas. Pataisyta `921311e` (client+server).
Tylios duomenų klaidos — vienintelė klasė, kurios nepagauna nei build'as, nei
konsolė, nei vartotojas. Žr. `tasks/lessons.md` N+11.

---

## CI (GitHub Actions)

`.github/workflows/ci.yml` — ant kiekvieno push į `main` ir ant PR'ų:
`npm ci` → `npm test` → `npm run build`. ~40s (cache'intas npm). Free tier
2000 min/mėn — mūsų tempu neišsemiama.

**Modelis: ALIARMAS, ne užtvaras.** Vercel deploy'ina lygiagrečiai, CI nelaukdamas —
sulaužytas commit'as pasieks prod, bet raudonas ✗ + GitHub email ateis per ~minutę.
Solo + fix-forward kultūrai tai sąmoningas pasirinkimas (greitesnis feedback loop).

**Jei kada reikės tikro užtvaro** (kodas fiziškai nepasiekia prod be žalio CI):
išjungti Vercel git auto-deploy ir deploy'inti iš Action'o (`vercel deploy --prebuilt`
PO testų). ~30 min darbo. Daryti tada, kai atsiras antras žmogus arba vartotojai,
kuriems 10 min sugriuvęs prod'as skauda.

---

## Sentry (klaidos produkcijoje)

`src/utils/sentry.js` — **env-gated + dynamic import**:
- Be `VITE_SENTRY_DSN` — pilnas no-op, SDK net nekraunamas (**bundle +0KB**).
- Su DSN: `window.onerror` + `unhandledrejection` automatiškai;
  `ErrorBoundary.componentDidCatch` → `captureException` su componentStack;
  `release` = Vercel commit SHA (`__APP_COMMIT__` iš vite define).
- `tracesSampleRate: 0` — tik klaidos, be performance tracing (kvota + privatumas).
  Sentry onboarding'e pažymėta TIK „Error monitoring".

**Konfigūracija:** DSN gyvena Vercel env (`VITE_SENTRY_DSN`, Production). Įkepamas
build metu — pakeitus reikia redeploy. Aktyvuota 2026-06-10, verifikuota prod
bundle'e.

**Ko nedaryta:** source maps upload (reiktų `SENTRY_AUTH_TOKEN`; .map failų į viešą
dist NEdedam dėl data-protection). Jei prireiks skaitomesnių stack trace'ų —
`@sentry/vite-plugin` su hidden maps + upload, bet tik su auth token'u.

---

## Bundle analizė

```bash
ANALYZE=1 npm run build   # → bundle-stats.html (gitignore'intas)
```

**Diagnozė (2026-06-10):** index ~1.37MB (380KB gzip) = firebase šeima ~60%
(firestore 813KB + core 249KB + storage 77KB), framer-motion+motion-dom ~400KB,
react-dom 132KB. AdminPanel, dev playgrounds, SearchModal, PlantDetail — jau lazy.

**Quick win'ų JS chunk'uose NĖRA.** Tikrieji perf taikiniai — audito Phase B
(`tasks/data-protection-sprint.md`):
- `pfaf.json` **21MB** + `pre-db.json` **7.8MB** emituojami į dist ir fetch'inami
  kliento (3 vartotojai: `deriveToxicity`, `preDb`, `buildPlantRagContext` — skirtingi
  laukų poreikiai, todėl „slim JSON" netrivialu; teisingas fix = server-side derivation).
- `/api/catalog` proxy numestų firestore SDK (~60% index) iš kliento bundle.
