# Plant Istorijos timeline — veikimo aprašas

_Po 2026-05 redesign'o pagal Brandbook v1.0. Šis failas — atmintinė. Jei reikės pakeisti timeline'ą ar naudoti šituos pattern'us kitur, perskaityk čia, nereiks vėl nagrinėti kodo._

**Source files:**
- `src/components/PlantTimeline.jsx` — timeline'as + visi event komponentai
- `src/components/PlantDetail.jsx` — hero swap + tab integration
- `src/components/brand/BarcodeLifeline.jsx` — care chart hero zonai

---

## Bendras vaizdas

```
┌─────────────────────────────────────────────────┐
│ ··· · VIRTUVĖ · ⊘ SVEIKAS · [X]                │ ← toolbar
├─────────────────────────────────────────────────┤
│                                                 │
│        [Hero: foto ARBA BarcodeLifeline]        │ ← 3:2 ratio
│         (priklauso nuo activeTab)               │
│                                                 │
├─────────────────────────────────────────────────┤
│ Augalas  │  Istorija  │  Užrašai                │ ← tab bar
├─────────────────────────────────────────────────┤
│                  [Įvykiai | Nuotraukos]         │ ← segmented control
│                                                 │
│ ✦ PROGNOZĖ ─────────────────────────────────    │
│   Laistymas po 5 dienų                          │
│                                                 │
│ ŠIANDIEN · 05-12 ───────────────────────────    │ ← section header (forest-700)
│ │ 💧 Laistymas (po 7 dienų)                     │ ← routine pill (compact)
│ │                                               │
│ VAKAR · 05-11 ──────────────────────────────    │
│ │ PERSODINIMAS                          [Trash] │ ← pivotal card (editorial)
│ │ VAZONO DYDIS · 14 cm                          │
│ │ Perkėliau į didesnį vazoną...                 │
│ │                                               │
│ PRIEŠ 3 DIENAS · 05-09 ─────────────────────    │
│ │ [Photo card 4:3]                              │ ← photo event
│ │                                               │
└─────────────────────────────────────────────────┘
                                            [+]
```

---

## 1 · Tab struktūra (PlantDetail)

3 tab'ai: **Augalas**, **Istorija**, **Užrašai**. Hero zona keičiasi pagal aktyvų tab'ą:

| Tab | Hero | Toolbar |
|-----|------|---------|
| Augalas | Plant foto / emoji | ··· · Zona · Status · X |
| Istorija | **BarcodeLifeline** (automatiškai) | ··· · Zona · Status · X |
| Užrašai | Plant foto / emoji | ··· · Zona · Status · X |

State `activeTab` valdomas PlantDetail.jsx. `timelineMode` ('events' \| 'photos') irgi tenai (lifted state).

---

## 2 · BarcodeLifeline hero (Istorija tab'e)

Augalo „vandens DNR" kaip barcode. Du row'ai stacked:

```
┌──────────────────────────────────────────────┐
│ 💧 LAIKAS TARP LAISTYMŲ      47 ĮV · VID 7D  │
│ ████ ███ ██████ ████ ░░░░░░░░░░░░░░░         │
│                                              │
│ 🧪 LAIKAS TARP TRĘŠIMŲ       3 ĮV · VID 30D  │
│ ████ ████ ████ ░░░░░░░░░░░░░░░░░░░░░░        │
│                                              │
│         BAL 2026 → GEG 2026                  │
└──────────────────────────────────────────────┘
```

**Logika** (`BarcodeLifeline.jsx`):
- Kiekvienas baras = vienas care įvykis chronologine tvarka (kairėn = seniausias)
- **Bar aukštis** = dienų nuo praeito to paties tipo įvykio (taller = ilgesnis pertraukis), normalizuotas 0.3–1.0
- **Spalva**: forest-700 (laistymas) / terracotta (trąšos)
- **Ghost barai** (bone-400/40, 15% aukštis) pildo eilutę iki **MIN_BARS_TARGET = 20**
- **Truncation**: kai count > **MAX_BARS = 100** — paliekam paskutinius 100, meta'oje pridedam `· NAUJAUSI 100`
- **Tooltip** (native HTML `title`): `2026-05-10 · po 7 dienų nuo praeito` realiems, `Ateities slot'as` ghost'ams

**Brand metafora:** T4Mark logo barcode'as = vandens DNR vizualinė šeima. Tas pats SVG pattern'as.

---

## 3 · View segmented control (timeline filtras)

2 mode'ai (`VIEW_MODES` PlantTimeline.jsx):
- **ĮVYKIAI** (default) — visi event'ai
- **NUOTRAUKOS** — tik `type === 'photo'`

Brandbook tab-nav pattern'as: `bg-forest-700/[0.05]` outer + bone-50 active + mono caps tracking. Sėdi virš timeline'o (po TabBar).

**Grafiko mode'o NĖRA** — BarcodeLifeline atsiranda automatiškai hero zonoje aktyvavus Istorija tab'ą.

---

## 4 · Date grouping — section header pattern

Įvykiai grupuojasi pagal datą. Kiekviena grupė turi section header'į:

```jsx
<div className="flex items-center gap-3">
  <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500 flex-shrink-0">
    {label}  {/* "ŠIANDIEN · 05-12" ar "VAKAR · 05-11" */}
  </span>
  <div className="flex-1 h-px bg-bone-400/40" />
</div>
```

**Relative label'iai** (`relativeDateLabel()` helper):
- 0 dienų → `ŠIANDIEN`
- 1 → `VAKAR`
- 2 → `UŽVAKAR`
- 3–6 → `PRIEŠ N DIENŲ` (Lt accusative: 1→DIENĄ, 2-9→DIENAS, 10-19/0/20+→DIENŲ)
- 7+ → tik data (`05-03`)

**Today vizualinis pasižymėjimas:**
- Tekstas: `text-forest-700` (vs forest-500 kitiems)
- Hairline: `bg-forest-200/60` (vs bone-400/40 kitiems)

**Tas pats pattern'as** kaip Dashboard zones (`Virtuvė · 4 ──`) ir Plant Detail Augalas sekcijos. Vienas DNA per visą app'ą.

---

## 5 · Event significance hierarchy

Įvykiai padalinti į kategorijas pagal svarbą, kiekviena turi savo vizualinį pattern'ą:

### Routine (kompaktiškas pill su inline expand)
`ActionEvent` komponentas. Tipai: **watering**, **fertilizing**, **inspection**.

```
Collapsed:  [💧] Laistymas (po 7 dienų) · NPK trąšos

Expanded (tap):
[💧] Laistymas (po 7 dienų)
─────────────────────────────────
2026-05-10                  [🗑 Ištrinti]
TRĄŠOS · NPK 15-15-15
Pirmas po žiemos
```

- Tap pill → auga žemyn (height 0 → auto, ease-out-quint 220ms)
- Expanded section: data (mono caps) + struktūriniai laukai + Ištrinti
- **Floating tooltip'o NĖRA** (mobile-first inline expand pattern)

### Pivotal (editorial card)
`PivotalEvent` + `PivotalBody`. Tipai: **repotting**, **treatment**, **move**, **note**.

```
PERSODINIMAS                              [🗑]
VAZONO DYDIS · 14 cm
Perkėliau į didesnį vazoną — šaknys jau išlindo.
```

- Kortelė: bone-50 + border-bone-400/40 (Tier 2 elevation)
- Header: mono caps type label + Trash2 dešinėje
- Body: per-type rendering (PivotalBody switch case)
- Visi laukai matomi visada — nereikia tap'inti
- Sick/quarantine period'e: glass `bg-white/55 backdrop-blur-xl`

**PIVOTAL_TYPES** Set'as PlantTimeline.jsx dispatch'inimui.

### Visual (foto card)
`PhotoEvent`. Tipas: **photo**.

- 4:3 ratio kortelė su foto + days-since overlay
- Tap → floating tooltip (paliktas, nes inline expand padarytų foto kortelę milžinišką)
- Long-press → fullscreen zoom su backdrop

### Final (special blocks)
- **death** → `DeathEvent` (INK gravity — forest-900 solid)
- **statusChange** → `StatusChangeEvent` (icon + label kompaktiškai)

---

## 6 · Predictions section

Viršuje, jei ateities prognozių yra (`computePredictions(events)` analizuoja gap'us):

```
✦ PROGNOZĖ
  Laistymas · po 5 dienų       ~kas 7 d.
```

`GhostEvent` komponentas — dashed border circle + muted text'as. Forest accent ant „prognozės" žvaigždės.

---

## 7 · Status period wrappers

Kai augalas turi `sick` ar `quarantine` periodą (status change → … → status change atgal), tos periodos event'ai gauna spalvotą wrapper'į:

| Periodas | Background | Border |
|----------|-----------|--------|
| sick | `bg-terracotta-50/40` | `border-terracotta-200/50` |
| quarantine | `bg-terracotta-50/60` | `border-terracotta/30` |

`STATUS_PERIOD_META` + `computeEventPeriods()`. Period'os event'ai turi `inPeriod=true` prop'ą — Pivotal cards tada naudoja glass bg vietoj bone-50 (kad vizualiai būtų virš spalvoto wrapper'io).

---

## 8 · WateringRun grouping

Iš eilės einantys laistymai (jokio kito tipo tarp) automatiškai grupuojami į collapsible run'ą:

```
Collapsed:
[💧] Laistymas · 04-26 – 05-10 · 4×            [▾]

Expanded:
[💧] Laistymas (po 7 dienų)
[💧] Laistymas (po 8 dienų)
[💧] Laistymas (po 6 dienų)
[💧] Laistymas (po 9 dienų)                    [▴]
```

`groupWaterings()` + `WateringRun` komponentas. Default'inai expanded kai tai naujausias run'as, kiti collapsed. State per `runExpanded` object'ą.

**Kodėl:** 47 laistymų sąrašas užkimštų timeline'ą — kiti įvykiai (persodinimai, gydymai) dingtų vizualiai. Run pattern leidžia laistymus „suspausti" ir matyti svarbius event'us.

---

## 9 · Outside click + Escape

`useEffect` PlantTimeline'e prie `activeTooltip` change:
- **Pointerdown capture phase** — jei taikinys NĖRA viduje `[data-event-tooltip]` element'o, uždaro
- **Escape key** — uždaro + `activeElement.blur()` (kad nebeliktų focus ring'o ant trigger button'o)

Wrapping element'ai su `data-event-tooltip`:
- PhotoEvent Tooltip popup'as
- ActionEvent pill'as (visas su detalėmis)

PivotalEvent ir kt. — neturi tooltip state'o, todėl nereikia.

---

## 10 · Empty states

| State | Sąlyga | Render |
|-------|--------|--------|
| **True empty** | `allEvents.length === 0` | Sprout 48px + „Istorija tuščia" + prompt'as |
| **Filter empty** | mode=photos + zero photos | Camera 32px + „Nuotraukų nėra" + prompt'as. Segmented control LIEKA matomas (kad galėtum perjungti į Įvykiai). |

---

## 11 · Animacijos suvestinė

| Element'as | Animacija | Trukmė | Ease |
|-----------|-----------|--------|------|
| Event entry | opacity + translateX | 300ms | easeOut |
| BarcodeLifeline bars | scaleY 0→1, stagger | 400ms / 12ms stagger | `[0.22, 1, 0.36, 1]` (ease-out-quint) |
| ActionEvent expand | height 0→auto + opacity | 220ms | `[0.22, 1, 0.36, 1]` |
| Photo zoom | scale + translate | spring 28/300 | — |
| Tooltip (PhotoEvent only) | scale + translate | spring 20/300 | — |

---

## 12 · Vykdomi/atidėti tobulinimai

- ✓ Section header pattern (2026-05)
- ✓ Event significance hierarchy: routine pill / pivotal card / photo card (2026-05)
- ✓ ActionEvent inline expand (2026-05)
- ✓ Outside click + ESC close (2026-05)
- ⏳ PhotoEvent inline expand (jei reikės — dabar floating tooltip)
- ⏳ Tooltip → inline expand for FAB add event sheet (atskira tema)

---

## 13 · Susiję komponentai (jei reiks koreguoti)

| Failas | Atsakomybė |
|--------|-----------|
| `PlantTimeline.jsx` | Visi event renderiai + grouping logika |
| `PlantDetail.jsx` | Tab integration + hero swap + state lift |
| `BarcodeLifeline.jsx` | Care chart kompozicija |
| `AddEventSheet.jsx` | FAB + naujo event'o forma |
| `mockData.js` | Mock plants su `timeline[]` masyvu testavimui |

---

## Reference: brandbook pamatai naudojami čia

| Pattern | Šaltinis (DESIGN_SYSTEM.md) |
|---------|----------------------------|
| Mono caps section headers | §6 Section header pattern |
| Bone-50 elevated cards | §1 Tier 2 — Elevation |
| Glass `bg-white/55` callout (period wrap) | §1 Tier 3 — Frost |
| Forest INK CTA / terracotta severity | §3 Mygtukai + §4 Status semantika |
| Editorial flow (typography hierarchy) | §15 Don'ts + §16 Daryti |
