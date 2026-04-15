# Gėlių DB — Projekto aprašymas

Asmeninis augalų kolekcijos valdymo PWA. Lietuviška sąsaja.

## Technologijos

| Technologija | Versija / pastabos |
|---|---|
| React + Vite | Frontend framework |
| Tailwind CSS | Stiliai |
| Framer Motion | Animacijos |
| Firebase Firestore | Duomenų saugykla + sinchronizacija |
| Firebase Auth | Email/password autentifikacija (fone) |

## Išoriniai servisai

| Servisas | Kam naudojamas | Pastabos |
|---|---|---|
| **Anthropic Claude API** | Augalų paieška, chat asistentai | claude-sonnet-4-6 (paieška), claude-haiku-4-5 (chat) |
| **Firebase Firestore** | Duomenų sinchronizacija tarp įrenginių | Projektas: `geliu-db` |
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
    └── HdAOoLtEzUXqU2px2h3YmzLygCp1/   ← vartotojo UID
        └── { plants: [...], zinynas: [...] }
```

Security rule: `allow read, write: if request.auth.uid == userId`

## Duomenų sinchronizacija

- Paleidus app: nuskaitoma iš Firestore (laimi prieš localStorage)
- Kiekvienas pakeitimas: išsaugoma į localStorage (iš karto) + Firestore (fone)
- Tarp įrenginių: reikia refresh pamatyti kito įrenginio pakeitimus

## Pagrindiniai failai

```
src/
├── App.jsx                          — Root komponentas, routing, state
├── hooks/usePlants.js               — Visi augalų duomenys + Firestore sync
├── components/
│   ├── PlantDetail.jsx              — Augalo detalės lapas (+ ProfileContent export)
│   ├── SearchModal.jsx              — AI paieška (dvifazė: preview + details)
│   ├── CollectionChat.jsx           — Kolekcijos asistentas (Dashboard + Biblioteka)
│   ├── PlantChat.jsx                — Individualaus augalo asistentas
│   ├── PinGate.jsx                  — PIN apsauga (hardcoded 1957, 30d localStorage)
│   └── Navigation.jsx               — Apatinė navigacija
├── pages/
│   ├── Dashboard.jsx                — Auginama kolekcija
│   ├── Biblioteka.jsx               — Visa biblioteka (auginama + nori + istorija)
│   └── Zinynas.jsx                  — Žinių bazė
└── utils/
    ├── firebase.js                  — Firebase init + auth
    ├── plantImage.js                — Nuotraukų fetchinimas (iNat + Wikipedia)
    ├── plantNames.js                — Lietuviškų pavadinimų fetchinimas
    ├── pinLock.js                   — PIN logika
    ├── dormancyForecast.js          — Žiemos miego prognozė
    ├── wateringForecast.js          — Laistymo prognozė
    ├── fertilizingForecast.js       — Tręšimo prognozė
    └── collectionChatContext.js     — Asistento system prompt generavimas
```

## AI paieška — dvifazė

1. **Phase 1** (`claude-sonnet-4-6`, max 1024 tokens) — greitas preview: pavadinimas, statistikos, aprašymas, įdomybės. Rodoma iš karto (~1-2s). Tuo pat metu fetchinamos nuotraukos ir lietuviški pavadinimai (iNat/GBIF).
2. **Phase 2** (`claude-sonnet-4-6`, max 2048 tokens) — išsami priežiūros informacija. Triggerinamas tik paspaudus išsaugojimo mygtuką.

## PIN apsauga

Hardcoded PIN: `1957`. Atrakinus — įrenginys prisimenamas 30 dienų (`localStorage`). Kiekvienas įrenginys valdomas atskirai.
