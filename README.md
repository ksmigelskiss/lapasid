# LapasID

Augalų kolekcijos valdymo PWA lietuvių kalba — kolekcija, priežiūros prognozės,
AI paieška su autoritetingu katalogu ir augalo pasas (QR/NFC).

Produkcija: **[lapasid.lt](https://www.lapasid.lt)**

## Funkcijos

- **Kolekcija** — augalai su nuotraukomis, statusais (sveikas / dėmesio / karantinas),
  zonomis; multi-user kolekcijos su rolėmis (owner / member / viewer) ir pakvietimais
- **Priežiūra** — laistymo / tręšimo / žiemojimo prognozės (kategorijų lentelės +
  istorijos blend), priežiūros seansai pagal zonas, care reward sistema
- **AI paieška** — dvifazė (preview + enrichment) per Claude API; foto identifikavimas;
  derminis toksiškumas iš ASPCA/PFAF šaltinių (nepriklausomai nuo AI)
- **Katalogas** — globalus rūšių katalogas su watercolor hero iliustracijomis
  (Gemini pipeline + watermark), admin redaktorius (LibraryEditorV2) su live preview
- **Augalo pasas** — vieša `/p/{plantId}` kortelė QR/NFC žymai
- **Istorija** — augalo gyvavimo timeline (laistymas, tręšimas, persodinimas, foto,
  ligos/pasveikimai); mirusių augalų memorial vaizdas
- **AI pokalbiai** — apie konkretų augalą, kolekciją ar žinyno įrašą (streaming)
- **Desktop layout** — split-panel režimas ≥1024px; mobile — bottom-sheet UI
- **PWA** — offline, instaliuojama, Workbox precache

## Tech stack

| Sritis | Technologija |
|--------|-------------|
| UI | React 18 + Vite, Tailwind CSS, Framer Motion, Lucide |
| Duomenys | Firebase Firestore + Storage; Google/Facebook OAuth |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) per `api/` serverless |
| Backend | Vercel serverless functions (`api/`) — auth-verified Firestore admin |
| Nuotraukos | iNaturalist + Wikipedia + Brave (per `api/plant-image` proxy) |
| Testai | Vitest (duomenų logikos util'ai) |
| CI | GitHub Actions — test + build ant kiekvieno push |
| Monitoring | Sentry (env-gated per `VITE_SENTRY_DSN`) |
| PWA | vite-plugin-pwa + Workbox |

## Struktūra (folderių lygiu)

```
api/                  # Vercel serverless: claude proxy, save-plant, generate-hero,
│                     # plant-image, rehost-image, passport, viewer; _lib/ = server utils
│                     # (deriveToxicity-server MIRROR'ina src/utils/deriveToxicity!)
data/                 # Šaltinių duomenys: pfaf.json, pre-db.json, aspca-*, lt-names
scripts/              # Build/migracijų skriptai (prebuild: species-lt-names)
src/
├── components/
│   ├── plant-detail/ # PlantDetail + ProfileContent + PhotoSheet + NotesContent
│   │                 # + StatusTransitionSheet + HeroSafetyStrip (refaktoras 2026-06-10)
│   ├── admin/        # AdminPanel, LibraryEditorV2 (katalogo redaktorius)
│   ├── brand/        # PlantImage (LQIP), BrandLoader, Mascot, savybes pills, T4 ženklai
│   ├── desktop/      # DesktopLayout, RightPanel (split-panel host)
│   ├── widgets/      # Care chart/heatmap, weather, shop
│   └── *.jsx         # SearchModal, PlantTimeline, PlantChat, ZoneManager, ...
├── pages/            # Dashboard, Biblioteka, Wishlist, History, Zinynas, PlantPassportPage
├── hooks/            # usePlants (Firestore sync), useAuth, useChatStream, ...
├── utils/            # Forecast'ai, deriveToxicity, catalog (F1 overlay), plantTransform, ...
└── constants/
tasks/                # Darbo dokumentai: planai, auditai, lessons.md
docs/                 # Veikimo aprašai (timeline, savybes, quality-infra, mascot)
```

Firestore (aukštu lygiu): `collections/{id}` (+ `plants` subcollection), `users`,
`catalog` (globalus, F1 reference overlay), `taxonGroups`, `invites`, `plant-passports`.

## Paleidimas

```bash
npm install
npm run dev          # localhost:3000
npm test             # vitest — duomenų logikos testai
ANALYZE=1 npm run build   # + bundle-stats.html kompozicijos analizė
```

Lokaliai reikia `.env.local` (žr. `.env.example`). Pilnas produkcijos env sąrašas —
Vercel projekte (`vercel env ls`): Firebase service account, `ANTHROPIC_API_KEY`,
`BRAVE_API_KEY`, `GOOGLE_CLIENT_*`, `VITE_SENTRY_DSN` ir kt.

## Deploy ir kokybė

- Deploy: push į `main` → Vercel auto-deploy į **lapasid.lt**
- CI (GitHub Actions) lygiagrečiai leidžia testus + build — aliarmas per ~40s,
  jei kažkas sulūžo (žr. `docs/quality-infra.md`)
- Klaidos prod'e — Sentry dashboard'e su commit'o žyme
- Vercel preview deploy'ai NEtinka verifikacijai (OAuth callback tik prod) —
  verifikacija lokaliai: build + dev server console

## Dokumentacija

- `docs/quality-infra.md` — testai, CI, Sentry, bundle analizė
- `docs/plant-history-timeline.md`, `docs/plant-savybes-logic.md`, `docs/care-rewards.md`
- `tasks/` — planai, auditai ir `lessons.md` (klaidų pamokos — skaityk prieš didelius darbus)
- `DESIGN.md` — spalvų/komponentų sistema (privaloma naujiems UI)
