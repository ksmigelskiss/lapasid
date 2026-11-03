# LapasID — desktop redesign

Šis aplankas dokumentuoja **LapasID** projekto darbą — naujos desktop versijos kūrimą ant `geliu-db` codebase'o.

## Kontekstas

Originalus `geliu-db` (master branch) yra mobile-first PWA, deploy'inta ant `augalai.crazyeuropean.eu`. Tai liks kaip asmeninė versija — be jokių pakeitimų.

**LapasID** yra naujos kartos versija su pilnu desktop UI, deploy'inta atskirai ant `lapasid.lt`. Ateityje gaus ir naują mobile UI (atskira fazė).

| | augalai.crazyeur... | lapasid.lt |
|---|---------------------|------------|
| Branch | `master` | `desktop-ux` |
| Vercel project | `geliu-db` | `lapasid` |
| UI | mobile only | desktop + mobile (mobile redesign vėliau) |
| Codebase | bendras | bendras (kol nesiskirs) |

## Repo strategija

Kol mobile redesign nepradėtas — **vienas repo, dvi šakos**. Bendras kodas (Firebase, hooks, utils) dalinamas. Skirtumai izoliuoti per `useIsDesktop()` branch'ing'ą.

Kai pradėsim LapasID mobile redesign'ą, repo'jys natūraliai diverguos — tada cleanly atskiriam į `lapasid` repo (su pilna git history per `git push`).

## Doc struktūra

| Failas | Aprašymas |
|--------|-----------|
| [README.md](README.md) | Šis failas — overview + nuorodos |
| [CHANGES.md](CHANGES.md) | Pilna chronologinė LapasID darbo eiga (Etapas po Etapo) |
| [desktop-architecture.md](desktop-architecture.md) | Techniniai pattern'ai — modal portal, Replace pattern, isDesktop branching, DetailHostContext |
| [widgets.md](widgets.md) | Right panel widget'ai — module pattern, Weather + Heatmap + Shop spec'os |
| [accuracy-button.md](accuracy-button.md) | AccuracyButton + AccuracySprite spec'as (4 stadijos) |
| [desktop-ux-original-plan.md](desktop-ux-original-plan.md) | Originalus planas (Etapas 0-6), istorinis — daugelio dalykų scope'as evoliucionavo |

## Quick reference

**Kur kas yra:**

- **Desktop layout** — `src/components/desktop/DesktopLayout.jsx`
- **Top toolbar** — `src/components/desktop/DesktopHeader.jsx`
- **Right panel** — `src/components/desktop/RightPanel.jsx`
- **Modal portal context** — `src/contexts/DetailHostContext.jsx`
- **Widgets** — `src/components/widgets/{Weather,CareHeatmap,Shop,CareChart}Widget.jsx`
- **Custom hooks** — `src/hooks/{useIsDesktop,useWeather,useCollapsible}.js`
- **Heatmap data** — `src/utils/careWeekStats.js` (`aggregateCareGrid`)

**Kur master nepasikeitė:**

- `src/utils/firebase.js`, `src/utils/wateringForecast.js`, `src/utils/careBuckets.js` — shared backend logika
- `api/*` — server endpoints (Anthropic proxy, OAuth, viewer auth)
- `src/components/PlantTimeline.jsx`, kt. data komponentai

## Deployment

- **Lapasid Vercel projektas:** production branch = `desktop-ux`
- **Domain:** `lapasid.lt` + `www.lapasid.lt`
- **Env vars:** Same as geliu-db (Firebase Admin + OAuth + Anthropic) — be `VITE_USE_MOCK_USER`
- **Push į `desktop-ux`** = auto-deploy lapasid.lt
- **Push į `master`** = auto-deploy augalai.crazyeur... (atskiras Vercel projektas, nepalietas)

DNS: A `@ → 76.76.21.21` + CNAME `www → cname.vercel-dns.com`. Po DNS propagation Vercel auto-provisionins SSL.

**Firebase:** Authorized Domains pridėti `lapasid.lt` + `www.lapasid.lt`.
**Google OAuth:** Authorized redirect URIs pridėti `https://lapasid.lt/api/auth/callback` + `https://www.lapasid.lt/api/auth/callback`.
