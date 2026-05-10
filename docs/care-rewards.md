# Care reward sistema

Skatinimo / gratification sistema, naudojama priežiūros (care mode) flow'e.
Tikslas — kurti emocinį ryšį su appsu per pozityvius mikro-momentus, ne pamokslavimą.

---

## Filosofija

- **Tonas — skatinimas, ne kaltinimas.** „Pamiršai" → „augalas atsigauna". Sąlygos galėjo pasikeisti, vartotojas galėjo sąmoningai patikrinti ir palaikyti pauzę.
- **Reward = sistemos tobulėjimas.** Vartotojas ne tik prižiūri augalus — kartu „moko" algoritmą. Confidence delta („+4%") rodo, kad jo veiksmai daro algoritmą tikslesnį.
- **Mikro-momentai per veiksmą + summary sesijos pabaigoje.** Du sluoksniai: instant gratification (toast) + recap (summary).

---

## Failų schema

| Failas | Vaidmuo |
|--------|---------|
| [src/constants/careCopy.js](../src/constants/careCopy.js) | **Visos frazės.** Single šaltinis tonui ir žodynui. Be unicode emojis (Lucide ikonas parinka komponentai pagal bucket'ą). Plus helper'iai: `pick()`, `fillTemplate()`, `plPlants()`, `plPlantsInstr()`. |
| [src/utils/careBuckets.js](../src/utils/careBuckets.js) | **Bucket logika.** `bucketByDays()` — kategorizuoja pagal `daysUntil`. `bucketCounts()` — agreguoja. `moodFromCounts()` — bendros nuotaikos. `aggregateConfidence()`, `confidenceLabel()` — pasitikėjimo helper'iai. |
| [src/utils/wateringForecast.js](../src/utils/wateringForecast.js) | **Confidence šaltinis.** `getWateringForecast()` grąžina `confidence`, `historicalAvg`, `validGapsCount`, `theoreticalInterval` — naudojami delta skaičiavimui ir summary. |
| [src/components/CareToast.jsx](../src/components/CareToast.jsx) | Per-action top toast (delta variantas). Minimalus: `+X% [frazė]`. Auto-fade 3s. Skip jei delta=0. |
| [src/components/CareCircuitToast.jsx](../src/components/CareCircuitToast.jsx) | Per-action top toast (circuit variantas). Sage-500 bg + Check + „Virtuvė pasirūpinta". Auto-fade 3.5s. Prioritetas virš delta. |
| [src/components/CareSessionSummary.jsx](../src/components/CareSessionSummary.jsx) | Modal po care mode išėjimo (jei buvo veiksmų). Aggregate breakdown + sesijos delta. Auto-close 10s + tap-anywhere. |
| [src/pages/Dashboard.jsx](../src/pages/Dashboard.jsx) | **Wiring**: confidence badge ant Sprout mygtuko, session tracking (`sessionRef`), `showCareToast()`, `runCareToastDemo()`, `runSessionSummaryDemo()`. |

---

## Bucket'inimo lentelė

`bucketByDays(daysUntil)` grąžina:

| Bucket | Sąlyga | Reikšmė | Lt. label (CARE_COPY.bulk.label) |
|--------|--------|---------|----------------------------------|
| `perfect` | `\|daysUntil\| ≤ 1` | Pataikei lygiai į prognozę | `laiku` |
| `early` | `daysUntil ≥ 2` | Šiek tiek anksti — sausa žemė | `anksti` |
| `late` | `-5 ≤ daysUntil ≤ -2` | Šiek tiek po prognozės | `ramiai` |
| `waylate` | `daysUntil < -5` | Daug po prognozės | `po pauzės` |

**Vizualinis mapping** (CareToast / CareSessionSummary `BUCKET_META`):

| Bucket | Lucide ikona | Spalva | Kodėl |
|--------|--------------|--------|-------|
| `perfect` | `Sprout` | `text-sage-600` | Augimas, sėkmė |
| `early` | `Droplets` | `text-sky-500` | Vandens linkmė, atsargumas |
| `late` | `Clock` | `text-amber-500` | Laiko linkmė, neutralus |
| `waylate` | `Heart` | `text-rose-500` | Šiluma, jokio blame |

---

## Confidence sistema

**Per-augalo `confidence`** (skaičiuojama [wateringForecast.js](../src/utils/wateringForecast.js)):
```
validGaps = same-season tarpai tarp watering eventų
confidence = min(validGaps.length / 3, 1.0)
```

T.y. 0–1 valid gap = 0–33%, 2 = 67%, 3+ = 100%.

**Aggregate confidence** (per visus auginama augalus, `aggregateConfidence()`):
```
aggregate = mean(per_plant_confidences)
```

**Confidence pill ant Sprout mygtuko** (Dashboard.jsx, kai `!careMode`):
- `< 33%` → `bg-gray-300` (susipažįstam)
- `33–66%` → `bg-amber-400` (mokausi)
- `≥ 66%` → `bg-sage-500` (pažįstu gerai)

---

## Confidence delta

**Logika:** kiekvienas watering veiksmas gali padidinti per-augalo confidence (nuo 1 valid gap → 2 → 3 ...). Aggregate delta = `sum(plant_deltas) / total_plants_in_collection`.

**Skaičiavimas** (Dashboard.jsx `computeWateringDelta()`):
1. Kiekvienam paliestam augalui skaičiuoti `confidence_before`
2. Sukurti virtualų `simPlant.timeline = [newEvent, ...existing]` (be DB)
3. Skaičiuoti `confidence_after` ant simPlant
4. Delta = `(after - before)` per augalą, sum, dalinama iš total
5. Tik watering events keičia confidence — fert/inspection delta = 0

**Linijinė savybė:** per-action deltų suma == kumuliatyvi sesijos delta. Todėl session.deltaPct kaupiama paprastu `+=`.

**Performance:** Pure JS, ~O(plants × timelineEvents) per veiksmą. Trivialus overhead.

---

## Reward'ų stack'as

### 1. Confidence pill (visada matomas)

Mažas badge ant Sprout mygtuko viršaus dešinio kampo. Spalva pagal aggregate confidence. Nuolatinis vizualinis priminimas, kad sistema „mokosi".

### 2. Per-action top toast (instant gratification)

Po Laistyti / Palaisčiau / Nelaisčiau veiksmo. **Du variantai, prioritetas circuit > delta.**

**Circuit toast** (kai veiksmas išvalo paskutinį todo zonoje):
- Sage-500 bg + Check ikona + zonos vardas iš `CARE_COPY.circuit`
- Format: „Virtuvė pasirūpinta" / „Virtuvė — viskas vietose"
- Auto-fade 3.5s
- Detekcija per `detectClearedZones()` su event types simuliacija (Pure JS, jokio I/O)

**Delta toast** (kai circuit netriggerina, bet confidence padidėjo):
- Baltas bg
- Format: `+X%` (24px amber-500 extrabold) + frazė (14px gray-700)
- Frazė random pick iš `CARE_COPY.delta` (9 sinonimų)
- Auto-fade 3s
- **Skip jei deltaPct = 0** (pvz. fert-only veiksmas — tyla geriau nei „+0%")

### 2b. CareWateringSheet navigacija (priežiūros santrauka kontekste)

Atidarius CareWateringSheet iš priežiūros santraukos (Patikrink ar ne sausi /
Pamaitink augalėlį), vartotojas gauna **galerijos stiliaus navigaciją** per
to skyrelio sąrašą:

- **Strėlės šonuose** (chevron-left / chevron-right, semi-transparent black, w-10 h-10)
  - Rodoma tik jei pateikta onPrev/onNext callback (priežiūros santraukos kontekste)
  - Ne edge'uose disable'inama (paslepiama)
- **Indikatorius "2 / 5"** po drag handle (mažas pill, juodas/30 backdrop)
- **Auto-advance po veiksmo** (Variant B, vartotojo pasirinkimas):
  - Po Laistyti / Patręšta+Palaisčiau / Patręšta+Nelaisčiau / Patikrinau →
    automatiškai pereina į kitą sąrašo augalą
  - Paskutinis sąraše → sheet uždaromas
  - X mygtukas / drag-down / backdrop tap → visada uždaro be advance
- **Long-press care mode'e nepateikia** onPrev/onNext/onAfterAction →
  strėlių nėra, elgsena identiška kaip prieš

**Architektūra:** Dashboard.jsx vietoj `careInfoPlant` objekto laiko
`careInfoPlantId` + `careInfoList` (string[] of IDs). Plant duomenys
live-resolve'inami iš mainPlants per useMemo — visada švieži po Firestore
propagation. List snapshot'as paimamas atidarymo metu (per IDs), todėl
order stabilus, bet kiekvieno plant duomenys atnaujinami live.

CareOverview Section komponentas: naujas `withList` prop. Watering ir Fert
sekcijos perduoda plants kaip 2-ą onTap argumentą; dormancy sekcijos —
ne (nesukuria nav konteksto).

CareWateringSheet props: 5 nauji opcionalūs — `onPrev`, `onNext`,
`onAfterAction`, `navIndex`, `navTotal`. Default `afterAction = onClose`.

### 3. Session summary modal (sesijos pabaigos recap)

Išėjus iš care mode (X paspaudimas) jei buvo bent vienas veiksmas:
- Centruotas modal su backdrop
- Top: `43% +7` (bazinis sage 22px + delta amber 28px)
- Headline: pagyrimas iš `CARE_COPY.bulk.headline` (15+10+8 sinonimų pagal mood)
- Subtitle: „Pasirūpinai 8 augalais" (instrumental case per `plPlantsInstr()`)
- Sekcijos: „Palaistei 8" / „Pamaitinai 3" su bucket breakdown'u (verb-style iš `CARE_COPY.bulk.section`)
- Auto-close 10s + tap-anywhere

---

## Session tracking

`sessionRef` (Dashboard.jsx, `useRef`):
```js
{
  watering:    { perfect, early, late, waylate },
  fertilizing: { perfect, early, late, waylate },
  plants: Set<plantId>,
  deltaPct: number,  // suminis confidence prieaugis
}
```

- **Reset** kai careMode → true (`useEffect`)
- **Akumuliuoja** per `showCareToast()` (kiekvieno veiksmo metu)
- **Snapshot'inama** į `setShowSummary()` careMode → false metu, jei `sessionTotal > 0`

---

## Kaip pridėti naują frazę

1. Atidaryti [src/constants/careCopy.js](../src/constants/careCopy.js)
2. Rasti reikiamą sąrašą:
   - `single.watering.{perfect|early|late|waylate}` — vienas augalas (CareWateringSheet)
   - `single.fertilizing.{...}` — vienas augalas, fert
   - `single.inspection` — patikrinau, jokio veiksmo
   - `bulk.headline.{mostlyPerfect|mixed|manyLate}` — sesijos summary antraštės
   - `bulk.section.{watering|fertilizing}` — verb antraštės summary'je
   - `bulk.label.{perfect|early|late|waylate}` — bucket label'ės (laiku/anksti/...)
   - `delta` — top toast frazės
   - `circuit` — zona pasirūpinta (TODO 5/5 žingsnis)
   - `confidence.{none|low|high}` — pažinimo pill label'ės
3. Pridėti string'ą į array — random pick automatiškai jį pasiima

---

## Kaip pakeisti spalvą / dydį

| Vieta | Failas | Klasė / vertė |
|-------|--------|---------------|
| Confidence pill (Sprout badge) | Dashboard.jsx (`careConfidence` block) | `bg-sage-500` / `bg-amber-400` / `bg-gray-300` |
| Toast delta `+X%` | CareToast.jsx | `text-amber-500 text-[24px] font-extrabold` |
| Toast frazė | CareToast.jsx | `text-gray-700 text-[14px]` |
| Summary bazinis `%` | CareSessionSummary.jsx | `text-sage-600 text-[22px] font-bold` |
| Summary delta `+X` | CareSessionSummary.jsx | `text-amber-500 text-[28px] font-extrabold` |
| Summary headline | CareSessionSummary.jsx | `text-gray-900 text-[28px] font-extrabold` |
| Bucket ikonos | `BUCKET_META` (CareToast / CareSessionSummary) | `Sprout/Droplets/Clock/Heart` |

---

## Status (2026-05)

| Žingsnis | Statusas |
|----------|----------|
| 1. Foundation (forecast expose + bucket helpers + copy file) | ✅ Done |
| 2. Confidence badge ant Priežiūros mygtuko | ✅ Done |
| 3. Bulk action toast | ✅ Done |
| 4. Confidence delta (per-action + sesijos suma) | ✅ Done |
| 4b. Toast supaprastinimas + amber summary delta | ✅ Done |
| 5. Zone circuit toast (zonoje nelieka todo) | ✅ Done |
| 6. Single-plant rewards (CareWateringSheet) | ✅ Done |
| 7. Snapshot/diff session delta (apima visus paths) | ✅ Done |
| 8. Demo mygtukų pašalinimas | ✅ Done |
| 9. Refaktoras: CareWateringSheet + utils iš Dashboard.jsx | ✅ Done |
| 10. CareWateringSheet navigacijos strėlės + auto-advance (Variant B) | ✅ Done |
| 11. CareCircle pill split (abu overdue) | ✅ Done |

**Statusas po žingsnio 11:** dizaino struktūra baigta. Sekanti fazė — testavimas.

**Ateičiai (po visko):** single-plant CareWateringSheet mikro-toast (kai vienas augalas, ne bulk).

---

## CareCircle ant PlantCard (care mode pasirinkimo burbuliukas)

Care mode'e ant kiekvieno PlantCard yra mažas pasirinkimo indikatorius
(bottom-right kampe). 4 vizualinės būsenos:

| Būsena | Forma | Spalva |
|--------|-------|--------|
| Nei vienas overdue | Apskritimas (w-7 h-7) | white/80 border + black/30 fill |
| Tik laistymas overdue | Apskritimas | sky-400 border + sky-400/20 fill (unchecked) arba sky-400 fill (checked) |
| Tik tręšimas overdue | Apskritimas | amber-400 border + amber-400/20 fill (unchecked) arba amber-400 fill (checked) |
| **ABU overdue** | **Kapsulė (w-12 h-7, stadiono forma)** | **Pusinis-pusinis split**: sky kairė, amber dešinė. Border irgi split'intas (kiekvienas pusinis savo border'ą atitinkančia spalva, vidury border'o nėra — pusiniai liečiasi seamlessly) |

Anksčiau abu-overdue atvejis rodydavo TIK kolbą (fert priority) — vandens
ikona dingdavo. Dabar abu matomi vienu metu.

**Implementacija:** `CareCircle` komponente PlantCard.jsx. Kapsulė pasirinkta
vietoj didesnio apskritimo, kad ikonos turėtų pakankamai erdvės (icon size
11 vs single-overdue 12-14).

---

## Žinomi rizikingi dalykai

- **Confidence vs realybė:** algoritmo „pažinimas" remiasi VIDUTINIAIS tarpais. Jei vartotojas labai netaisyklingai laisto, confidence vis tiek augs (tarpai bus „valid"). Filtras yra `outlierCap = theoreticalInterval × 3` — virš to atsijoja, bet nevaloma confidence delta dėl outlierių. Jei reikės — galima tikslinti.
- **Per-action toast deltaPct=0:** dabar skip — geriau nei „+0%". Bet jei tai ilgai ilgai trunkantis status (visi augalai jau 100% confidence), vartotojas niekada nematys toast'o. Galima ateičiai pridėti „silent" praise frazes.
- **Palaisčiau path detekcija per komentaro hint'ą:** CareWateringSheet → Dashboard `onAddEvent` callback'as detektuoja Palaisčiau veiksmą per `extra.komentaras === 'Laistyta po tręšimo'`. Hacky bet veikia. Jei vėliau norėsim švariau, refaktoruoti CareWateringSheet API kad praneštų eventTypes tiesiogiai.
