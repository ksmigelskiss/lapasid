# LapasID Animus Mascot — System Documentation

> **TL;DR**: Du characters'ai (Plant + Gardener) vienam vizualiniam žodynui.
> Animus iliustracinis stilius: pebble silhouette + single dot eye + sprout
> arba arms variation. Brand-aligned forest + bone + terracotta paletė.
> State'ai (idle / wave / tilt / think / happy / wilt / blink) komunikuoja
> emocijas ir AI būsenas per CSS animation'us. Žiūr.
> `/?playground=mascot` live preview'ą.

---

## 1. Filosofija

**Animus** = „siela / dvasia" — augalo siela, sodo siela. Toks pat
vocabulary, skirtinga poza. Wisp-like, ambient, modern (ne kawaii, ne
korporatyvinis).

Du sluoksniai komunikacijos:
- **Plant** — augalo balsas. „Aš trošku.", „Ačiū už vandenį." — augalas
  reaguoja į savo būseną (mood, watering history, etc.)
- **Gardener** — AI asistento balsas. „Klausau visos kolekcijos.",
  „Mąstau…" — sistema/AI bendrauja su user'iu.

Kiekvienas characteris turi savo per-app integration'us, bet jie dalinasi
animation logika (`mascot.css`) ir komponento API (`<Mascot>`).

---

## 2. File map

```
src/assets/mascot/                      # Build-time inline source
├── plant-idle.svg                      # ⚠ canonical pose, BE #thought group'o
├── plant-blink.svg                     # snapshot — eye = horizontal line
├── plant-happy.svg                     # snapshot — body stretched up
├── plant-wilt.svg                      # snapshot — drooped + terracotta
├── plant-think.svg                     # ✅ canonical — su #thought group'u
├── gardener-idle.svg                   # ⚠ canonical pose, BE #thought
├── gardener-tilt.svg                   # snapshot — body leans -5°
├── gardener-wave.svg                   # snapshot — right arm raised
├── gardener-think.svg                  # ✅ canonical — su #thought group'u
├── mascot.css                          # Drop-in animation library
└── (HANDOFF.md liko /tmp/mascot-extracted/, nesikop'inta į repo)

public/mascot/                          # Duplikatas direct URL access'ui
src/components/brand/Mascot.jsx         # React komponentas
src/dev/MascotPlayground.jsx            # Live preview (/?playground=mascot)
```

**Kodėl `-think.svg` naudojama kaip canonical:**
`plant-idle.svg` ir `gardener-idle.svg` neturi `#thought` group'o. CSS
`.is-think #thought { opacity: 1 }` veikia tik jei element'as DOM'e
egzistuoja. Naudojam `-think.svg` variantus, kurie turi VISUS elementus
(base, body, sprout/arms, eye, thought). CSS valdo `#thought` visibility
per `.is-think` class'ę — vienas SVG dengia visus state'us.

---

## 3. SVG anatomy

Abu SVG'ai turi tą pačią struktūrą — vienas CSS file'as valdo abu:

```xml
<svg viewBox="0 0 240 240" fill="currentColor" data-mascot="plant">
  <g id="base">                         <!-- pot rim / ground line. Static. -->
    ...
  </g>
  <g id="character">                    <!-- everything that breathes -->
    <g id="body">...</g>
    <g id="sprout">...</g>               <!-- plant only -->
    <g id="arms">                        <!-- gardener only -->
      <path id="arm-left"  ... />
      <path id="arm-right" ... />
    </g>
    <g id="eye">
      <circle id="eye-dot" ... />
    </g>
  </g>
  <g id="thought">                       <!-- floats independently; hidden unless .is-think -->
    ...
  </g>
</svg>
```

| ID | Purpose |
|---|---|
| `#base` | Pot rim (plant) / ground line (gardener). Static. |
| `#character` | Wrapper'is animuojamoms kūno dalims. Breath animation gyvena čia. |
| `#body` | Pagrindinis pebble silhouette. |
| `#sprout` | Plant only. Stem + leaf + counter-leaf — brand-mark callback. |
| `#arms` | Gardener only. Contains `#arm-left` + `#arm-right`. |
| `#arm-right` | Rotation pivot ant **(178, 162)** wave keyframe'ui. |
| `#eye-dot` | Single bone-colour dot. Blink'ina per `.is-blink`. |
| `#thought` | Bubble + 3 pulse dots. Toggle'inama per `.is-think`. |

**Color theming:** body naudoja `fill="currentColor"`. Parent'o `color:` CSS
keičia spalvą. Eye'us `fill="#f1ebdd"` (bone) — visada šviesus kontrastas
prieš ink. Wilt state automatiškai pakeičia color į terracotta.

---

## 4. State classes

Pridėk class'ę ant **SVG root** element'o. Vienu metu tik viena state class.

### Plant
| Class | Effect |
|---|---|
| _(none)_ | Idle. Breath + random blink + sprout sway. |
| `.is-blink` | One-shot eye blink. ~180ms. |
| `.is-happy` | Body bounces taller, sprout perks up. _„Ačiū už vandenį!"_ |
| `.is-wilt` | Body droops + terracotta tint, sprout droops. _„Praėjo 7 dienos…"_ |
| `.is-think` | Thought bubble appears, 3 dots pulse. _„…"_ |

### Gardener
| Class | Effect |
|---|---|
| _(none)_ | Idle. Breath + random blink. |
| `.is-blink` | One-shot eye blink. |
| `.is-tilt` | Whole character leans -5°. _„Klausau…"_ |
| `.is-wave` | Right arm raises. _„Sveiki!"_ |
| `.is-think` | Thought bubble appears. |

### Interaction
`.hoverable` class — pridėk hover sway interakciją (rotation + scale).

---

## 5. React component API

```jsx
import Mascot from '@/components/brand/Mascot'

<Mascot
  type="gardener"      // 'plant' | 'gardener'
  state="wave"         // 'idle' | 'blink' | 'happy' | 'wilt' | 'think' | 'tilt' | 'wave'
  size={120}           // pikseliais; default 64
  blink={true}         // random blink kas 3-7s; default true
  hoverable={false}    // hover sway interakcija; default false
  className=""         // extra wrapper class'ė (pvz. text-bone, opacity-50)
/>
```

**Implementation detail:** SVG inline'inamas per Vite `?raw` import +
`dangerouslySetInnerHTML`. Tai būtina, kad CSS galėtų target'inti `#eye-dot`,
`#thought`, `.is-state` class'es ant SVG root'o. `<img src="...">` izolioja
SVG nuo DOM'o, todėl state classes neveiktų.

**Random-blink helper:** `useEffect` setina timer'į blink'ams kas 3-7s.
Skip'inamas state'uose, kur kūnas jau animuojasi (happy bounces, wilt
droops) — to išvengiam visual noise'o.

---

## 6. Color hierarchy

Mascot color'is paveldimas iš parent'o per CSS `currentColor`. Default'as
nustatytas mascot.css'e:

```css
[data-mascot] { color: #264530; }  /* forest-600 — friendly mid-tone */
```

Parent'o `text-*` class'ė overrida per CSS inheritance:

| Parent class | Mascot color | Kontekstas |
|---|---|---|
| _(none)_ | forest-600 (default) | Chat dialog'ai, inline toast'ai, generic |
| `text-forest-700` | INK #1c3a2a | Floating FAB (halo'ui), hero empty states |
| `text-bone` | bone #f1ebdd | Inverted antspaudas (CareCircuitToast forest fone) |
| `text-terracotta-500` | terracotta | Wilt callout cards |

**Eye lieka VISADA bone** (SVG'e hardcoded `fill="#f1ebdd"`) — kontrastas
išlieka bet kokia body spalva.

---

## 7. Sizing guide

| Context | Size (px) | Notes |
|---|---|---|
| **Hero** (welcome screens, empty states) | 120-140 | Dominuojantis vizualinis akcentas |
| **FAB / floating button** | 80-96 | Dashboard'e 82 (subtilesnis), Biblioteka'oj 96 |
| **Modal accent** (DuplicateBuy, CareSession) | 64-88 | Decision moment'ams, summary cards |
| **Toast / callout** | 36-48 | Inline su tekstu, kompaktiškas |
| **Chat header** | 56 | Pakankamai prominent'as |
| **Chat welcome** | 64 | Subtilesnis nei header (anksčiau 70 — sumažinta) |
| **Chat per-message / streaming** | 24-32 | Inline su message bubble'iu |
| **PlantCard badge** (jei kada) | 20-24 | Tiny, grid context |

**Recommended:** ≤32px naudoti su `blink={false}` — animation per smulkmena
small instance'ams.

---

## 8. Halo / contrast handling

**Floating button'ai ant photo card'ų** (Dashboard + Biblioteka FAB) gauna
**dark elevation shadow** — be bone halo:

```css
filter: drop-shadow(0 4px 12px rgba(28, 58, 42, 0.35))
```

- Mascot'o body PATS yra `text-forest-700` (#1c3a2a, INK = beveik juodas)
- Ant photo card'ų INK natūraliai pop'ina prieš augalų lapus / podžius
- Dark shadow duoda „floating" feel'ą be magic-glow cliché

**Anksčiau** buvo bone halo glow (`drop-shadow(0 0 12px bone, 0.85)`),
bet jis atrodė kaip projektorius ant šviesesnių fonų — drop'intas.

**Plant mascot** — niekada halo'o nereikia (sėdi ant bone-50 cards'uose,
natural kontrastas).

---

## 9. Integration sites — complete map

### Gardener (asistento balsas)

| Vieta | Komponentas | State | Trigger |
|---|---|---|---|
| Dashboard floating FAB | `Dashboard.jsx` | idle (hoverable) | nuolat |
| Biblioteka floating FAB | `Biblioteka.jsx` | idle (hoverable) | nuolat |
| Dashboard empty state | `Dashboard.jsx` | wave | `plants.length === 0` |
| Biblioteka empty state | `Biblioteka.jsx` | idle | `entries.length === 0` |
| SearchModal empty (no query) | `SearchModal.jsx` | wave | first paint |
| SearchModal no-results | `SearchModal.jsx` | tilt | empathetic moment |
| DuplicateBuyModal | `DuplicateBuyModal.jsx` | tilt | „ar tikrai?" decision |
| CollectionChat header | `CollectionChat.jsx` | idle ↔ think | streaming |
| CollectionChat welcome | `CollectionChat.jsx` | wave | empty messages |
| CollectionChat past msg | `CollectionChat.jsx` | idle | per message |
| CollectionChat streaming | `CollectionChat.jsx` | think | streaming |

### Plant (augalo balsas)

| Vieta | Komponentas | State | Trigger |
|---|---|---|---|
| PlantInfo WateringCard | `ForecastCards.jsx` | wilt | `isOverdue` |
| PlantInfo FertilizingCard | `ForecastCards.jsx` | wilt | `isOverdue` |
| PlantAvatar (chat, PlantInfo mood badge) | `ChatIcons.jsx` | mood-based | `plant.mood` |
| PlantChat streaming | `PlantChat.jsx` | think | streaming |
| CareToast | `CareToast.jsx` | happy | po watering bulk action |
| CareCircuitToast | `CareCircuitToast.jsx` | happy | zone complete |
| CareSessionSummary | `CareSessionSummary.jsx` | happy / wilt | session mood |

### Mood → state mapping (PlantAvatar)
```js
thirsty/sad/sick/quarantine → 'wilt'
happy/sleeping/waking/default → 'idle'
```

### Session mood → state mapping (CareSessionSummary)
```js
perfect/good   → 'happy'
late/waylate   → 'wilt'  (apologetic — pripažinim, kad augalas kentėjo)
```

---

## 10. Architecture decisions (DRs)

### DR-1: FAB stays idle, chat dialog reacts to state
**Decision:** Floating Dashboard/Biblioteka FAB'ai TIK idle state'e. AI
streaming/think state matomas tik CHAT viduje.

**Reasoning:**
- FAB = action button (affordance „atidaryti chat'ą"), ne live indicator
- Kai chat'as atviras → chat'as fullscreen (mobile) arba sidebar (desktop),
  FAB dažniausiai nematomas
- Kai chat'as uždarytas → streaming nevyksta
- Industry convention: Linear, ChatGPT, Claude.ai — visi laiko FAB static
- Animation budget'as: pridėjus think state į FAB → 4 vienu metu vykstantys
  movement'ai (breath + blink + float + think) ant vieno element'o → visual
  chaos'as. „Spirit" feel'as nyks.

**Galimas future enhancement:** vienkartinis pulse halo FAB'e kai
`streaming && chat.closed` baigia generation. Ne nuolatinė animacija, o
trumpas „dėmesio, AI baigė" signalas (iOS app icon badge style).

### DR-2: `-think.svg` variantai kaip canonical
**Decision:** Naudojam `plant-think.svg` ir `gardener-think.svg` kaip
canonical source SVG'us.

**Reasoning:** `-idle.svg` variantai NETURI `#thought` group'o. CSS
`.is-think #thought { opacity: 1 }` neveiktų — DOM element'as turi
egzistuoti. `-think.svg` turi VISUS elementus, CSS valdo visibility.
Vienas SVG dengia visus state'us be DOM swap'inimo.

### DR-3: SVG inline, ne `<img>`
**Decision:** Mascot SVG content'as inline'inamas per
`dangerouslySetInnerHTML`, ne `<img src="...">`.

**Reasoning:** `<img>` izolioja SVG nuo parent DOM'o — neprieinami
`#eye-dot` (blink JS helper'is), `#thought` (CSS toggle), `.is-state`
classes (mascot.css selectors). Inline → DOM access ✓, CSS cascade ✓,
mažas cost (~1KB per SVG).

### DR-4: Visi 4 plant state'ai + visi 4 gardener state'ai naudojami
**Decision:** Kiekvienas state turi minimum 1 use case'ą.

**Reasoning:** Jei state nenaudojamas — ar jis reikalingas asset'e?
Audit'as patvirtino, kad kiekvienas state'as turi semantinę vietą. Jei
kažkada pridėsim daugiau state'ų (e.g. `sleeping`), reikia identifikuoti
konkrečią vietą.

### DR-5: Sensitive context'uose mascot'o nededa
**Decision:** DeathModal, PostFertilizePrompt — be mascot'o.

**Reasoning:**
- **Death** = sensitive moment. Ghost icon + terracotta tone'as jau perduoda
  netekties feel'ą. Mascot pridėjimas būtų performative empathy.
- **PostFertilizePrompt** = paprastas yes/no decision. Mascot vizualinis
  noise'as inline action bar'e.

### DR-6: Default color forest-600, ne 700
**Decision:** `mascot.css` default'as `color: #264530` (forest-600,
friendly mid-tone). Explicit `text-forest-700` rezervuotas hero
context'ams + floating button'ams.

**Reasoning:** Forest INK (#1c3a2a) atrodo beveik juodas. Default Mascot
chat dialog'e atrodė per stark — vizualiai „heavy". Forest-600 (#264530)
friendly, vis dar brand-tone. Floating button'ams ir hero state'ams INK
reikia visibility'ui ant photo bg'ų / dominuojantis presence'ui.

---

## 11. Common patterns / examples

### Floating FAB
```jsx
<button
  className="absolute bottom-3 right-6 text-forest-700 active:scale-90"
  style={{
    filter: 'drop-shadow(0 4px 12px rgba(28, 58, 42, 0.35))',
  }}
>
  <Mascot type="gardener" state="idle" size={82} hoverable />
</button>
```

### State-aware chat header
```jsx
{mascot ? (
  <Mascot
    type={mascot}
    state={streaming ? 'think' : 'idle'}
    size={56}
    blink={true}
  />
) : (icon ?? '🤖')}
```

### Inline toast su mascot kompanionu
```jsx
<div className="bg-bone-50 rounded-2xl px-4 py-3 flex items-center gap-3">
  <Mascot type="plant" state="happy" size={44} blink={false} />
  <div>... toast content ...</div>
</div>
```

### Mood-based avatar (žiūr. PlantAvatar)
```jsx
<Mascot
  type="plant"
  state={moodToMascotState(mood)}  // 'wilt' or 'idle'
  size={size}
  blink={size > 32}
/>
```

---

## 12. When to ADD mascot

✅ **Pridėti, kai:**
- Emocinis moment'as (welcome, success, sad/overdue)
- AI state'o komunikavimas (think / wave / tilt)
- Empty state'as su personality (ne pure data absence)
- Brand presence pirmą kartą atidarius surface'ą

❌ **NEpridėti, kai:**
- Sensitive context (death, error reports)
- Paprastas action button (yes/no, OK/Cancel)
- High-density layout (plant card grid 50× mascot'ų = perf + noise)
- Pure-functional UI (search field icon, info display)
- Context'e jau yra kitas brand asset, kuris perduoda message'ą

**Rule of thumb:** mascot tik ten, kur **POSITIVE/NEGATIVE/QUESTIONING
emotional payoff**. Jei pridedi „kad būtų gražiau" — nepridėk.

---

## 13. Future expansion ideas

- **Plant card grid** — small (20px) wilt mascot kortelėje kai augalas
  overdue (kartu su day count'u). Performance concern: 50 plant cards ×
  inline SVG. Mitigation: render tik kai card'as viewport'e
  (IntersectionObserver) arba pre-rasterize į PNG kai grid'e.
- **AI typing toast'as** — globalus indicator'ius (top-right corner) kai
  streaming'as vyksta, chat'as uždarytas (žiūr. DR-1 future enhancement).
- **Loading splash** — gardener mascot vietoj BrandLoader'io app init time.
- **Watering animation flow** — kai user'is tap'ina „palaisčiau", short
  one-time transition wilt → happy.
- **Onboarding tour** — gardener su pop-up tooltip'ais, vedant per app'ą.
- **Plant chat emotion override** — jei augalas labai laimingas (recent
  watering + good streak), state="happy" idle'e vietoj.

---

## 14. Asset replacement

Jei kada Animus paketą atnaujinsi (nauja iliustracija ar pose'ai):

1. Atnaujink SVG file'us `src/assets/mascot/` (ir kopiją `public/mascot/`)
2. Patikrink `viewBox="0 0 240 240"` ir `data-mascot` atributus
3. Patikrink `id="..."` ant character group'ių (CSS selectors priklauso nuo
   jų)
4. Build → test playground `/?playground=mascot`
5. Verify visi state'ai veikia (blink, sway, happy bounce, wilt droop,
   wave, tilt, think)

Jei keičiasi animation timing'as ar keyframes:
1. Atnaujink `src/assets/mascot/mascot.css`
2. Hot reload veikia — animacijos auto-apply'inasi
3. Po pakeitimo patikrink visus integration sites (žiūr. sec. 9)

---

## 15. References

- **Original brand pack** (lapasid-brand/Animus): `LapasID Animus Mascot
  _standalone_.html` — bundler'is su visais 10 SVG + CSS + HANDOFF.md
- **Live preview**: `/?playground=mascot` (works in mock mode + production)
- **Component**: `src/components/brand/Mascot.jsx`
- **Stylesheet**: `src/assets/mascot/mascot.css`
- **First integration commit**: `7ef0ebe` — Dashboard + Biblioteka gardener
- **Final shape commit**: `73140b6` — color refinement (forest-600 default)

---

**Last updated:** 2026-05-14 · Maintained alongside `src/components/brand/Mascot.jsx`
