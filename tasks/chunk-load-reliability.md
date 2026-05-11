# Chunk-load reliability — pašalinti force reload'ą

## Kontekstas

`src/App.jsx` `lazyWithRetry` aptikus ChunkLoadError (PWA SW neturi naujausio chunk'o ar trumpalaikis network glitch) iškart kviečia `window.location.reload()`. Tai duoda blogai UX:
- Vartotojas mato "trumpalaikis krovimas → flash → grįžta į Dashboard"
- Esami fix'as ([App.jsx:21-37](src/App.jsx:21)) atstato tab'ą per sessionStorage prieš reload'ą — nuima blogiausią simptomą, bet reload'as vis tiek vyksta

## Tikslas — be force reload'o

ChunkLoadError atvejais norėtume:
1. Pakartotinai bandyti chunk'ą fetch'inti (su kelių sekundžių backoff'u), kol pavyks
2. Atrodo tik prieš PWA SW update'inimą — galima trigger'inti `workbox` `skipWaiting()` ir naują SW activation prieš retry'inant chunk fetch'ą
3. Suspense fallback rodyti light spinner'į, kad vartotojas matytų loading state'ą (vietoj null'o)

## Sprendimo principai

1. **Workbox lifecycle** — PWA precache turi būti atnaujintas TIESIOG kai užkraunamas naujas HTML su naujais chunk hash'ais. Esama Vite PWA setup'as (`vite-plugin-pwa`) turi `skipWaiting` ir `clientsClaim` opcijos
2. **Versioned bundle filename strategy** — Vite jau prideda hash'us (`index-abc123.js`), todėl seną chunk'ą fetch'inti turėtų niekada nepavykti su URL mismatch'u, ne tinklo error'iu. Reikia atskirti šituos atvejus
3. **Exponential backoff** retry — `factory().catch(() => sleep(500).then(factory).catch(() => sleep(2000).then(factory)))` su 2-3 bandymais prieš pasidulodavus

## Užduotys

- [ ] Patikrinti `vite.config.js` PWA configūraciją — ar `skipWaiting` įjungtas
- [ ] Implementuoti exponential backoff retry `lazyWithRetry`'ūje (be reload'o)
- [ ] Suspense fallback'ams pridėti light spinner'į (vietoj null'o), kad vartotojas matytų loading state'ą
- [ ] Pridėti Error Boundary aplink lazy components — jei visi retry'iai fail'ina, parodyti toast'ą "Nepavyko užkrauti, bandykite atnaujinti puslapį" + manualus reload mygtukas
- [ ] Test'inti su simulated network throttling ir SW out-of-date scenarijais

## Pasekmės

Po fix'o vartotojas niekada nematys force reload'o ar grąžinimo į Dashboard. Vietoj to — trumpas spinner'is, po to natūralus tab content'o atsiradimas. Worst case (jokio network) — error toast'as su retry mygtuku, bet jokio reload'o.
