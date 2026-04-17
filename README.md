# Gėlių DB

Asmeninė augalų kolekcijos valdymo PWA lietuvių kalba.

## Funkcijos

- **Augalų kolekcija** — augalų valdymas su nuotraukomis, statusais (sveikas / dėmesio / karantinas), zonų priskyrimo sistema
- **Biblioteka** — visi augalai (auginami, norimi, mirę) su filtravimo ir rikiavimo galimybėmis
- **AI paieška** — augalų paieška per Claude API su automatiškai sugeneruota priežiūros informacija
- **Laistymo seansas** — grupinio laistymo žurnalas pagal zonas su karantino atskyrimu
- **Prognozės** — laistymo, tręšimo ir žiemojimo perspėjimai su sezoniškumu
- **Istorija** — augalo gyvavimo įvykių laiko juosta (laistymas, tręšimas, persodinimas, nuotraukos)
- **Užrašai** — asmeninės pastabos su žvaigždutėmis ir žinyno eksportu
- **AI pokalbis** — pokalbis su Claude apie konkretų augalą arba visą kolekciją
- **Žinynas** — asmeninių augalininkystės įrašų enciklopedija

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
| PWA | Vite + Web App Manifest |

## Projekto struktūra

```
src/
├── components/
│   ├── PlantCard.jsx          # Augalo kortelė (grid widget)
│   ├── PlantDetail.jsx        # Augalo detalės modalas
│   ├── PlantTimeline.jsx      # Įvykių laiko juosta
│   ├── PlantChat.jsx          # AI pokalbis su augalu
│   ├── CollectionChat.jsx     # AI pokalbis su kolekcija
│   ├── ForecastCards.jsx      # Laistymo/tręšimo/žiemojimo kortelės
│   ├── StatusPicker.jsx       # Augalo statuso mygtukas ir meniu
│   ├── WateringSession.jsx    # Laistymo seansas
│   ├── ZoneManager.jsx        # Zonų valdymas ir parinkimas
│   ├── SearchModal.jsx        # AI augalų paieška
│   └── ...
├── pages/
│   ├── Dashboard.jsx          # Pagrindinis vaizdas (auginami augalai)
│   ├── Biblioteka.jsx         # Visos kolekcijos vaizdas
│   └── Zinynas.jsx            # Asmeninė enciklopedija
├── hooks/
│   └── usePlants.js           # Pagrindinis state valdymas (Firestore sync)
├── utils/
│   ├── imageService.js        # Nuotraukų paieška, dydžio keitimas, įkėlimas
│   ├── plantTransform.js      # AI rezultato → augalo modelio konvertavimas
│   ├── wateringForecast.js    # Laistymo prognozė
│   ├── fertilizingForecast.js # Tręšimo prognozė
│   ├── dormancyForecast.js    # Žiemojimo prognozė
│   └── firebase.js            # Firebase konfigūracija
└── constants/
    └── plant.js               # KATEGORIJA, STATUS konstantos ir STATUS_OPTIONS
```

## Aplinkos kintamieji

Sukurkite `.env.local` failą su:

```
VITE_ANTHROPIC_API_KEY=...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Paleidimas

```bash
npm install
npm run dev
```

## Deploy

Projektas automatiškai deployinamas į Vercel iš `master` branch.
