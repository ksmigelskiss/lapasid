# Priežiūros santrauka — apjungimas + snooze refaktoras

## Kontekstas

Šiuo metu "Priežiūros santraukos" UI yra dubliuotas dviejose vietose:
- `src/components/CareOverview.jsx` (savarankiškas komponentas, neaišku iš kur naudojamas)
- `src/pages/Dashboard.jsx:798–856` (inline'inta tiesiogiai)

Abu rašo į tą patį `localStorage waterSnooze` raktą, bet su atskirais React state'ais → pakeitimai vienoje vietoje neatsispindi kitoje be reload.

Snooze yra mažas ✓ mygtukas šalia kiekvieno augalo sąraše — vartotojas skundžiasi netyčia paspaudimu.

## Sprendimo principai

1. **Single source of truth = timeline.** Snooze gyvena kaip `inspection` event'as augalo timeline'e, ne kaip atskiras laukas. Privalumai:
   - Automatinė sinchronizacija tarp įrenginių (timeline jau Firestore)
   - Automatinis snooze expiry (be papildomos logikos)
   - Istorija "kada paskutinį kartą patikrinau"
   - "Laistyti" paspaudimas natūraliai nustelbia snooze (naujesnis event timeline'e)

2. **Snooze trukmė = 1/3 intervalo** (vartotojo pasirinkimas).
   - Pvz. intervalas 10d → snooze ~3d
   - Sultingas 18d → snooze 6d
   - Papartis 5d → snooze ~2d

3. **Snooze tik laistymui**, tręšimui — ne (vartotojo pasirinkimas).

4. **Mažas ✓ mygtukas šalia augalo — pašalinti.** Snooze inicijuojamas tik atidarius augalo kortelę, per naują mygtuką.

## Užduotys

### 1. Forecast palaikymas snooze'ui
- [ ] `src/utils/wateringForecast.js` — pridėti `inspection` event'o palaikymą:
  - Skaityti paskutinį `inspection` event'ą iš timeline
  - Jei `lastInspection.date > lastWatering.date` → snooze aktyvus
  - `snoozedUntil = lastInspection.date + Math.ceil(intervalDays / 3)` dienų
  - Grąžinamas naujas laukas: `isSnoozed: boolean`, `snoozedUntil: ISO date`
- [ ] `shouldShowWateringAlert` — grąžina `false` jei `isSnoozed`

### 2. Bendras komponentas
- [ ] `src/pages/Dashboard.jsx:798–856` inline render pakeisti į `<CareOverview ... />`
- [ ] Dashboard.jsx ištrinti dublikatus: `snoozedWatering` state, `snoozeWatering` callback, localStorage logika (Dashboard.jsx:382–470)
- [ ] `CareOverview.jsx` — ištrinti `localStorage waterSnooze` logiką (Snooze nebebus inicijuojamas iš sąrašo). Snooze būsena gaunama per `getWateringForecast(plant).isSnoozed`.
- [ ] Patikrinti, kur dar `CareOverview` naudojamas (gal Bibliotekoje?). Užtikrinti, kad props'ai sutampa.

### 3. Pašalinti mažą ✓ mygtuką iš sąrašo
- [ ] `CareOverview.jsx:7–35` — `Section` komponente nuimti `onSnooze` mygtuką (Check ikona). Augalas tiesiog rodomas, paspaudus per visą row → atidaroma augalo kortelė (`onTap`).
- [ ] To paties dėl Dashboard.jsx (jei lieka tarpinių vietų po refaktoro).

### 4. PlantCareCard — naujas mygtukas
- [ ] `src/components/PlantCareCard.jsx` — pridėti trečią mygtuką po "Laistyti" / "Tręšti":
  - Label: "Patikrinau — viskas tvarkoj" (alternatyvos: "Tvarkoj", "Nieko netrūksta")
  - Ikona: `Check` arba `Eye` (Lucide)
  - Spalva: neutrali (gray-100 bg, gray-700 text) — kad neišsiskirtų kaip pagrindinis veiksmas
  - Rodomas tik jei `isOverdue` arba liko < 2d (kitaip nereikalingas)
  - On click: dvifazis confirmation kaip `Laistyti` mygtukas (žiūrėti `PlantCareCard.jsx:308`)
  - Veiksmas: `addTimelineEvent(plantId, { type: 'inspection', date: todayISO })`
  - Po paspaudimo: card persijungia į žalią būseną ("Patikrinta — kitas patikrinimas po Xd")

### 5. PlantTimeline event rendering
- [ ] `src/components/PlantTimeline.jsx` — pridėti `type === 'inspection'` event renderingą:
  - Ikona: `Check` arba `Eye`
  - Tekstas: "Patikrinta — nieko netrūksta"
  - Spalva: panaši į kitus (gray)

### 6. Dashboard care mode patikrinimas
- [ ] Patikrinti, ar Dashboard'o "care mode" (jei toks atskiras kelias) turi tuos pačius mygtukus. Jei taip — pridėti trečią mygtuką ir ten.

### 7. Migracija ir cleanup
- [ ] `localStorage waterSnooze` — pamiršti (snooze trumpas, ne kritinis duomuo). Kodu nieko nebeskaitysim.
- [ ] Po veikiančios versijos — pašalinti `localStorage.removeItem('waterSnooze')` jei reikia tylaus cleanup'o (vienkartinis `useEffect` `App`'e).

## Verifikacija

1. **Lokalus dev** (`npm run dev`, localhost:3001):
   - Atidaryti augalą, kuris vėluoja → matomas "Patikrinau — viskas tvarkoj" mygtukas
   - Paspaudus → card žalia, augalas dingsta iš Dashboard "Priežiūros santrauka"
   - Timeline'e atsiranda `inspection` event'as
   - Po `intervalDays / 3` dienų (testuoti su trumpu intervalu) — augalas vėl atsiranda sąraše
   - "Laistyti" paspaudimas iš snooze būsenos — veikia normaliai

2. **Multi-device sync** (Firestore):
   - Snooze viename įrenginyje → kitame įrenginyje per kelias sekundes augalas dingsta
   - Tas pats prie laistymo

3. **Dublikato pašalinimas:**
   - Nei Dashboard'e, nei kažkur kitur nebėra mažo ✓ mygtuko šalia augalo sąraše
   - `git grep "waterSnooze"` neranda nieko, išskyrus migracijos cleanup (jei pridėtas)
   - Tik vienas `<CareOverview />` komponentas naudojamas abiejose vietose

4. **Build + types** — `npm run build` praeina be klaidų

## Rizikos

- **Žemos:** snooze veikia per timeline → jei kažkas pridėtų `inspection` event rankiniu būdu (per chat ar editor), jis tylia užšaldys laistymo perspėjimą. Mažai tikėtinas scenarijus.
- **Vidutinė:** `useChatStream` ar `usePlants` gali turėti `addTimelineEvent` ribotą event types whitelist. Reikia patikrinti.

## Failai, kurie bus modifikuoti

| Failas | Pakeitimai |
|--------|-----------|
| `src/utils/wateringForecast.js` | + `isSnoozed`, `snoozedUntil` |
| `src/components/CareOverview.jsx` | – snooze localStorage; – ✓ mygtukas; būsena per forecast |
| `src/pages/Dashboard.jsx` | – dublikuota santraukos sekcija → `<CareOverview />` |
| `src/components/PlantCareCard.jsx` | + "Patikrinau" mygtukas; + snooze UI būsena |
| `src/components/PlantTimeline.jsx` | + `inspection` event rendering |

## Review section

### Padaryta

1. **`src/utils/wateringForecast.js`** — pridėtas `inspection` event'o palaikymas. `getWateringForecast` dabar grąžina `isSnoozed`, `snoozedUntil`, `lastInspectionDate`. `isOverdue` automatiškai išjungiamas snooze metu. `shouldShowWateringAlert` per `isOverdue` automatiškai filtruoja snooze augalus.

2. **`src/components/CareOverview.jsx`** — pašalinta:
   - `localStorage waterSnooze` skaitymas/rašymas
   - `useState`, `useCallback` tik snooze (paliktas tik `useState` open/close)
   - `Section` komponento `onSnooze` prop ir mažas ✓ mygtukas šalia augalo
   - "Patikrinau visus" bulk mygtukas
   Filter dabar naudoja `shouldShowWateringAlert(p)` (autofiltruoja snooze).

3. **`src/pages/Dashboard.jsx`** — apjungta:
   - Pašalintas inline 90-eilučių santraukos widget'as (bvy 797-889)
   - Pašalintas `snoozedWatering`, `setSnoozedWatering`, `snoozeWatering`, `alertsOpen` state
   - Care mode ir normalus rendering'as dabar abu naudoja `<CareOverview />`
   - `CareWateringSheet` priima naują `onInspect` callback
   - `CareWateringSheet` rodo žalią "Patikrinta · ramybė iki YYYY-MM-DD" status'ą kai snooze aktyvus
   - Pridėtas full-width "Patikrinau — viskas tvarkoj" mygtukas po pagrindiniais (rodomas tik kai watering vėluoja)

4. **`src/components/PlantTimeline.jsx`** — pridėtas `inspection` event meta (žalia spalva, Check ikona, "Patikrinta" label).

### Snooze logika santraukoje

```
snoozeDays = max(1, ceil(intervalDays / 3))
snoozedUntil = lastInspection.date + snoozeDays
isSnoozed = lastInspection.date > lastWatering.date && now < snoozedUntil
```

UTC arithmetika (`setUTCDate` + `T12:00:00Z`) — kad nebūtų timezone slip.

### Verifikuota

- **Build:** `npm run build` ✅ praeina (0 klaidų)
- **Dev server:** `npm run dev` ✅ kraunasi be runtime klaidų
- **Snooze logika** (per `preview_eval` su mock plant):
  - Watering vėluoja → `isOverdue: true`, `isSnoozed: false`
  - Po inspection (vakar) → `isOverdue: false`, `isSnoozed: true`, `snoozedUntil: +ceil(interval/3)d`
  - Snooze pasibaigė → `isSnoozed: false`, `isOverdue: true`
  - Inspection PRIEŠ paskutinį laistymą → ignoruojamas (snooze neaktyvus)
  - Tuščias timeline → nei overdue, nei snooze
  - Inspection be jokio laistymo → alert: false (lastType === 'repotting')

### Ką dar reikia vartotojui patikrinti gyvame app'e

- Atidaryti augalą iš santraukos → matomas naujas "Patikrinau — viskas tvarkoj" mygtukas (tik vėluojantiems)
- Paspaudus → Sheet užsidaro, augalas dingsta iš santraukos
- Timeline'e atsiranda žalias "Patikrinta" event'as
- Per kelias sekundes kitame įrenginyje (Firestore sync) — tas pats efektas
- Po `ceil(interval/3)` dienų (testuoti su trumpu intervalu) — augalas vėl atsiranda
- Care mode ir normalus rendering'as rodo tą pačią santrauką (be dublikato)
- Mažo ✓ mygtuko šalia augalo nebėra

### Migracija

`localStorage waterSnooze` paliktas niekur neskaitomas — naujas kodas jo ignoruoja. Senas snooze pamirštamas (vartotojui teks vienąsyk vėl paspausti "Patikrinau" tiems augalams). Cleanup nereikalingas — localStorage entry neša ~50 baitų ir niekam netrukdo.

### Pamokos

- **UTC date arithmetika.** Pradžioje naudojau `new Date('YYYY-MM-DDT00:00:00')` + `setDate`. Lietuvos timezone (UTC+3) → `toISOString().slice(0,10)` grąžino dieną prieš. Pataisyta į `T12:00:00Z` + `setUTCDate`. Pamoka — kai dirbi su date-only strings ir naudoji `toISOString`, visada UTC.
- **Single source of truth per timeline.** Snooze gyvena kaip event'as — Firestore sync, expiry, istorija — viskas free. Atskiro `plant.snoozedUntil` lauko nereikia.
