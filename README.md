# Gėlių DB

Asmeninė augalų kolekcijos valdymo PWA lietuvių kalba.

## Funkcijos

- **Augalų kolekcija** — augalų valdymas su nuotraukomis, statusais (sveikas / dėmesio / karantinas), zonų priskyrimo sistema
- **Priežiūros seansas** — grupinio laistymo ir tręšimo žurnalas pagal zonas su karantino atskyrimu; long press ant tile rodo padidintą nuotrauką
- **Prognozės** — laistymo, tręšimo ir žiemojimo perspėjimai su sezoniškumu; ikonos ant augalo kortelių
- **AI paieška** — augalų paieška per Claude API su automatiškai sugeneruota priežiūros informacija (2 fazės); nuotraukų identifikavimas iš kameros
- **Istorija** — augalo gyvavimo įvykių laiko juosta (laistymas, tręšimas, persodinimas, nuotraukos)
- **AI pokalbis** — pokalbis su Claude apie konkretų augalą, visą kolekciją arba žinyno įrašą
- **Žinynas** — asmeninių augalininkystės įrašų enciklopedija su žvaigždutėmis
- **Biblioteka** — visi augalai (auginami, norimi, mirę) su filtravimo ir rikiavimo galimybėmis
- **PWA** — veikia offline, instaliuojamas į telefono ekraną, Workbox caching

## Tech stack

| Sritis | Technologija |
|--------|-------------|
| UI | React 18 + Vite |
| Stilius | Tailwind CSS v3 |
| Animacijos | Framer Motion |
| Ikonos | Lucide React |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| Duomenys | Firebase Firestore + Firebase Storage |
| Nuotraukos | iNaturalist API + Wikipedia API |
| PWA | vite-plugin-pwa + Workbox |

## Projekto struktūra

```
src/
├── components/
│   ├── PlantCard.jsx          # Augalo kortelė su laistymo/tręšimo ikonomis
│   ├── PlantDetail.jsx        # Augalo detalės modalas (eksportuoja ProfileContent)
│   ├── PlantTimeline.jsx      # Įvykių laiko juosta
│   ├── AddEventSheet.jsx      # Įvykio pridėjimo forma (FAB + sheet)
│   ├── PlantChat.jsx          # AI pokalbis su augalu
│   ├── CollectionChat.jsx     # AI pokalbis su kolekcija
│   ├── ZinynasChat.jsx        # AI pokalbis su žinyno įrašu
│   ├── ForecastCards.jsx      # Laistymo/tręšimo/žiemojimo kortelės
│   ├── StatusPicker.jsx       # Augalo statuso mygtukas ir meniu
│   ├── WateringSession.jsx    # Priežiūros seansas (laistymas + tręšimas)
│   ├── ZoneManager.jsx        # Zonų valdymas ir parinkimas
│   ├── SearchModal.jsx        # AI augalų paieška
│   ├── DeathModal.jsx         # Augalo mirties fiksavimas
│   ├── DeleteModal.jsx        # Ištrynimo patvirtinimas
│   ├── PinGate.jsx            # PIN apsauga
│   └── Navigation.jsx         # Apatinė navigacija
├── pages/
│   ├── Dashboard.jsx          # Pagrindinis vaizdas (auginami augalai)
│   ├── Biblioteka.jsx         # Visa kolekcija (auginama + nori + istorija)
│   └── Zinynas.jsx            # Asmeninė enciklopedija
├── hooks/
│   ├── usePlants.js           # Pagrindinis state valdymas (Firestore sync)
│   ├── useChatStream.js       # Bendras Anthropic streaming hook visiems chat'ams
│   ├── usePullToRefresh.js    # Pull-to-refresh gestas
│   └── useLongPress.js        # Ilgo paspaudimo gestas
├── utils/
│   ├── imageService.js        # Nuotraukų paieška, dydžio keitimas, įkėlimas į Storage
│   ├── plantTransform.js      # AI rezultato → augalo modelio konvertavimas + makeId/today
│   ├── plantNames.js          # Lietuviškų pavadinimų fetchinimas (iNat + GBIF)
│   ├── wateringForecast.js    # Laistymo prognozė
│   ├── fertilizingForecast.js # Tręšimo prognozė
│   ├── dormancyForecast.js    # Žiemojimo prognozė
│   ├── plantMood.js           # Augalo nuotaikos logika (kortelės spalva)
│   ├── collectionChatContext.js # System prompt kolekcijos chat'ui
│   ├── plantChatContext.js    # System prompt augalo chat'ui
│   ├── firebase.js            # Firebase init + auth + Firestore + Storage
│   └── pinLock.js             # PIN logika (localStorage)
└── constants/
    └── plant.js               # KATEGORIJA, STATUS konstantos ir STATUS_OPTIONS
```

## Aplinkos kintamieji

Sukurkite `.env.local` failą su:

```
VITE_ANTHROPIC_API_KEY=...
VITE_FB_EMAIL=...
VITE_FB_PASSWORD=...
```

## Paleidimas

```bash
npm install
npm run dev
```

## Deploy

Projektas automatiškai deployinamas į Vercel iš `master` branch.  
Produkcija: **augalai.crazyeuropean.eu**
