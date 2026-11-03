# LapasID — Right panel widget'ai

Modulinė widget'ų sistema dešinei panelei. Visi pure components — props-driven, reusable, savarankiški.

## Failai

```
src/components/widgets/
  ├── WeatherWidget.jsx       — orų kortelė (Open-Meteo data)
  ├── CareHeatmapWidget.jsx   — 8 sav priežiūros heatmap (calendar grid)
  ├── ShopWidget.jsx          — demo plant supplier offers
  └── CareChartWidget.jsx     — 1 sav bar chart (deprecated, lieka reusable)

src/hooks/
  ├── useWeather.js           — Open-Meteo fetch + sessionStorage cache
  └── useCollapsible.js       — collapse state + localStorage persistence

src/utils/
  └── careWeekStats.js        — aggregateCareGrid(plants, weeks)
```

## Bendras pattern'as (visų widget'ų)

```jsx
function MyWidget({ data }) {
  const [collapsed, toggle] = useCollapsible('my-widget-key', false)

  return (
    <div className="bg-white/55 backdrop-blur-xl rounded-2xl shadow-... border border-white/40">
      <button onClick={toggle} className="w-full flex justify-between px-4 py-3">
        <span>Title + compact preview when collapsed</span>
        <ChevronDown className={collapsed ? '' : 'rotate-180'} />
      </button>
      {!collapsed && <div className="px-4 pb-3.5">{/* full content */}</div>}
    </div>
  )
}
```

Glass effect:
- `bg-white/55 backdrop-blur-xl` — frosted glass
- `border-white/40` — subtle outline
- `shadow-[0_4px_24px_rgba(20,40,30,0.06)]` — soft drop shadow

Brand background "prasimato" pro permatomus widget'us — desktop look.

## WeatherWidget

**Props:** `weather` — objektas iš `useWeather()` hook'o

**Hook:** `useWeather()` fetchina Open-Meteo (Vilnius koordinatės hardcoded), 30min sessionStorage cache. Be API key (free).

**Output forma:**
```js
{
  tempC, conditions, isSunny,
  humidityPct, uvIndex, windMs,
  plantTip,    // euristika: temp + drėgmė + saulėtumas → tip text
  location, fetchedAt
}
```

**Render:**
- Header: `Vilnius · +18° · Saulėta` (collapsed compact preview); icon (Sun / Cloud / CloudRain / CloudSnow) pagal conditions
- Expanded: big temp + conditions + sub-stats (drėgmė/UV/vėjas) + plant tip žaliame pill'e

## CareHeatmapWidget

**Props:** `data` — `{ grid, monthMarkers }` iš `aggregateCareGrid(plants, weeks=8)`

**`aggregateCareGrid(plants, weeks)`** sumetė `plant.timeline` events į 7×N grid'ą:
- `grid` — `Day[][]` (savaitės kaip stulpeliai, 7 dienos kaip eilutės, Pir→Sek)
- `monthMarkers` — `[{ weekIndex, label }]` mėnesio žymėjimui virš grid'o
- `Day` = `{ dateISO, date, watering, fertilizing, isToday, isFuture }`

**Spalvų logika (quartile gradient pagal dataset max'ą):**

```js
function bucket(value, max) {
  if (value === 0) return 0
  if (max <= 1) return 4 // edge case
  const pct = value / max
  if (pct <= 0.25) return 1
  if (pct <= 0.5)  return 2
  if (pct <= 0.75) return 3
  return 4
}

// Tręšimas wins (rečiau, vizualiai svarbiau):
if (day.fertilizing > 0) return amberTones[bucket(day.fertilizing, maxFert)]
if (day.watering > 0)    return skyTones[bucket(day.watering, maxWater)]
return 'bg-gray-100' // empty
```

`maxWater` ir `maxFert` skaičiuojami atskirai iš dataset'o — kad vienas neperkratytų kito gradient'o.

**Tonai:**
- Sky: 100 → 300 → 500 → 700
- Amber: 100 → 300 → 500 → 700
- Empty: gray-100
- Today: `ring-[1.5px] ring-sage-700`
- Future: visai nerenderinamos (placeholder div'as išlaiko dydį)

**Visual papildomai:**
- Vertikalūs mėnesio divider'iai tarp savaičių stulpelių, kur prasideda naujas mėnuo
- Day labels kairėj (visi 7, 2-letter abbr: Pi An Tr Ke Pe Še Se)
- Mėnesio žymekliai virš grid'o (LT abbr: Sau Vas Kov Bal Geg Bir Lie Rgp Rgs Spa Lap Grd)
- Total summary apačioj: „Iš viso (8 sav.): 💧 N · 🟧 M"

**Timezone bug fix:** `dateToISODay()` naudoja `getFullYear/getMonth/getDate` (lokali) vietoj `toISOString()` (UTC). Naktį/ankstų rytą Lietuvoj UTC vis dar ankstesnė diena → ankstesnis kodas off-by-one mistike rodė klaidingą datą.

## ShopWidget

**Props:** `onAddToWishlist`, `onBuy`

Demo „pasiūlymas iš tiekėjo" kortelė. Mock duomenys (`LOCAL_OFFERS` array) — vėliau galima integruoti su realia partner API.

**Forma:**
- Header: „Pasiūlymai" + „Kitas >" mygtukas + collapse chevron
- 2-pane grid (kortelės A + B side-by-side)
- Kiekviena kortelė: gradient photo placeholder + emoji + name + latin + supplier + price + 2 CTA mygtukai
- CTA: „Noriu" (rose-50, → `onAddToWishlist(offer)`) + „Pirkti" (sage-500, → `onBuy(offer)` arba default `window.open(offer.shopUrl)`)
- „Kitas >" advansuoja `idx` per 1 (sliding window — kortelės cikliškai keičiasi)

App.jsx `onAddToWishlist` callback'as kuria mock plant objektą (`name`, `latin`, `emoji`) ir kviečia esamą `addToWishlist` + jumpina į Biblioteka tab.

## CareChartWidget (deprecated)

Vienos savaitės bar chart su stacked watering+fertilizing. Pakeistas CareHeatmapWidget'u, bet failas lieka — gali būti naudojamas mobile dashboard'e ar bet kur kitur, kur ribota erdvė ir fokusas tik šios savaitės.

## RightPanel layout

```
┌─────────────────────────────┐
│ Weather card (collapsible)  │  ← top
│                             │
│   🌿 LapasID                │  ← brand center (absolute, background)
│   tavo augalų...            │     widgets layer'inasi virš
│                             │
│                             │
│ Heatmap (collapsible)       │  ← bottom
│ Shop (collapsible)          │
└─────────────────────────────┘
```

**Brand kaip background:** absolute pozicija centre, didelis logo (w-28 h-28), `pointer-events:none`. Widget'ai sluoksnyje virš jo, pro permatomus glass card'us „prasimato".

**Modal layering:** background widget'ai VISADA renderinami DOM'e — modal'as portal'inasi į absolute z-20 target'ą virš jų, slide-in animacija užvažiuoja virš widget'ų (nepakeičia turinio).

## useCollapsible hook

```js
const [collapsed, toggle] = useCollapsible('weather', false)
```

Kiekvienas widget'as tracking'asi savo state'ą per unique key (`weather`, `heatmap`, `shop`). State persistuojasi `localStorage`'e (`lapasid:widget:{key}`).

## Reuse patterns

Visi widget'ai yra **pure components** — joks data fetch viduje (išskyrus Weather, kuris turi savo hook'ą). Tinka naudoti:

- Mobile dashboard `Dashboard.jsx` (Weather/Heatmap virš plant grid'o)
- PlantDetail tab'as „Statistika" (kažko panašaus į Heatmap, bet tik šio plant'o duomenys)
- Bibliotekoje (galimai Shop'as ir ten)

Pavyzdys mobile reuse:
```jsx
// Dashboard.jsx mobile branch'e
{!isDesktop && (
  <div className="px-5 mb-4 space-y-3">
    <WeatherWidget weather={useWeather()} />
    <CareHeatmapWidget data={aggregateCareGrid(plants, 8)} />
  </div>
)}
```
