# LapasID — desktop architektūra

Techniniai pattern'ai, kurie skiria desktop'ą nuo mobile flow'o. Mobile elgesys nepakeistas; visi pakeitimai izoliuoti per `useIsDesktop()` arba context'ą.

## 1. `useIsDesktop` hook

```js
// src/hooks/useIsDesktop.js
export function useIsDesktop() {
  // matchMedia (min-width: 1024px) — Tailwind lg: breakpoint
}
```

Naudojamas:
- `App.jsx` — sprendimas wrap'inti `<DesktopLayout>` ar palikti seną mobile column
- `Biblioteka.jsx` — slepiant search input desktop'e (perkelta į toolbar)
- Modal komponentuose — nustatyti `useDesktopPanel = isDesktop && !!host?.container`

## 2. `DetailHostContext` — modal portal pattern

```jsx
// src/contexts/DetailHostContext.jsx
const DetailHostContext = createContext(null)

// Provider laikomas App.jsx aplink visą tree'ą
<DetailHostProvider>
  <DesktopLayout>...</DesktopLayout>
  <PlantDetail .../>
  <SearchModal .../>
</DetailHostProvider>
```

**Kaip veikia:**

1. `RightPanel.jsx` registruoja DOM target div per `host.setContainer(node)` (callback ref)
2. `host.activeCount` skaičius — kiek modal'ų atvertų vienu metu
3. `host.isActive` derived bool — ar bent vienas atvertas
4. Kiekvienas modal'as su `useEffect` kviečia `host.open()` mount'inant ir `host.close()` cleanup'e
5. Modal renderinasi per `createPortal(content, host.container)` jei `useDesktopPanel === true`

**RightPanel naudojimas:**

```jsx
{/* Background widgets — VISADA renderinami */}
<div className="z-10">...widgets + brand...</div>

{/* Portal target — modal'ai portal'inasi čia, slide'inasi VIRŠ widgets */}
<div ref={node => host?.setContainer(node)} className="absolute inset-0 z-20"
     style={{ pointerEvents: isActive ? 'auto' : 'none' }} />
```

`pointer-events: 'none'` kai `isActive=false` praleidžia clicks per portal target į widget'us po jais.

## 3. Modal struktūra (visi 4)

PlantDetail / SearchModal / CareWateringSheet / ProfileSheet bendras pattern'as:

```jsx
const isDesktop = useIsDesktop()
const host = useDetailHost()
const useDesktopPanel = isDesktop && !!host?.container

useEffect(() => {
  if (!useDesktopPanel || !host) return
  host.open()
  return () => host.close()
}, [useDesktopPanel])

const tree = (
  <div className={useDesktopPanel
    ? "absolute inset-0 bg-app flex flex-col"      // panel mode
    : "fixed inset-0 z-[N] flex items-end justify-center"}>  // mobile fullscreen
    {!useDesktopPanel && <Backdrop />}
    <motion.div
      {...(useDesktopPanel
        ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }   // slide from right
        : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' },    // slide up + drag
            drag: 'y', dragControls, ... })}
    >
      {!useDesktopPanel && <DragHandle />}
      {/* content */}
    </motion.div>
  </div>
)

if (useDesktopPanel) return createPortal(tree, host.container)
return tree
```

## 4. Replace pattern (vienas modal'as panel'ėje vienu metu)

`App.jsx` — kai atidaromas top-level modal'as, kiti uždaromi:

```js
const closeAllDesktopModals = useCallback(() => {
  setDetailPlant(null)
  setShowSearch(false)
  setShowDesktopProfile(false)
  dashboardRef.current?.closeCareInfo?.()
}, [])
```

Visi 4 trigger'iai (search button, avatar, plant card, bell popup chip) kviečia šitą prieš atidarant savo modal'ą.

## 5. Toggle pattern (same trigger 2x → uždaro)

Bet kuris top-level trigger'is, paspaudus 2x, uždaro savo modal'ą:

```js
// Search button
if (showSearch) { setShowSearch(false); return }
closeAllDesktopModals()
setShowSearch(true)

// Plant card
if (isDesktop && detailPlant?.plant?.id === plant.id) {
  setDetailPlant(null); return
}

// CareWatering (Dashboard imperative API)
openCareInfo: (plant, list) => {
  setCareInfoPlantId(curr => curr === plant.id ? null : plant.id)
  // ...
}
```

## 6. Sub-modal pattern (ZonePicker iš PlantDetail)

ZonePicker yra **sub-modal** — atveriamas iš PlantDetail vidaus. Slide'inasi virš PlantDetail toj pačioj panel'ėj.

- ZonePicker irgi gauna `useDesktopPanel` + `host.open/close` (didina activeCount, kad RightPanel widget'ai liktų paslėpti)
- PlantDetail ESC handler'is patikrina sub-modal state'us — neuždaro PlantDetail jei ZonePicker (ar kitas sub-modal) atvertas
- ZonePicker mobile'e turi drag handle; desktop'e — „< Atgal" mygtukas viršuj kairėj (semantinis skirtumas: grįžti į parent, ne uždaryti view'ą)
- PlantDetail useEffect: kai `visible=false` arba `plant.id` pasikeičia, reset'inami visi sub-modal state'ai (ZonePicker, photo sheet, status menu, chat, editing, status transition, adding type)

## 7. DesktopHeader struktūra

```
┌──────────────────────────────────────────────────────────────────┐
│ [Logo]      [Augalai 8 | Biblioteka 3 | Žinynas]   [🔍 Ieškoti] │
│                                                       [🔔(N)]    │
│                                                       [Avatar]   │
└──────────────────────────────────────────────────────────────────┘
```

- Logo flex-start kairėj
- Tabs `absolute left-1/2 -translate-x-1/2` (viewport-centered, nepasikeičia kai brand cluster keičia plotį)
- Profile cluster `ml-auto` dešinėj
- Bell — toggle popup (CareSummaryList) su notification count badge
- Avatar — toggle ProfileSheet

`AccuracyButton` perkeltas į `CareOverview` greeting eilutę (ne toolbar'e). Matomas tik Augalai tab'e (CareOverview tik ten render'inasi).

## 8. Animacijos

- **Modal slide-in** desktop'e: `x: '100%' → 0` su spring damping 32 stiffness 320
- **Modal exit** mobile: `y: '100%'` (slide down)
- **Tab underline** (PlantDetail TabBar, Biblioteka filter): `motion.div layoutId="..."` automatic transition
- **Plant card hover** desktop'e: `lg:hover:-translate-y-0.5 lg:hover:shadow-ios-lg` su `transition-all duration-200`
- **Chat popover** desktop'e: scale 0.85 → 1 + opacity, transformOrigin bottom-right

## 9. ESC keyboard handling

Visi modal'ai turi savo ESC handler'į (window keydown listener). PlantDetail papildomai patikrina sub-modal state'us — jei sub-modal atvertas (ZonePicker, photo, status menu, chat, editing, pendingStatus, addingType), neuždaro parent — sub-modal'o handler'is uždaro pats. Cascade: ESC uždaro top, sekantis ESC — parent.

## 10. Auth + mock mode

`useAuth.js` short-circuit: jei `import.meta.env.VITE_USE_MOCK_USER === 'true'`, bypass'ina Firebase auth ir paduoda `MOCK_USER` (Rūta + 11 plants). Vercel preview environment'e set'inta tik desktop-ux branch'ui — kad būtų galima testuot UI be realios autentikacijos.

`usePlants.js` taip pat bypass'ina Firestore writes mock mode'e — visi pakeitimai lieka local state'e.
