# LapasID — pakeitimų eiga

Visi commit'ai `desktop-ux` branch'e nuo divergence iš `master`. Sugrupuoti pagal etapus, ne chronologinę commit datą.

## Etapas 0 — Mock infrastruktūra

Tikslas: galimybė testuot desktop UI be Firebase auth ir realios duomenų bazės.

- `src/utils/mockData.js` — 11 mock plants, 3 zonos, MOCK_USER
- `src/hooks/useAuth.js` — short-circuit'as su mock user'iu, jei `VITE_USE_MOCK_USER=true`
- `src/hooks/usePlants.js` — mock data init + skip Firestore writes
- Vercel preview env: `VITE_USE_MOCK_USER=true` Preview environment'e (ne Production)

## Etapas 1 — Layout shell

Tikslas: split panel struktūra desktop'e (≥1024px); mobile nepakeistas.

- `src/hooks/useIsDesktop.js` — matchMedia 1024px breakpoint
- `src/components/desktop/DesktopLayout.jsx` — flex h-dvh wrapper su main + RightPanel
- `src/components/desktop/RightPanel.jsx` — 430px right panel su LapasID brand placeholder'iu
- `src/components/Navigation.jsx` — `isDesktop` prop slepia bottom nav desktop'e (vėliau perkelta į DesktopHeader)
- `tailwind.config.js` — pridėtas `app.warm: #faf8f3` color
- `src/index.css` — `@media (min-width: 1024px)` panaikina `#root { max-width: 430px }` constraint'ą

## Etapas 2 — Modal portal context

Tikslas: visi top-level modal'ai desktop'e atsidaro RightPanel viduje, ne fullscreen.

- `src/contexts/DetailHostContext.jsx` — provider su `container` ref + `isActive` state'u + `open/close` API
- 4 modal'ai gauna `desktopPanel` mode (`isDesktop && host?.container`):
  - `PlantDetail.jsx` — slide-from-right + skip backdrop/drag desktop'e
  - `SearchModal.jsx` — slide-from-right + skip backdrop
  - `CareWateringSheet.jsx` — slide-from-right + skip backdrop/drag
  - `ProfileSheet.jsx` — slide-from-right (vietoj bottom-sheet) desktop'e
- `RightPanel.jsx` — portal target div + slepia brand state kai `isActive`

## Etapas 3 — DesktopHeader (top toolbar)

Tikslas: desktop'e bottom mobile nav pakeistas top juosta.

- `src/components/desktop/DesktopHeader.jsx` — h-16 top juosta:
  - Logo + `AccuracyButton` (vėliau perkelta į greeting)
  - Tabs viewport-centered (absolute) — Augalai/Biblioteka/Žinynas su badge'ais
  - Profile cluster: search + bell + avatar
- `src/pages/Dashboard.jsx` — `forwardRef` + `useImperativeHandle` (App per ref kviečia `toggleCareMode`, `openCareInfo`, `closeCareInfo`)
- Bottom Navigation slepiama desktop'e (`!isDesktop && <Navigation />`)
- Dashboard inner header (collection + counts) slepiamas desktop'e per `hideInnerHeader` prop

## Etapas 4 — AccuracyButton + Sprite

- `src/components/AccuracySprite.jsx` — designer'io exact SVG (4 stadijos pagal `careConfidence × 100`):
  - 0-24% gray sprout / 25-49% amber / 50-74% sage / 75-100% dark sage + bloom
  - `color` prop opcionalus override (AccuracyButton perduoda baltą)
- `src/components/AccuracyButton.jsx` — vientisas pill su 2 sekcijom (acc-cta + acc-meta), perkeltas į `CareOverview` greeting eilutę
- `src/components/CareOverview.jsx` — bigGreeting mode: greeting + AccuracyButton inline two-column

## Etapas 5 — Plant card visual + grid

- Plant grid responsive: `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5`
- `PlantCard.jsx`:
  - Glass pills (water + fert) top-right su daysUntil countdown
  - Color-on-overdue logika (subtle pattern, ne raudonas pill)
  - Gradient background placeholder kai nėra realios nuotraukos (12 designer'io gradient'ų)
  - Diagonal stripes overlay
  - Hover state desktop'e (`lg:hover:-translate-y-0.5 lg:hover:shadow-ios-lg`)
  - Water meter care mode'e (CareCircle ikon palieku, vėliau atstatyta)

## Etapas 6 — Greeting + bell popup + Replace pattern

- `CareOverview` naujas tonas: „X augalai gali būti ištroškę · Y prašo valgyti"
- Bell popup desktop'e — care notifications (CareSummaryList iš CareOverview extracted)
- Modal Replace pattern: top-level modal'as uždaro kitus (App.jsx `closeAllDesktopModals`)
- Slide-from-right animacijos visiems modal'ams
- Toggle pattern: tas pats trigger'is 2x → uždaro

## Etapas 7 — Search → toolbar + Stepono → ProfileSheet

- Search button toolbar'e (atidaro SearchModal)
- Stepono collection switcher pašalintas iš toolbar, perkeltas į ProfileSheet
- Search inline iš Dashboard/Biblioteka top'o pašalinta desktop'e (mobile lieka)
- Biblioteka top restruct: pašalinta dubliuojanti header (h1 + augalai count); filter inline su search

## Etapas 8 — Polish bundle

- ZonePicker portal į panel (sub-modal), back button viršuj
- PlantDetail sub-modal state'ų reset prie close ar plant.id keičiantis
- ESC key uždaro top modal'ą (PlantDetail su sub-modal awareness)
- Suvienodinti close mygtukai visuose modal'uose: X top-right, w-10 h-10
- Care action bar pill style match (rounded-full)
- AccuracyButton OFF state: kairė visada dark sage, dešinė stage spalva (su gradient)
- Biblioteka filter tabs: pill → border-b underline (PlantDetail TabBar pattern)
- Plant card pills grąžintas mobile pattern (subtle, color-on-overdue)
- Local-first paieška SearchModal'e (esami augalai prieš AI)
- SearchModal photo overflow fix (`-mx-4` → tik mobile)
- Dashboard gardener `bottom-24 lg:bottom-5` + `lg:animate-idle-float` (be 42% offset desktop'e)
- AccuracySprite visada baltas AccuracyButton'e (sage on sage matomumo fix)

## Etapas 9 — Chat balloon popover

- `CollectionChat.jsx` + `PlantChat.jsx` — `desktopPopover` prop:
  - Mobile: fullscreen modal su drag handle (kaip buvo)
  - Desktop: absolute bottom-{X} right-4 w-[380px] h-[500px] balloon, scale-up animacija nuo bottom-right
  - ESC + outside click + X uždaro

## Etapas 10 — Right panel widgets

Modulinė struktūra — kiekvienas widget'as savo failas, props-driven, reusable.

- `src/hooks/useWeather.js` — Open-Meteo API (Vilnius), 30min sessionStorage cache, plant tip euristika
- `src/hooks/useCollapsible.js` — collapse state su localStorage persistencija
- `src/utils/careWeekStats.js` — `aggregateCareWeek` (deprecated, lieka kaip moduliais) + `aggregateCareGrid` (heatmap'ui)
- `src/components/widgets/WeatherWidget.jsx` — collapsible, Vilnius oras + plant tip
- `src/components/widgets/CareHeatmapWidget.jsx` — collapsible, 8 sav heatmap su quartile gradient (atskirai water + fert max)
- `src/components/widgets/CareChartWidget.jsx` — paliktas reusable (1-savaitės bar chart, jei kur prireiks)
- `src/components/widgets/ShopWidget.jsx` — collapsible, demo offer su 2-pane grid + „Noriu" / „Pirkti" CTAs
- `RightPanel.jsx` — sandwich layout: Weather (top) → Brand center (background) → spacer → Heatmap → Shop. Brand absolute pozicija, widget'ai glass-effect (`bg-white/55 backdrop-blur-xl`) ant viršaus
- Modal slide'inasi VIRŠ widget'ų (background visada DOM'e, modal portal'inasi į z-20 target'ą)

## Bug fixes

- React #310 — `useMemo`/`useCallback` perkelti PRIEŠ auth gate'ą (hook count nepasikeisdavo per re-render'us)
- JSX syntax — komentaras po ternary `:` tappingo du root elementus
- SearchModal — `launchFullSearch` nedeklaruota → `searchByText(query)`
- Heatmap off-by-one — UTC slice'as → local date (Lietuva UTC+3 ankstyvomis valandomis dieną maišydavo)

## Deployment

- Vercel `lapasid` projektas, production branch = `desktop-ux`
- Custom domain: `lapasid.lt` + `www.lapasid.lt`
- DNS A record `@ → 76.76.21.21` + CNAME `www → cname.vercel-dns.com`
- Env vars: same as geliu-db Production (Firebase Admin + OAuth + Anthropic)
- Senasis `geliu-db` Vercel projektas nepatautas — toliau veikia ant `augalai.crazyeuropean.eu` su master branch'u
