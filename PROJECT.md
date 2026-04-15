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
| **Wikipedia API** | Nuotraukų fallback, puslapio egzistavimo tikrinimas | Nemokamai, be rakto |
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
        └── {timestamp}.jpg   ← vartotojo nufotografuotos nuotraukos
```

Security rules: read/write tik autentifikuotam vartotojui su atitinkamu UID.

## Duomenų sinchronizacija

- Paleidus app: nuskaitoma iš Firestore (laimi prieš localStorage)
- Kiekvienas pakeitimas: išsaugoma į localStorage (iš karto) + Firestore (fone)
- Pull-to-refresh: tempiant puslapį žemyn Dashboard ir Biblioteka ekranuose
- Grįžus iš fono: automatiškai sinchronizuojama su Firestore

## Pagrindiniai failai

```
src/
├── App.jsx                          — Root komponentas, routing, modalų state
├── hooks/
│   ├── usePlants.js                 — Visi augalų duomenys + Firestore sync
│   ├── usePullToRefresh.js          — Pull-to-refresh gestas (touch events)
│   └── useLongPress.js              — Ilgo paspaudimo gestas
├── components/
│   ├── PlantDetail.jsx              — Augalo detalės lapas (+ ProfileContent export)
│   ├── PlantCard.jsx                — Augalo kortelė tinklelyje (React.memo)
│   ├── PlantTimeline.jsx            — Augalo istorija su FAB ir event redaktoriumi
│   ├── PlantChat.jsx                — Individualaus augalo AI asistentas
│   ├── SearchModal.jsx              — AI paieška (dvifazė: preview + details)
│   ├── CollectionChat.jsx           — Kolekcijos AI asistentas (Dashboard + Biblioteka)
│   ├── DeathModal.jsx               — Augalo mirties fiksavimas (priežastis + pamoka)
│   ├── DeleteModal.jsx              — Ištrynimo patvirtinimas (auginama: klausia kodėl; biblioteka: patvirtina)
│   ├── PinGate.jsx                  — PIN apsauga (hardcoded 1957, 30d localStorage)
│   └── Navigation.jsx               — Apatinė navigacija
├── pages/
│   ├── Dashboard.jsx                — Auginama kolekcija
│   ├── Biblioteka.jsx               — Visa biblioteka (auginama + nori + istorija)
│   └── Zinynas.jsx                  — Žinių bazė
└── utils/
    ├── firebase.js                  — Firebase init + auth + storage
    ├── uploadImage.js               — base64 → Firebase Storage upload
    ├── plantImage.js                — Nuotraukų fetchinimas (iNat + Wikipedia)
    ├── imageResize.js               — Nuotraukų dydžio keitimas prieš įkėlimą
    ├── plantNames.js                — Lietuviškų pavadinimų fetchinimas
    ├── plantMood.js                 — Augalo nuotaikos logika
    ├── pinLock.js                   — PIN logika
    ├── dormancyForecast.js          — Žiemos miego prognozė
    ├── wateringForecast.js          — Laistymo prognozė
    ├── fertilizingForecast.js       — Tręšimo prognozė
    └── collectionChatContext.js     — AI asistentų system prompt generavimas
```

## AI paieška — dvifazė

1. **Phase 1** (`claude-sonnet-4-6`, max 1024 tokens) — greitas preview: pavadinimas, statistikos, aprašymas, įdomybės. Rodoma iš karto (~1-2s). Tuo pat metu fetchinamos nuotraukos ir lietuviški pavadinimai (iNat/GBIF).
2. **Phase 2** (`claude-sonnet-4-6`, max 2048 tokens) — išsami priežiūros informacija. Triggerinamas tik paspaudus išsaugojimo mygtuką.

## AI chat asistentai

- **PlantChat** — individualaus augalo asistentas (PlantDetail → Augalas tab)
- **CollectionChat** — kolekcijos asistentas Dashboard ir Biblioteka ekranuose (gardener.png burbulas)
- **ZinynasChat** — žinyno asistentas
- Visi naudoja `claude-sonnet-4-6`, streaming atsakymams

## Nuotraukų tvarka

1. Vartotojo nuotrauka (Camera arba PhotoLibrary) → resize → Firebase Storage → URL išsaugomas augale
2. iNaturalist nuotraukos (per `fetchPlantPhotos`)
3. Wikimedia fallback (per `fetchWikimediaImage`)

`uploadImage()` automatiškai atpažįsta `data:` URL (uploada į Storage) vs išorinį URL (praleidžia nepakeistą).

## Augalo kategorijos

| `kategorija` | Reiškia | Kur rodoma |
|---|---|---|
| `auginama` | Aktyviai auginamas | Dashboard + Biblioteka |
| `nori` | Norų sąraše | Biblioteka |
| `istorija` | Mirė arba atiduota | Biblioteka (filtras: Mirę) |

## Biblioteka — filtravimas

- Filtrai slepiami po SlidersHorizontal mygtuku
- Tagų filtrai (AND logika): **Visi** / **Nauji** (nori) / Pirkinys / Mirę / Su užrašais
- Rikiavimas: Pridėta / A–Z / Šviesa / Vanduo / Sunkumas
- Grįžus iš fono — automatiškai resetuojama į "Visi"

## PIN apsauga

Hardcoded PIN: `1957`. Atrakinus — įrenginys prisimenamas 30 dienų (`localStorage`). Kiekvienas įrenginys valdomas atskirai.
