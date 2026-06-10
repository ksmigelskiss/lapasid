# LapasID — projekto aprašymas

Augalų kolekcijos valdymo PWA lietuvių kalba. Multi-user, su globaliu rūšių
katalogu ir AI enrichment pipeline'u. Funkcijos ir folderių struktūra — `README.md`.

_Atnaujinta 2026-06-10. Domeno logikos detalėms source of truth — kodas ir `docs/`;
čia tik architektūrinis žemėlapis._

## Išoriniai servisai

| Servisas | Kam | Pastabos |
|---|---|---|
| **Anthropic Claude API** | Paieška (2 fazės), chat'ai, vision identifikavimas | `claude-sonnet-4-6`; TIK per `api/` serverless (raktas niekada klientui) |
| **Firebase Firestore** | Duomenys + realtime sync | Klientas: OAuth-gated SDK; serveris: admin SDK su `verifyIdToken` |
| **Firebase Storage** | Vartotojų nuotraukos | `storage.rules` version-controlled repo'jyje |
| **Firebase Auth** | Google + Facebook OAuth | OAuth callback veikia TIK prod (lapasid.lt) — ne preview |
| **Brave Search API** | Augalų foto discovery | Per `api/plant-image` proxy (kvotų apsauga — žr. data-protection A7) |
| **iNaturalist / GBIF / Wikipedia** | LT pavadinimai, taxon ID, foto fallback | Nemokami, be raktų |
| **Gemini** | Watercolor hero iliustracijos | `api/_lib/heroGen.js` pipeline + watermark |
| **Sentry** | Klaidos prod'e | Env-gated; žr. `docs/quality-infra.md` |
| **Vercel** | Hosting + serverless | Auto-deploy iš `main`; prod: **lapasid.lt** |
| **GitHub** | Kodas + CI | github.com/ksmigelskiss/lapasid; Actions: test+build ant push |

## Environment kintamieji

**Kliento (VITE_, įkepa build metu):** `VITE_SENTRY_DSN`, `VITE_USE_MOCK_USER`,
`VITE_USE_SERVERSIDE_SAVE`. Visi neprivalomi — žr. `.env.example`. Firebase kliento
config — kode (`src/utils/firebase.js`), saugomas Console referrer restrictions.

**Serverio (tik Vercel env, į klientą nepatenka):** `ANTHROPIC_API_KEY`,
`BRAVE_API_KEY`, `FIREBASE_SERVICE_ACCOUNT` / `FIREBASE_PRIVATE_KEY` /
`FIREBASE_CLIENT_EMAIL`, `GOOGLE_CLIENT_ID/SECRET`, `AI_GATEWAY_API_KEY`,
`VISION_PASSWORD`. Pilnas sąrašas: `vercel env ls`.

## Firestore struktūra (aukštu lygiu)

```
collections/{collectionId}        — kolekcija (members, rolės: owner/member/viewer)
└── plants/{plantId}              — augalai (timeline, uzrasai, zonos, statusai)
users/{uid}                       — vartotojo meta (isAdmin, ...)
catalog/{slug}                    — GLOBALUS rūšių katalogas (F1 reference overlay)
taxonGroups/{id}                  — rūšių/serijų grupavimas (species, genus-care)
invites/{code}                    — pakvietimai į kolekcijas
plant-passports/{plantId}         — viešos paso kortelės (/p/{id})
```

## Domeno modelis (trumpai)

- `kategorija`: `auginama` | `nori` (grynas wishlist) | `istorija` (buvę augalai,
  `historyKind`: died / removed). Gyvavimo ciklo logika: `src/hooks/usePlants.js`
  (markAsDied, markAsRemoved, regrowPlant=fork).
- `status`: `healthy` | `sick` | `quarantine` (+ `numire` perėjimas → istorija).
  Perėjimų UI: `src/components/plant-detail/StatusTransitionSheet.jsx`.
- Prognozės: kategorijų lentelės + istorijos blend — `src/utils/wateringForecast.js`,
  `fertilizingForecast.js` (testuota, žr. `docs/quality-infra.md`).

## Architektūros kertiniai sprendimai

- **F1 reference overlay** (`src/utils/catalog.js`) — katalogo pataisymai pasiekia
  visus user augalus realtime per `resolvePlantView`, be denormalizacijos. Miręs
  augalas (`refFrozen`) — įšaldytas snapshot.
- **Derminis toksiškumas** (`src/utils/deriveToxicity.js`) — NEPRIKLAUSOMAI nuo AI,
  tiesiai iš ASPCA/PFAF šaltinių (AI nepatikimas safety laukams). Client ir server
  kopijos — **MIRROR, keičiamos tik kartu** (žr. `tasks/lessons.md` N+11).
- **Foto modelis** — `plant.image` = TIK asmeninė user foto; katalogo watercolor
  hero (`heroThumb`/`heroIllustration`) visais kitais atvejais. Žr. backbone docs.
- **Deploy modelis** — push į `main` → prod, be staging (OAuth preview neveikia).
  Saugos tinklas: CI aliarmas (~40s) + Sentry. Žr. `docs/quality-infra.md`.

## PWA

`vite-plugin-pwa` + Workbox, `registerType: 'prompt'` (ne autoUpdate — kad SW
tyliai nepakeistų bundle'o po deploy'aus). Cache strategijos — `vite.config.js`
(source of truth).
