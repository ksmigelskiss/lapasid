# Design System — geliai.app

Greita referensinė kortelė. Naudok šią kortelę kuriant naujus komponentus — nekurk naujų spalvų ar ikonų be reikalo.

---

## Spalvų sistema (Tailwind tokens)

### Pagrindinės
| Token | Hex | Naudojimas |
|-------|-----|-----------|
| `sage-500` | `#2e7d52` | Pagrindinis žalias — mygtukai, CTA, aktyvus tab |
| `sage-700` | `#1e5c3a` | Tamsesnis — hover / pressed state |
| `sage-50`  | `#edf5f0` | Labai šviesi — pill backgrounds, info sekcijos |
| `surface`  | `#f2f2f7` | Korteles, sekcijų fonas (iOS secondary bg) |
| `surface-2`| `#e8e8ed` | Inputs, chips |

### Priežiūros veiksmai
| Veiksmas | Pagrindinis | Patvirtinimo (darker) | Done |
|----------|------------|----------------------|------|
| Laistymas | `bg-sky-500` | `bg-sky-700` | `bg-green-50 text-green-600` |
| Trąšos   | `bg-amber-500` | `bg-amber-700` | `bg-green-50 text-green-600` |

**Mygtukų tekstai (priežiūros veiksmai):**
| Veiksmas | Veiksmažodis | Patvirtinimas | Done |
|----------|-------------|---------------|------|
| Laistymas | `Laistyti` | `Tikrai? (N)` | `✓ Laistyta` |
| Trąšos | `Tręšti` | `Tikrai? (N)` | `✓ Patręšta` |
| Pavojus/toksiškas | `bg-red-500` | — | — |
| Karantinas | `bg-orange-500` | — | — |

### Semantiniai
| Paskirtis | Klasės |
|-----------|--------|
| Sėkmė / done | `bg-green-50 text-green-600` |
| Perspėjimas | `bg-amber-50 text-amber-700` |
| Klaida | `bg-red-50 text-red-600` |
| Info / šviesa | `bg-amber-50 text-amber-700` |
| Vanduo | `bg-sky-50 text-sky-700` |
| Neutralus | `bg-surface text-gray-600` |

### Forecast / status korteliu spalvos (PRIVALOMA)

Visi forecast / status info card'ai (PlantCareCard widgets, PlantDetail, CareWateringSheet "Dabar" sekcija) turi laikytis šios sistemos. Jokių vienkartinių spalvų išradimų — **vartotojas turi atpažinti būseną iš pirmo žvilgsnio**.

| Būsena | Bg | Border | Tekstas (heading) | Tekstas (meta) | Ikonos spalva | Naudojimas |
|--------|----|----|----|----|----|----|
| **Laistymas — vėluoja / dabar** | `bg-sky-50` | `border-sky-100` | `text-sky-700` | `text-sky-600` | `text-sky-500` | "Laistymas vėluoja N d.", "Patikrink ar ne sausi" |
| **Laistymas — kitas planinis** | `bg-green-50` | `border-green-100` | `text-green-700` | `text-green-600` | `text-green-400` | "Kitas laistymas: 05-23" |
| **Laistymas — palaisyta šiandien (done)** | `bg-green-50` | `border-green-100` | `text-green-700` | — | — | Action mygtuko done būsena |
| **Tręšimas — vėluoja** | `bg-orange-50` | `border-orange-200` | `text-orange-700` | `text-orange-600` | `text-orange-400` | "Pamaitink augalėlį — vėluoja N d." |
| **Tręšimas — kitas planinis** | `bg-amber-50` | `border-amber-100` | `text-amber-700` | `text-amber-600` | `text-amber-400` | "Kitas tręšimas: 05-23" (žr. screenshot brandbook'e) |
| **Snooze / „Patikrinta"** | `bg-green-50` | `border-green-100` | `text-green-700` | `text-green-600` | — | "Patikrinta — ramybė iki ..." |
| **Šiandienos timeline event'as** | `bg-green-50` | `border-green-200` | — | — | node `border-green-300` | Bet kuris event'as kurio `date === today()` |
| **Karantinas (period wrap)** | `bg-red-50` | `border-red-100` | `text-red-700` | — | — | PlantTimeline status period wrap |
| **Liga (period wrap)** | `bg-orange-50` | `border-orange-200` | `text-orange-700` | — | — | PlantTimeline status period wrap |
| **Neutralus / nieko ypatingo** | `bg-gray-50` | — | `text-gray-700` | `text-gray-500` | `text-gray-400` | "Dabar" sekcija kai nieko nelaukia |
| **Nepriskirtas / placeholder** | `bg-sage-50` | `border-sage-100` | `text-sage-600` | — | — | Augalas be nuotraukos hero, tuščias placeholder |

**Mygtukų spalvos (action bar, įsk. `<PostFertilizePrompt>`):**

| Veiksmas | Idle bg | Active bg | Tekstas |
|----------|---------|-----------|---------|
| Laistyti / Palaisčiau | `bg-sky-500` | `active:bg-sky-600` | `text-white font-bold` |
| Tręšti | `bg-amber-500` | `active:bg-amber-600` | `text-white font-bold` |
| Patikrinau (snooze) | `bg-green-500` | `active:bg-green-600` | `text-white font-bold` |
| Nelaisčiau / dismiss | `bg-gray-100` | `active:bg-gray-200` | `text-gray-700 font-bold` |
| Confirmation (countdown) | tos pačios šeimos `-700` | tos pačios `-800` | `text-white font-bold` |

> ⚠️ **Niekur kitur** šios spalvos nenaudojamos pagrindiniam veiksmui (kad būtų nedviprasmiškas signalas). Pvz.: jei kuriame mygtuką "Pridėti augalą", tai NĖRA `bg-sky-500` (nes tai laistymo mygtuko spalva).

> ⚠️ **Šeimų nesumaišyti.** Tręšimas turi DVI šeimas (`amber` planinis, `orange` vėluoja). Tai sąmoninga — vėluoja yra rimtesnis signalas (orange + 200 border vietoj 100), planinis informacinis (švelnesnis amber).

---

## Ikonos (Lucide React)

### Priežiūros veiksmai
| Ikona | Komponentas | Spalva | Naudojimas |
|-------|------------|--------|-----------|
| 💧 | `Droplets` | `text-sky-500` | Laistymas |
| 🌿 | `FlaskConical` | `text-amber-500` | Trąšos / tręšimas |
| ☀️ | `Sun` | `text-amber-500` | Šviesos lygis |
| ❄️ | `Snowflake` | `text-blue-400` | Žiemos ramybė |
| 🌡️ | `Thermometer` | — | Temperatūra |
| 💨 | `Wind` | — | Drėgmė / vėdinimas |

### Navigacija ir UI
| Ikona | Komponentas | Naudojimas |
|-------|------------|-----------|
| ✕ | `X` | Uždaryti sheet'ą / atšaukti |
| ← | `ChevronLeft` / `ArrowLeft` | Atgal |
| › | `ChevronRight` | Link rodyklė, "atidaryti" |
| ↓ | `ChevronDown` | Išskleidimas |
| ↑ | `ChevronUp` | Suskleisti |
| ≡ | `SlidersHorizontal` | Filtrai / rūšiavimas |
| 🔍 | `Search` | Paieška |
| ⚙️ | `Settings` / `Settings2` | Nustatymai |
| ⋯ | `MoreHorizontal` | Daugiau parinkčių (3 taškai) |
| ✎ | `Pencil` | Redaguoti |
| ＋ | `Plus` | Pridėti |
| 🗑 | `Trash2` | Ištrinti |
| ✓ | `Check` / `CheckCircle2` | Pažymėta / patvirtinta |

### Augalų domenui
| Ikona | Komponentas | Naudojimas |
|-------|------------|-----------|
| 🌱 | `Sprout` | Nauja kolekcija, augimas |
| 🍃 | `Leaf` | Augalas / žaluma |
| 🌸 | `Flower2` | Žydėjimas |
| 🌍 | `Globe` | Kilmė / regionas |
| 📍 | `MapPin` | Vieta, kilmė |
| ⭐ | `Star` | Įvertinimas / mėgstamas |
| 💀 | `Skull` | Toksiškas augalas |
| 🛒 | `ShoppingCart` | Pirkti |
| 🔖 | `Bookmark` | Išsaugoti |

### Komunikacija ir dalijimasisi
| Ikona | Komponentas | Naudojimas |
|-------|------------|-----------|
| 📤 | `Share2` | Dalintis |
| 📋 | `Copy` | Kopijuoti |
| 💬 | `MessageCircle` | AI chat |
| ✨ | `Sparkles` | AI / generuoti |
| 📸 | `Camera` | Fotografuoti |
| 🖼️ | `ImageIcon` | Nuotrauka (placeholder) |

### Auth ir vartotojai
| Ikona | Komponentas | Naudojimas |
|-------|------------|-----------|
| 👤 | `UserCircle` | Vartotojas / profilis |
| 👥 | `UserPlus` | Pakviesti / pridėti narį |
| 🔑 | `LogIn` / `LogOut` | Prisijungti / atsijungti |
| 👁 | `Eye` | Peržiūrėti / viewer rolė |

### Statusai
| Ikona | Komponentas | Naudojimas |
|-------|------------|-----------|
| ⚠️ | `AlertTriangle` / `TriangleAlert` | Perspėjimas |
| 🛡️ | `ShieldAlert` | Karantinas / pavojus |
| 🔄 | `RefreshCw` | Atnaujinti |
| ⏳ | `Loader2` | Kraunama (`animate-spin`) |
| 🩺 | `Stethoscope` | Diagnostika / liga |
| 💡 | `Lightbulb` | Patarimas / idėja |
| 👻 | `Ghost` | Tuščia būsena (empty state) |
| 🌙 | `Moon` | Naktis / tamsa |

---

## Mygtukų variantai

```jsx
// Pagrindinis (sage žalias)
className="px-6 py-3 bg-sage-500 text-white rounded-2xl text-sm font-semibold active:bg-sage-700"

// Laistymas
className="flex-1 h-14 flex items-center justify-center gap-2 bg-sky-500 text-white rounded-2xl font-bold active:scale-95"

// Laistymas — patvirtinimo būsena (countdown)
className="... bg-sky-700 text-white ..."  // tamsesnis

// Trąšos
className="... bg-amber-500 text-white ..."

// Trąšos — patvirtinimo būsena
className="... bg-amber-700 text-white ..."

// Done / atlikta
className="... bg-green-50 text-green-600 ..."

// Antrinis (outline)
className="py-3 border border-gray-200 text-gray-600 rounded-2xl text-sm font-medium active:bg-gray-50"

// Naikinimo / pavojaus
className="... bg-red-500 text-white ..."

// Išjungtas
className="... disabled:opacity-40"
```

---

## Patvirtinimo pattern (du tapai + countdown)

Naudojamas kur veiksmas negrįžtamas (laistymas, trąšos). Identiškas Dashboard priežiūros režimui ir PlantCareCard.

```jsx
const [confirmType, setConfirmType] = useState(null) // null | 'watering' | 'fertilizing'
const [countdown,   setCountdown]   = useState(5)
const timerRef = useRef(null)

useEffect(() => {
  if (!confirmType) return
  timerRef.current = setInterval(() => {
    setCountdown(prev => {
      if (prev <= 1) { clearInterval(timerRef.current); setConfirmType(null); return 5 }
      return prev - 1
    })
  }, 1000)
  return () => clearInterval(timerRef.current)
}, [confirmType])

function resetConfirm() {
  clearInterval(timerRef.current); setConfirmType(null); setCountdown(5)
}

// Mygtuko onClick:
if (confirmType === 'watering') commitAction('watering')
else { resetConfirm(); setConfirmType('watering'); setCountdown(5) }

// Mygtuko tekstas:
{confirmType === 'watering' ? `Tikrai? (${countdown})` : 'Palaistyti'}

// Mygtuko spalva:
confirmType === 'watering' ? 'bg-sky-700' : 'bg-sky-500'
```

---

## Kortelių ir sekcijų stiliai

```jsx
// Standartinė kortelė
className="bg-surface rounded-2xl p-4"

// Balta kortelė su šešėliu
className="bg-white rounded-2xl shadow-ios p-4"

// Info pill / badge
className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 rounded-xl px-3 py-1.5 text-xs font-medium"

// Hero sekcija (NFC/Passport)
style={{ height: '40dvh', maxHeight: '320px' }}
className="relative w-full flex-shrink-0"
// Gradient overlay:
className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"
```

> ⚠️ **Hero tekste emoji NERODYTI.** Emoji naudojamas tik kaip fallback kai augalas neturi nuotraukos (didelis, centre hero zonoje). Šalia pavadinimo ant gradiento — tik `lietuviškas` + `lotyniskas`, jokių emoji.

---

## Full-screen sheet pattern (PRIVALOMA)

Visiems augalo kortelės-tipo modal'ams (PlantDetail, CareWateringSheet, panašiems): **full-screen iki viršaus + drag handle + hero**. Reference: [PlantDetail.jsx](src/components/plant-detail/PlantDetail.jsx) ir [CareWateringSheet (Dashboard.jsx)](src/pages/Dashboard.jsx).

### Skelet'as

```jsx
import { useDragControls, useMotionValue, animate } from 'framer-motion'

const dragControls = useDragControls()
const y = useMotionValue(0)
const handleDragEnd = (_, info) => {
  if (info.velocity.y > 400 || info.offset.y > 120) onClose()
  else animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 })
}

return createPortal(
  <div className="fixed inset-0 z-[110] flex items-end justify-center">
    {/* Backdrop */}
    <motion.div
      className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    />
    {/* Sheet — full-height, mobile-width centered */}
    <motion.div
      className="relative w-full max-w-[430px] bg-app flex flex-col"
      style={{ height: '100dvh', y }}
      drag="y" dragControls={dragControls} dragListener={false}
      dragConstraints={{ top: 0 }} dragElastic={{ top: 0, bottom: 0.25 }}
      onDragEnd={handleDragEnd}
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 320 }}
    >
      {/* Drag handle pill viršuje (su safe-area pad) */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-center pb-2 pointer-events-none select-none"
           style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
        <div onPointerDown={e => dragControls.start(e)}
             className="px-8 py-1 cursor-grab active:cursor-grabbing pointer-events-auto"
             style={{ touchAction: 'none' }}>
          <div className="w-10 h-1 bg-black/15 rounded-full" />
        </div>
      </div>

      {/* Hero su nuotrauka */}
      {plant.image ? (
        <div className="relative flex-shrink-0 overflow-hidden"
             style={{ height: 'calc(17rem + env(safe-area-inset-top))' }}>
          <img src={plant.image} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
          {/* X mygtukas viršutiniame dešiniame kampe */}
          <div className="absolute right-4 z-30" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
            <button onClick={onClose}
                    className="w-11 h-11 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white">
              <X size={16} />
            </button>
          </div>
          {/* Pavadinimas ant gradiento */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-xl font-bold text-white leading-tight">{plant.lietuviškas}</h2>
            {plant.lotyniskas && <p className="text-xs text-white/70 italic mt-0.5">{plant.lotyniskas}</p>}
          </div>
        </div>
      ) : (
        // Hero be nuotraukos: sage-50 fonas, X dešinėje, emoji + pavadinimas
        <div className="relative flex-shrink-0 px-5 pb-4 bg-sage-50"
             style={{ paddingTop: 'max(1.75rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center justify-end mb-3">
            <button onClick={onClose}
                    className="w-11 h-11 bg-white/60 rounded-full flex items-center justify-center text-gray-600">
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white/80 rounded-2xl flex items-center justify-center text-3xl shadow-ios flex-shrink-0">
              {plant.emoji ?? '🌿'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 leading-tight">{plant.lietuviškas}</h2>
              {plant.lotyniskas && <p className="text-xs text-gray-500 italic mt-0.5">{plant.lotyniskas}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="overflow-y-auto flex-1 px-5 pt-4 pb-4 space-y-4">
        {/* ... turinys ... */}
      </div>

      {/* Action bar — float apačioje su safe-area pad */}
      <div className="flex-shrink-0 px-4 pt-3 border-t border-gray-100 bg-white"
           style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {/* ... mygtukai ... */}
      </div>
    </motion.div>
  </div>,
  document.body
)
```

### Sheet konvencijos (TURI BŪTI tas pats kiekvieną kartą)

| Elementas | Reikšmė |
|-----------|---------|
| Outer wrapper | `fixed inset-0 z-[110] flex items-end justify-center` (ne `flex-col`) |
| Backdrop | `bg-black/40 backdrop-blur-sm`, `duration: 0.25` opacity |
| Sheet plotis | `w-full max-w-[430px]` |
| Sheet aukštis | `style={{ height: '100dvh' }}` (full screen) |
| Sheet fonas | `bg-app` (ne `bg-white` — kad scrollable content fonas vienodas) |
| Drag handle | `absolute top-0 z-20`, pill `w-10 h-1 bg-black/15`, `paddingTop: max(0.625rem, env(safe-area-inset-top))` |
| Hero su nuotrauka aukštis | `calc(17rem + env(safe-area-inset-top))` |
| Hero gradient | `bg-gradient-to-t from-black/65 via-black/10 to-transparent` |
| X mygtukas (su nuotrauka) | `w-11 h-11 bg-black/30 backdrop-blur-sm rounded-full`, `text-white`, `top: max(1rem, env(safe-area-inset-top))` |
| X mygtukas (be nuotraukos) | `w-11 h-11 bg-white/60 rounded-full`, `text-gray-600` |
| Hero be nuotraukos fonas | `bg-sage-50` (default), `bg-blush-50` (`nori`), `bg-surface-2` (`istorija`) |
| Pavadinimo dydis (ant gradiento) | `text-xl font-bold text-white leading-tight` |
| Lotyniško dydis | `text-xs text-white/70 italic mt-0.5` |
| Action bar | `flex-shrink-0 px-4 pt-3 border-t border-gray-100 bg-white`, `paddingBottom: max(0.75rem, env(safe-area-inset-bottom))` |
| Action mygtuko aukštis | `h-10` |
| z-index | `z-[110]` (virš tab bar `z-40`, virš PlantDetail `z-[70]`) |

### Veiksmų mygtukų spalvos action bar'e

| Veiksmas | Klasės |
|----------|--------|
| Laistyti / Laistyta | `bg-sky-500 active:bg-sky-600` |
| Tręšti / Patręšta | `bg-amber-500 active:bg-amber-600` |
| Patikrinau / „Viskas tvarkoj" (snooze) | `bg-green-500 active:bg-green-600` |

---

## Care veiksmų sinchronizacija (PRIVALOMA)

Visi „augalo priežiūros" mygtukai (Laistyti / Tręšti / Patikrinau) turi vienodai elgtis bet kurioje vietoje (Dashboard care mode bulk, CareWateringSheet single-plant, ateities NFC pass'ai). Kad nereiktų kiekvieną kartą perdaryti — **nedubliuokim UI/logikos**, naudokim shared blokus.

> 📚 **Pilnas reward sistemos dokumentas:** [docs/care-rewards.md](docs/care-rewards.md) — confidence skaičiavimas, delta logika, toast/summary failų schema, CareWateringSheet navigacija, CareCircle pill, kaip pridėti naują frazę.

### Kanoninės taisyklės

1. **Mygtukų label'iai** = veiksmažodžiai (`Laistyti`, `Tręšti`, `Patikrinau — viskas tvarkoj`). Done būsena = būdvardis (`✓ Laistyta`, `✓ Patręšta`).
2. **Spalvos** kaip lentelėje viršuje. Niekur kitur šios trys spalvos nenaudojamos pagrindinį veiksmą — kad būtų atpažįstama iš pirmo žvilgsnio.
3. **Po tręšimo** visada paklausti: „Patręšta · ar palaistei? **[Palaisčiau] [Nelaisčiau]**". Tręšimas namų augalams beveik visada eina kartu su laistymu — neefektyvu, jei vartotojas turi atskirai pažymėti.
4. **Patikrinau** mygtukas = `inspection` event'as timeline'e. Trigerio sąlyga: `wc.isOverdue && wc.lastType === 'watering'` (žiūr. [wateringForecast.js](src/utils/wateringForecast.js)).

### Shared building block'ai

| Komponentas | Failas | Naudoja |
|-------------|--------|---------|
| `<PostFertilizePrompt>` | [src/components/PostFertilizePrompt.jsx](src/components/PostFertilizePrompt.jsx) | Dashboard care bar, CareWateringSheet, PlantCareCard (NFC pass) |
| (TODO) `<CareActionButtons>` | — | dar neištraukta — žr. „ateities planas" |

### Ateities planas (kai užtenka motyvacijos)

Šiuo metu countdown patvirtinimo logika (`confirmType`, `countdown`, `useEffect` countdown'ui) yra dubliuota dviejose vietose:
- [Dashboard.jsx](src/pages/Dashboard.jsx) `confirmType` state (care mode bulk)
- [PlantCareCard.jsx](src/components/PlantCareCard.jsx) `confirmType` state (NFC pass)

CareWateringSheet šiuo metu countdown'o NETURI (instant action). Dabar tai OK, nes paliečiama tik per priežiūros santrauką ir vienam augalui.

Jei ateityje atsiras 3-čias place'as su countdown'u — laikas išskaidyti į `useCareConfirmation()` hook'ą:

```jsx
const { confirmType, countdown, ask, commit, reset } = useCareConfirmation()
// ask('watering') — pradeda countdown
// commit() — vykdo veiksmą
// reset() — atšaukia
```

Iki tol — laikomasi kanoninių taisyklių (label, spalva, post-fert prompt) per shared komponentus.

> ❌ **NEBEDARYTI:** bottom sheet'ų su `max-h-[84dvh]` (jie palieka backdrop tarpą viršuje). Visada full screen `100dvh`.
> ❌ **NEBEDARYTI:** drag handle ant nuotraukos (`absolute top-3 inset-x-0`). Pill turi būti virš hero, ne ant jo.
> ❌ **NEBEDARYTI:** Close mygtuko action bar'e (kairiausiai prieš pagrindinius). X uždarymas tik hero kampe.

---

## Tipografija

```jsx
// Puslapis title
className="text-2xl font-bold text-white leading-tight"   // ant hero
className="text-xl font-bold text-gray-900"               // ant balto fono

// Sekcijų antraštės
className="text-sm font-bold text-gray-800"

// Aprašymas / kūnas
className="text-sm text-gray-600 leading-relaxed"

// Meta / antrinė info
className="text-xs text-gray-500"

// Footer / diskretus
className="text-xs text-gray-400"

// Italic (lot. pavadinimas)
className="text-sm text-gray-400 italic"
```

---

## Dydžiai ir tarpai

| Elemento tipas | Padding / dydis |
|---------------|----------------|
| Pagrindinis mygtukas (NFC) | `h-14 px-4` |
| Standartinis mygtukas | `h-10 px-4` |
| Mažas mygtukas / pill | `px-3 py-1.5` |
| Kortelės vidinis tarpas | `p-4` |
| Puslapio horizontalus tarpas | `px-4` |
| Maksimalus plotis (mobile) | `max-w-[430px] mx-auto` |
| Ikonos mygtuke | `size={16}` (mažas), `size={18}` (normalus) |
| Ikonos pilule / badge | `size={13}` |

---

## Skeleton / loading pattern

```jsx
// Teksto eilutė
className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: '85%' }}

// Mygtukas
className="h-14 bg-sky-100 rounded-2xl animate-pulse"

// Hero zona
className="bg-sage-100 animate-pulse"
```
