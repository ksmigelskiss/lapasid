# Desktop / Tablet UX (LapasID)

**Status:** spec'as, dar ne implementuotas. Branch: `desktop-ux`. Į master mergina'sim tik kai bus pilnai veikianti versija.

**Kontekstas:** mobile-only PWA gauna tablet/desktop layout'ą su split panel'e. Aktyvuojamas ≥1024px. Mažiau — lieka mobile (kaip dabar). Wall panel mode (1920×1080) palaikomas (extra space → kairė).

---

## Pamatinis dizainas

Designer'is sukūrė pilną prototipą Claude Design'e (bundle išsaugotas `/tmp/geliai-design/`). Šitas spec'as filtruoja jo idėjas pagal vartotojo sprendimus — paima ką integruosim, palieka ką atskiriam į vėlesnius etapus.

**Layout struktūra:**
```
┌─────────────────────────────────────────────────────────────┐
│ Header                                                       │
│ ┌─────────────────┬──────────────┬─────────────────────────┐│
│ │ [Logo] LapasID  │ Augalai 12 │ │ Kolekcija K Stepono ▾   ││
│ │ [AccuracySprite]│ Biblioteka │ │ [optional bell] [avatar]││
│ │  + label        │ Žinynas    │ │                         ││
│ └─────────────────┴──────────────┴─────────────────────────┘│
├─────────────────────────────────┬───────────────────────────┤
│                                 │                           │
│  LEFT PANEL (flexible width)    │  RIGHT PANEL (430px fixed)│
│                                 │                           │
│  - CareOverview                 │  Default state:           │
│  - Zone sections                │   - Subtle leaf bg decor  │
│  - Plant grid                   │   - Brand logo + tag      │
│  - Care mode action bar         │   - „widget zone"         │
│    (kai aktyvus)                │     (vėliau Weather,      │
│                                 │     Chart, Tip)           │
│                                 │                           │
│                                 │  Aktyvus modal:           │
│                                 │   - PlantDetail           │
│                                 │   - CareWateringSheet     │
│                                 │   - SearchModal           │
│                                 │   - ProfileSheet          │
│                                 │   - PostFertilizePrompt   │
└─────────────────────────────────┴───────────────────────────┘

Breakpoint: lg (1024px). Mobile <1024px lieka be pakeitimo.
```

---

## Vartotojo sprendimai (iš diskusijos)

| | Sprendimas |
|---|------------|
| **Brand** | „LapasID" (jau pakeista į master, separate commit) |
| **AccuracySprite** | ✅ Imam designer'io SVG | mūsų confidence reikšmę naudojam |
| **Mobile redesign** | ⏳ Atskiras etapas po desktop. Naudosim esamus modulius |
| **Right panel widget'ai** (Weather/Tip/Chart) | ⏳ Atskirai vėliau. Dabar — vieta widget'ams + brand logo |
| **Personalized greeting** | ✅ „Labas, {vardas}" / „Labas, svečias" |
| **Header struktūra** | ✅ Tab'ai viršuje + collection switcher + priežiūros mygtukas (su sprite). Notifications bell — vėliau |
| **Fontai** | ✅ Designer'io CSS faktiškai naudoja SYSTEM fonts (`-apple-system, BlinkMacSystemFont, 'SF Pro'...`). HTML'e minėjo Inter/Fraunces bet CSS'e jų nėra. **Mūsų esami fontai jau OK** — nereikia switch'inti |
| **Plant card UX** | ✅ Struktūra mūsų, UX patobulinimai. Water meter care mode'e — pridedam, ir naikinam ikoną iš CareCircle (no info dub) |
| **Mock auth + branch** | ✅ desktop-ux branch su `VITE_USE_MOCK_USER=true` Vercel preview'ams |

---

## Design tokens (iš designer'io CSS)

Visos spalvos jau atitinka mūsų Tailwind tokenus arba lengvai map'inasi:

```
Sage palette:    50, 100, 200, 300, 400, 500, 700   ✅ jau turim
Amber:           --amber #f59e0b                     ✅ amber-500
Sky:             --sky #38bdf8                       ✅ sky-400
Surface:         --surface #f2f2f7                   ✅ bg-app
Surface warm:    --surface-warm #faf8f3              ⚠️ naujas — pridėsim
```

`--surface-warm #faf8f3` — naudojamas right panel default state'ui (šiltesnis fonas, nei surface). Pridėsim į Tailwind config kaip `bg-app-warm` ar pan.

---

## Failų schema (designer → mūsų)

| Designer | Mūsų komponentas / failas | Pastabos |
|----------|---------------------------|----------|
| `Header` | NEW: `src/components/desktop/DesktopHeader.jsx` | Tik desktop. Mobile header nekeičiamas |
| `LeftPanel` | esamas Dashboard.jsx wrapper | Nauja layout container'e |
| `AccuracySprite` | NEW: `src/components/AccuracySprite.jsx` | Designer'io exact SVG. Naudoja `careConfidence` (jau turim) |
| `AccuracyButton` | Header'yje | Sprite + label + careMode toggle |
| `RightPanelEmpty` | NEW: `src/components/desktop/RightPanel.jsx` | Default state + container modal'ams |
| `LeafDecor` | NEW: inline RightPanel'yje | SVG decor for default state |
| `WeatherWidget` | ⏳ vėliau | Skip Phase 1 |
| `TipWidget` | ⏳ vėliau | Skip Phase 1 |
| `WeeklyChart` | ⏳ vėliau | Skip Phase 1 |
| `PlantDetailModal` | esamas PlantDetail.jsx | Per portal'ą į RightPanel container |
| `CareWateringSheet` | esamas CareWateringSheet.jsx | Per portal'ą į RightPanel container |
| `PlantCard` (designer'io) | esamas PlantCard.jsx | Tik UX patobulinimai (water meter care mode'e) |
| `Mobile screens` (5 designer'io) | ⏳ atskira fazė | Skip Phase 1 |

---

## Modal portal context

**Dabar:** visi modal'ai naudoja `createPortal(node, document.body)` su `fixed inset-0 z-[110]`.

**Naujas:**
- React context: `<DetailContainerContext>` su DOM ref į RightPanel container
- Modal'ai patikrina kontekstą:
  - Jei `containerRef.current` exists → render'inti į jį (be `fixed inset-0`)
  - Jei null → render kaip dabar (mobile fullscreen overlay)
- RightPanel container exists tik kai `window.innerWidth >= 1024px`

```jsx
// src/components/desktop/DetailContainerContext.jsx
export const DetailContainerContext = React.createContext(null)

// In RightPanel.jsx:
const ref = useRef(null)
return (
  <DetailContainerContext.Provider value={ref}>
    <aside className="..." ref={ref}>
      {/* default content rodomas kai contextas nenaudojamas */}
    </aside>
  </DetailContainerContext.Provider>
)

// In each modal (PlantDetail, CareWateringSheet, etc.):
const containerRef = useContext(DetailContainerContext)
const target = containerRef?.current || document.body
const positioning = containerRef?.current
  ? "absolute inset-0"        // panel mode
  : "fixed inset-0 z-[110]"   // mobile mode
return createPortal(<div className={positioning}>...</div>, target)
```

**Edge case'as:** kai user atidaro modal'ą mobile'e ir resize'ina į desktop — modal'ą atatupęs reikia repositioninti. Sprendimas: modal'ai re-evaluate'ina contextą ant kiekvieno render'io. React handle'ina automatiškai per re-render kai window width keičiasi (jei mes turime resize listener'į).

---

## Mock auth + data (Etapas 0)

**Tikslas:** Vercel preview'ai veikia BE Google OAuth. Tai pagreitina iteraciją 10x.

**Mechanizmas:**
1. Aplinkos kintamasis `VITE_USE_MOCK_USER=true`
2. `useAuth.js` patikrina šį env. Jei true:
   - Grąžina fake user obj: `{ uid: 'mock-user', displayName: 'Rūta', photoURL: null, isAnonymous: false }`
   - Skip Google OAuth flow
3. `usePlants.js` jei mock mode:
   - Vietoj Firestore listener'io grąžina inline mock data iš `src/utils/mockData.js`
   - Mock'inta `~10 augalų, 3 zonos`, kelios timeline events, varieties: `auginama`, `nori`, `istorija`
4. `addTimelineEvent` ir kiti mutators mock mode'e — grąžina void (ne'į DB nieko nerašo, bet UI state in-memory atnaujina per useState)

**Vercel setup:**
- Vercel projekto Settings → Environment Variables
- Pridėti: Key=`VITE_USE_MOCK_USER`, Value=`true`, **Environments=Preview only**, **Branch override=`desktop-ux`**
- Šitaip env'as gauna TIK preview deploy'ai iš `desktop-ux` branch'o
- Master / production deploy'ai env'o neturi → real auth kaip dabar

**Vartotojo žingsniai:**
1. Eik į https://vercel.com/dashboard → projekto `geliai-db`
2. Settings → Environment Variables
3. Add New
4. Key: `VITE_USE_MOCK_USER`
5. Value: `true`
6. Environments: ✅ Preview, ❌ Production, ❌ Development
7. Branch override: `desktop-ux` (jei UI'us palaiko, kitaip — pasirinkti Preview ir kitiems push'ams nepalies, jei kitos branches nenaudoja)
8. Save

---

## Etapų lentelė

| Etapas | Scope | Commit | Pastabos |
|--------|-------|--------|----------|
| **0** | Mock auth + mock data infrastructure | 1 commit | Be UI pakeitimo. Vercel env setup paralel'iai |
| **1** | Layout shell — DesktopHeader + Split container + RightPanel default state | 1-2 commit'ai | Modal'ai dar fullscreen |
| **2** | DetailContainerContext + modal'ų portal repositioning (po vieną: PlantDetail → CareWateringSheet → SearchModal → ProfileSheet) | 4 commit'ai | Vienas modal'as per commit, lengva debug |
| **3** | AccuracySprite integracija (designer'io exact SVG → mūsų confidence reikšmė) | 1 commit | Header'yje su priežiūros mygtuku |
| **4** | Plant card UX patobulinimai (water meter care mode'e + naikinti ikoną iš CareCircle) | 1 commit | Atsargiai su esama struktūra |
| **5** | Personalized greeting CareOverview'e | 1 commit | „Labas, {vardas}" / „Labas, svečias" |
| **6** | Polish — transitions, edge cases, surface-warm token | 1 commit | Wall panel verifikacija |
| **MERGE** | Jei viskas gerai → squash + merge į master | — | Auth atjungimas (env removal) automatinis Vercel'yje |

**Suma:** ~9-10 commit'ų, kiekvienas mažas ir testavamas. Kiekvienas push į `desktop-ux` → Vercel preview URL'as veikia su mock data.

**Atskirai į MASTER (po desktop-ux merge'o):**
- Mobile redesign etapas — sava fazė, savo planas (`tasks/mobile-redesign.md` rašysim vėliau)
- Right panel widget'ai (Weather, Chart, Tip) — kai turėsim weather API + chart'ų sprendimus

---

## AccuracySprite koncepcija

Designer'io implementacija (exact code paimtas iš `/tmp/geliai-design/lapasid/project/components.jsx`):

**4 stadijos pagal % (mūsų `careConfidence` × 100):**
- 0–24%: gray sprout (`#94a3a0`) — „Mokomės"
- 25–49%: amber sprout (`#f59e0b`) — „Tikslumas"
- 50–74%: sage sprout (`#2e7d52`) — „Tikslu"
- 75–100%: dark sage + bloom (`#1f5f3d`) — „Tobula"

Augalas auga vizualiai: stem'as ilgėja (Y nuo 16 → 13 → 10 → 8), pridedamas leaf'as kiekvienoje stadijoje, paskutinėje atsiranda žiedas su white center.

SVG dydis 22px (header'yje), galima skalei 32px+ (jei norėsim parodyti kortelėse).

**Mapping į mūsų logiką:**
- Mūsų aggregateConfidence (iš careBuckets.js) yra 0..1 → × 100 → procentas
- Stadijų ribos (25/50/75) atitinka mūsų low/medium/high confidence label'ius approximately
- Spalvos perėjimas — automatinis pagal aggregateConfidence reikšmę

---

## Atviri klausimai (jei kas atsiras vykdant)

Pridėti čia, jei vykdymo metu iškiltų neaiškumų:

- _(tuščia)_

---

## Status checklist

- [ ] Etapas 0 — mock auth + mock data
- [ ] Etapas 1 — layout shell
- [ ] Etapas 2 — modal portal context (4 modal'ai)
- [ ] Etapas 3 — AccuracySprite
- [ ] Etapas 4 — Plant card UX
- [ ] Etapas 5 — Personalized greeting
- [ ] Etapas 6 — Polish
- [ ] MERGE į master
