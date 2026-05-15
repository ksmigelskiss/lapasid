# Lessons

Patternai/klaidos, kurias darau, ir kaip jų išvengti ateityje.

---

## 1. Simplify default'as — neover-engineerinti

**Data:** 2026-05-15
**Trigger:** User'is pastebėjo, kad pridėjau „soon" tier'ą prie widget badge'ų be prašymo (jis prašė tik kad overdue būtų geriau matomas). Plus auth fix'e pridėjau `authReady` await, `credentialDone` race coordination, server-side OAuth flow — viskas tampa nereikalinga, kai grįžom prie veikiančios geliu-db logikos su `signInWithPopup`.

**Patternas:** User'is prašo SPECIFIC tiny improvement. Aš PRIDEDU papildomus tier'us / branches / „kad būtų gražiau" / „kad ateityje galbūt..." optimizations'us.

**Rule:** prieš parašant **bet kokį** naują tier'ą, animation'ą, „backup" kodą ar conditional branch'ą, paklausti savęs:
- Ar user'is to prašė?
- Ar yra konkretus current pain'as ką tai sprendžia?
- Ar atsakymas tik „kad ateityje galbūt..." / „kad būtų gražiau"?

Jei taip į trečiąjį → **NEDARYTI** tyliai. Drop'inti scope'ą iki to, ko prašyta.

**NIUANSAS** (svarbu, 2026-05-15): jei matau ką nors verto, ko user'is gal nemato — **PASIŪLYTI atvirai**, ne pridėti tyliai prie scope'o. User'is sprend'i taip/ne. Skirtumas:

| ❌ Smuggle scope | ✅ Propose ir discuss |
|------------------|----------------------|
| „Pridėjau ring'ą action-needed kortelėms" (be klausimo) | „Matau, kad ring'as galėtų pagelbėti — bet rizikuoja atrodyti kaip decoration. Bandom?" |
| Tyliai įvest „soon" tier'ą prie badge'o | „Galiu pridėt vidurinį tier'ą artėjantiems poreikiams. Reikia?" |

User'is vertina mano matymą, ko jis nemato. Tas svarbu išlaikyti. Bet jokio scope smuggling'o — visada paskelbiu intent'ą, leidžiu pasakyti „ne, paprasčiau".

**Konkretūs pavyzdžiai šioje sesijoje:**
- ✗ „Soon" tier'as widget badge'uose (≤2d iki sekančio → žalia bg) — user nepraše, kūrė vizualinę painiavą
- ✗ Colored ring'as ant action-needed cards — user nepraše, atrodė kaip decoratyvinis rėmelis ne urgency
- ✗ `authReady` await + `credentialDone` race coordination — over-engineered iOS PWA auth
- ✗ Server-side OAuth flow (kai signInWithPopup veikia)
- ✗ Bone halo ant mascot FAB (atrodė kaip projektorius)
- ✗ navigateFallbackDenylist workbox'e be reikalo

Mažiau code'o = mažiau klausimų ką ir kada naudoti.

---
