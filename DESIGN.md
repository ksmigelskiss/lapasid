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
| Laistymas | `Laistyti` | `Patvirtinti (N)` | `✓ Laistyta` |
| Trąšos | `Tręšti` | `Patvirtinti (N)` | `✓ Patręšta` |
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
{confirmType === 'watering' ? `Patvirtinti (${countdown})` : 'Palaistyti'}

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

// Bottom sheet
className="bg-white rounded-t-3xl overflow-hidden"
// Handle bar:
className="w-10 h-1 rounded-full bg-gray-200 mx-auto mt-3 mb-1"

// Hero sekcija (NFC/Passport)
style={{ height: '40dvh', maxHeight: '320px' }}
className="relative w-full flex-shrink-0"
// Gradient overlay:
className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"
```

> ⚠️ **Hero tekste emoji NERODYTI.** Emoji naudojamas tik kaip fallback kai augalas neturi nuotraukos (didelis, centre hero zonoje). Šalia pavadinimo ant gradiento — tik `lietuviškas` + `lotyniskas`, jokių emoji.

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
