# Gėlių DB — Projekto aprašymas

Asmeninis augalų kolekcijos valdymo PWA. Lietuviška sąsaja.

## Technologijos

| Technologija | Versija / pastabos |
|---|---|
| React 18 + Vite | Frontend framework |
| Tailwind CSS | Stiliai + semantiniai spalvų tokenai |
| Framer Motion | Animacijos, drag gestai |
| Firebase Firestore | Duomenų saugykla + sinchronizacija |
| Firebase Auth | Email/password autentifikacija (fone) |
| Firebase Storage | Nuotraukų saugojimas (Blaze plan) |
| vite-plugin-pwa + Workbox | PWA, offline caching, service worker |
| Lucide React | Ikonų biblioteka |

## Išoriniai servisai

| Servisas | Kam naudojamas | Pastabos |
|---|---|---|
| **Anthropic Claude API** | Augalų paieška, visi chat asistentai | `claude-sonnet-4-6` |
| **Firebase Firestore** | Duomenų sinchronizacija tarp įrenginių | Projektas: `geliu-db` |
| **Firebase Storage** | Vartotojo nuotraukų saugojimas | `plants/{plantId}/{timestamp}.jpg` |
| **Firebase Auth** | Fono prisijungimas prie Firestore | Email: augalai@geliu.lt |
| **iNaturalist API** | Augalų nuotraukos, lietuviški pavadinimai, taxon ID | Nemokamai, be rakto |
| **GBIF API** | Papildomi liaudies pavadinimai (lt, en) | Nemokamai, be rakto |
| **Wikipedia API** | Nuotraukų fallback | Nemokamai, be rakto |
| **Vercel** | Hosting | Free Hobby tier, auto-deploy iš GitHub |
| **Cloudflare** | DNS, domenų valdymas | Domenas: augalai.crazyeuropean.eu |
| **GitHub** | Source code | github.com/ksmigelskiss/geliu-db |

## Environment kintamieji

```
VITE_ANTHROPIC_API_KEY   — Anthropic API raktas
VITE_FB_EMAIL            — Firebase Auth email
VITE_FB_PASSWORD         — Firebase Auth slaptažodis
```

Lokaliai: `.env.local` (gitignore'intas)  
Produkcijoje: Vercel → Settings → Environment Variables

## Firebase struktūra

```
Firestore
└── users/
    └── HdAOoLtEzUXqU2px2h3YmzLygCp1/
        └── { plants: [...], zinynas: [...] }

Storage
└── plants/
    └── {plantId}/
        └── {timestamp}.jpg   ← vartotojo nufotografuotos/pasirinktos nuotraukos
```

Security rules: read/write tik autentifikuotam vartotojui su atitinkamu UID.

## Duomenų sinchronizacija

- Paleidus app: nuskaitoma iš Firestore (laimi prieš localStorage)
- Kiekvienas pakeitimas: išsaugoma į localStorage (iš karto) + Firestore (fone)
- Pull-to-refresh: tempiant puslapį žemyn Dashboard ir Biblioteka ekranuose
- Grįžus iš fono: automatiškai sinchronizuojama su Firestore

## PWA / Offline

Naudojamas `vite-plugin-pwa` su Workbox:

| Resursas | Strategija | Cache |
|---|---|---|
| JS, CSS, HTML, ikonos | Precache (build metu) | Visada atnaujinama per deploy |
| Firebase Storage nuotraukos | CacheFirst | 30 dienų, max 200 įrašų |
| iNaturalist / Wikipedia nuotraukos | CacheFirst | 60 dienų, max 300 įrašų |
| Firestore API | NetworkFirst | 5s timeout, fallback į cache |

## Pagrindiniai failai

```
src/
├── App.jsx                          — Root komponentas, routing, modalų state
├── hooks/
│   ├── usePlants.js                 — Visi augalų duomenys + Firestore sync
│   ├── useChatStream.js             — Bendras Anthropic streaming hook (PlantChat, CollectionChat, ZinynasChat)
│   ├── usePullToRefresh.js          — Pull-to-refresh gestas (touch events)
│   └── useLongPress.js              — Ilgo paspaudimo gestas
├── components/
│   ├── PlantDetail.jsx              — Augalo detalės lapas (+ ProfileContent export)
│   ├── PlantCard.jsx                — Augalo kortelė tinklelyje su laistymo/tręšimo ikonomis
│   ├── PlantTimeline.jsx            — Augalo istorija
│   ├── AddEventSheet.jsx            — FAB + įvykio pridėjimo forma (iškirpta iš PlantTimeline)
│   ├── PlantChat.jsx                — Individualaus augalo AI asistentas
│   ├── SearchModal.jsx              — AI paieška (dvifazė: preview + details; foto identifikavimas)
│   ├── WateringSession.jsx          — Priežiūros seansas (laistymas + tręšimas pagal zonas; long press preview)
│   ├── CollectionChat.jsx           — Kolekcijos AI asistentas (Dashboard + Biblioteka)
│   ├── ZinynasChat.jsx              — Žinyno AI asistentas
│   ├── ForecastCards.jsx            — Laistymo/tręšimo/žiemojimo prognozės kortelės
│   ├── ZoneManager.jsx              — Zonų valdymas (CRUD, reorder) + ZoneManagerSheet
│   ├── StatusPicker.jsx             — Augalo statuso mygtukas + meniu (atsidaro aukštyn)
│   ├── DeathModal.jsx               — Augalo mirties fiksavimas (priežastis + pamoka)
│   ├── DeleteModal.jsx              — Ištrynimo patvirtinimas
│   ├── PinGate.jsx                  — PIN apsauga (hardcoded 1957, 30d localStorage)
│   └── Navigation.jsx               — Apatinė navigacija
├── pages/
│   ├── Dashboard.jsx                — Auginama kolekcija (zonų grupavimas, priežiūros seansas)
│   ├── Biblioteka.jsx               — Visa biblioteka (auginama + nori + istorija)
│   └── Zinynas.jsx                  — Žinių bazė su žvaigždutėmis
└── utils/
    ├── firebase.js                  — Firebase init + auth + Firestore + Storage
    ├── imageService.js              — Nuotraukų paieška (iNat/Wikipedia), resize, Storage upload
    ├── plantTransform.js            — AI rezultato → augalo modelio konvertavimas; makeId(), today()
    ├── plantNames.js                — Lietuviškų pavadinimų fetchinimas (iNat + GBIF)
    ├── plantMood.js                 — Augalo nuotaikos logika (kortelės spalva/ikonos)
    ├── dormancyForecast.js          — Žiemos miego prognozė
    ├── wateringForecast.js          — Laistymo prognozė (intervalDays, isOverdue, nextDate)
    ├── fertilizingForecast.js       — Tręšimo prognozė (intervalDays, isOverdue)
    ├── collectionChatContext.js     — System prompt generavimas kolekcijos chat'ui
    ├── plantChatContext.js          — System prompt generavimas augalo chat'ui
    └── pinLock.js                   — PIN logika (localStorage, 30d expiry)
```

## AI paieška — dvifazė

1. **Phase 1** (`claude-sonnet-4-6`, max 1024 tokens) — greitas preview: pavadinimas, statistikos, aprašymas, įdomybės. Rodoma iš karto (~2–4s). Tuo pat metu fetchinamos nuotraukos ir lietuviški pavadinimai (iNat/GBIF).
2. **Phase 2** (`claude-sonnet-4-6`, max 2048 tokens) — išsami priežiūros informacija (laistymas, tręšimas, substratai, problemos...). Triggerinamas tik paspaudus išsaugojimo mygtuką.

Foto paieška: kamera arba galerija → base64 → Phase 1 su image bloku.

## AI chat asistentai

Visi naudoja bendrą `useChatStream` hook'ą:

| Komponentas | Kontekstas | max_tokens |
|---|---|---|
| `PlantChat` | Konkretus augalas + jo istorija | 300 |
| `CollectionChat` | Visa kolekcija + statistikos | 400 |
| `ZinynasChat` | Žinyno įrašas + kiti įrašai | 400 |

Modelis: `claude-haiku-4-5` chat'ui (greitas, pigus), `claude-sonnet-4-6` paieškai.

> **Pastaba:** Faktiškai SearchModal naudoja `claude-sonnet-4-6` tiesiai, o chat'ai — per `useChatStream` su `claude-sonnet-4-6` (reikia patikrinti ar pakeista į haiku).

## Nuotraukų tvarka

1. Vartotojo nuotrauka (Camera arba PhotoLibrary) → resize (max 1200px, 0.85 kokybė) → Firebase Storage → URL išsaugomas augale
2. iNaturalist nuotraukos (per `fetchPhotos`)
3. Wikimedia fallback (per `fetchBestPhoto`)

`uploadImage()` automatiškai atpažįsta `data:` URL (uploada į Storage) vs išorinį URL (grąžina nepakeistą).

## Augalo kategorijos

| `kategorija` | Reiškia | Kur rodoma |
|---|---|---|
| `auginama` | Aktyviai auginamas | Dashboard + Biblioteka |
| `nori` | Norų sąraše | Biblioteka |
| `istorija` | Mirė arba atiduota | Biblioteka (filtras: Mirę) |

## Augalo statusai

| `status` | Reiškia | Spalva |
|---|---|---|
| `healthy` | Sveikas | Žalia |
| `sick` | Dėmesio | Oranžinė |
| `quarantine` | Karantinas | Raudona |
| `numire` | Numirė | Pilka |

Karantino augalai `WateringSession` rodomi atskiroje grupėje su raudonu fonu.

## Priežiūros seansas (WateringSession)

- Grupuoja augalus pagal zonas (+ karantinas atskirai)
- Tile paspaudimas — pažymi/atžymi
- Tile long press (250ms) — rodo padidintą nuotrauką (PlantPreview overlay)
- **Laistyti** — įrašo `watering` įvykį pažymėtiems augalams
- **Tręšti** — įrašo ir `watering`, ir `fertilizing` įvykius

## Biblioteka — filtravimas

- Tagų filtrai (AND logika): **Visi** / **Nauji** (nori) / Pirkinys / Mirę / Su užrašais
- Rikiavimas: Pridėta / A–Z / Šviesa / Vanduo / Sunkumas

## PIN apsauga

Hardcoded PIN: `1957`. Atrakinus — įrenginys prisimenamas 30 dienų (`localStorage`). Kiekvienas įrenginys valdomas atskirai.
