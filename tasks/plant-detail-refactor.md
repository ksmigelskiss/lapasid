# PlantDetail.jsx refaktoras — ✅ BAIGTA (2026-06-10)

**Statusas:** ✅ įgyvendinta per 7 fazes, kiekviena — atskiras commit'as su `npm run build` + push į main.
Commit'ai: `41d31d7` (dead code) → `50ed7b9` (move) → `12243fe` (PhotoSheet) → `4233e3d` (StatusSheet) → `2e7d753` (Notes) → `84c1148` (SafetyStrip) → `66812d8` (ProfileContent).

**Kontekstas:** failas refaktoro metu buvo **2289 eil.** (ne 1455, kaip rašyta sename plane — užaugo su hero galerija/zoom, HeroSafetyStrip, action menu, desktop panel). Pastaba: senas plano teiginys „ProfileContent naudojama SearchModal.jsx" nebegaliojo — tas importas buvo miręs (pakeistas Phase1SlimPreview) ir ištrintas 0 fazėje kartu su cikliniu importu (PlantDetail ↔ SearchModal per TOOL_*).

---

## Galutinis layout'as

```
src/components/plant-detail/
├── PlantDetail.jsx            912 eil.  default — orkestratorius (state, effects,
│                              toolbar, hero galerija+zoom, sub-modalų hostingas,
│                              privatus TabBar)
├── ProfileContent.jsx         673 eil.  named { ProfileContent }
│                              privatūs: DotScore, Stars, Section, safeStringValue,
│                              InfoRow, CareRow, SkeletonLines, PassportSection
├── PhotoSheet.jsx             200 eil.  default
├── NotesContent.jsx           207 eil.  default + named { loadNotes, mkNoteId, noteToday }
│                              privatūs: extractNoteTitle, extractNoteBody, NoteCard
├── StatusTransitionSheet.jsx  197 eil.  default
│                              privatūs: BottomSheet, computeRecoverySummary, sheetDaysBetween
└── HeroSafetyStrip.jsx        118 eil.  default
```

Main: 2289 → 912 eil. (−60%). Importų pasikeitimai už folderio ribų:
- `App.jsx:50` — lazy path → `./components/plant-detail/PlantDetail`
- `admin/LibraryEditorV2.jsx:41` — `ProfileContent` iš `../plant-detail/ProfileContent`
- `SearchModal.jsx` — miręs `ProfileContent` importas ištrintas (ciklas nutrauktas)

ProfileContent liko folderyje (ne top-level, kaip siūlė senas planas) — realūs
vartotojai tik PlantDetail + admin preview, dual-usage argumentas nebegaliojo.

## Kas SĄMONINGAI neskaldyta (ir kodėl)

- **TabBar** — 35 eil., vienas vartotojas, tab state gyvena main'e. Laikytasi seno
  principo „tab navigation palikti šalia".
- **Toolbar** — reikėtų ~12 props su 5 state setters, kurių skaitytojai
  (reset-on-close / reset-on-plant / ESC effects) privalo likti main'e.
  Grynas skaldymas dėl skaldymo.
- **HeroSection** (galerija + long-press zoom + collapse) — ~235 eil. tankiausios
  interakcijų logikos (movement-cancel, vibrate, zoom portal, collapse hysteresis)
  be funkcinės naudos iškėlus. Vertinti iš naujo, jei main vėl augs.
- **Hooks (useHeroLongPress / usePlantNamesFetch / useDragToClose)** — po vieną
  vartotoją; drag thresholds skiriasi (main 120 vs BottomSheet 100) — parametrizacija
  būtų indirekcija be naudos. `src/hooks/useLongPress.js` NEunifikuotas — kita semantika
  (hero: 10px movement-cancel, 450ms, position tracking).

## Verifikacija

- Kiekviena fazė: `npm run build` žalias prieš commit.
- Po 6 fazės: dev serveris, švari konsolė, visi 6 moduliai + SearchModal +
  LibraryEditorV2 užkrauti runtime per dynamic import — visi exports teisingi.
- Galutiniai grep'ai: senų `components/PlantDetail` kelių nuorodų src/ nėra;
  main lucide importas suplonėjo iki 10 realiai naudojamų ikonų; `auth`,
  `ensureArray`, `getEnrichmentFailureReason`, `getFertilizingSummary`,
  `PlantSavybesPills`, `BrandLoader`, `ForecastCards` iš main dingo.

## Principas (paliekamas ateičiai)

> „Švarus pagrindas" reiškia ne minimalūs failai, o **aiškios atskirtys**.
> Komponentai, kurie yra vienos koncepcijos vienetai (modal'as, tab content,
> savarankiški UI blokai) — į savus failus. Maži wrappers ir glaudžiai susijusi
> navigacija — palikti šalia. Skaldyti tik dėl skaldymo blogai.
