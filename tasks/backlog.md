# Backlog — vėliau, kai bus realus poreikis

Idėjos / future enhancement'ai, kuriuos sąmoningai atidedam. Šis failas
egzistuoja, kad neuzmirštume — bet **neimplementuojam**, kol nebus konkretus
pain'as ar request'as. (Žiūr. lessons.md simplify default principą.)

---

## Photo source'as cultivars'ams — backup options

**Data:** 2026-05-15
**Kontekstas:** Bandėm integruoti Google Custom Search Image API kaip
primary photo source cultivars'ams. Google account-level blokuoja Custom
Search JSON API naujiems projektams 2024-2025 (transition į Vertex AI
Search). Net atskiras non-Firebase project'as su pilna setup'a gauna
403 „project does not have the access".

**Esamas state'as:** Wikidata + Wikipedia + Commons fallback chain.
Coverage ~30-40% candidates. Likę — emoji placeholder.

**Kelios opcijos jei reikės geresnio photo coverage:**

1. **Manual admin photos** (priority — nieko nereikia kurti, jau galima
   pridėti per PlantInfo edit). Tampa „verified by admin" trust signal.

2. **Bing Image Search API** (Microsoft Azure, $3/1000 queries) — like
   Google CSE bet neturi restrictions. Setup ~1 valanda jei prireiks.

3. **PlantNet API** (free, plant-focused) — bet mostly species, cultivar
   coverage silpna.

4. **Garden.org / RHS scraping** — fragile (HTML keisis), bet free.
   ~4-6 valandos darbo.

**Kada implementuoti:** kai catalog turės 50+ verified entries IR vis dar
matysim, kad photo coverage'as silpnas user'iams. Iki to — manual'us
admin photos pakanka.

---

## Auth account merge — Google ↔ Facebook ↔ Email

**Data:** 2026-05-15
**Kontekstas:** Firebase Console „Link accounts that use the same email"
įjungta, bet automatiškas merge'as login metu neveikia — tik error'as
`auth/account-exists-with-different-credential` su friendly message'u.

**Kas dar nepadaryta:**

Reali scenario: tas pats žmogus prisijungė pirmą kartą per Google
(`friend@gmail.com` → UID_A → `col_A` su X augalų), paskui paskambino,
kad bandė per Facebook ir „nepavyko" (gavo friendly message'ą). Mes turim
DVI atskiras vartotojo paskyras DB'e — UID_A su augalų kolekcija ir
hipotetinę UID_B, kurią būtų sukurta jei FB login'as praeitų.

**Sprendimas (kai prireiks):**

1. Admin panel'e — naujas „Merge users" button'as
2. Pasirinkti du users (drop-down arba detail drawer action)
3. Helper funkcija `mergeUsers(primaryUid, secondaryUid)`:
   - Move'ina visus `collections/{cid}` kur ownerId == secondary → ownerId = primary
   - Move'ina visus plants, zones, zinynas tarp kolekcijų (arba palieka atskirose, su option'u perjungti)
   - Updateina `members` arrayuose: secondary → primary
   - Update'ina `roles.${secondary}` → `roles.${primary}`
   - `memberProfiles.${secondary}` → cleanup
   - Delete `users/${secondary}` doc
4. Optional: `linkWithCredential` ant Firebase Auth lygmens, kad ateityje
   abu provider'iai veiktų prie vieno UID

**Risk:** data loss jei klaida. Reikia backup'inti DB prieš testuoting +
double-confirm dialog'as.

**Kada implementuoti:** kai friend'as iš tikrųjų paklaus „kaip sujungti
mano accounts" arba pamatysim, kad pas mane DB'e yra dublikuojami users
su tuo pačiu email'u (admin panel'e matosi).

---

## External structured plant DB integration

**Data:** 2026-05-17
**Kontekstas:** Test'avime su Calathea + Boulevard + Knock Out — pastebėjom,
kad mes faktiškai synthesize'inam care info iš kelių web sources per AI'us
(Wikipedia + iNat + Wikidata + Brave + Claude training data). User'is
paklausė: gal yra mokama strukturizuota DB, kuria perrašyti / išversti
užtektų, ir nereiktų AI'ui sintezuoti iš nulio?

**Realybės check'as** (apžvalga 2026-05):

| DB | Coverage | Care info | API | Kaina |
|---|---|---|---|---|
| Trefle | 1M+ rūšių | Yes | DEAD ~2022 | — |
| RHS Plant Finder (UK) | 70K + cultivars | Yes | nėra public | — |
| Perenual | 10K rūšių | Yes | REST | $9/mo |
| PlantNet | 350K | Identification only | REST | Free non-commercial |
| Plants of World (Kew) | 1.3M | NO (taxonomy only) | Free | — |
| iNaturalist | 350K | Minimal | Free | — (jau naudojame) |
| OpenFarm | ~10K | Crowdsource | Free | — |

**Vienaragis nėra:** „garden cultivars + care info + multi-language + reasonable
price" — niekas to neturi. Trefle bandė ir uždarė. RHS turi best data, bet
no public API.

**Realiausias kandidatas — Perenual** ($9/mo, 10K species):
- Strong species-level care info structured
- Silpnas cultivar coverage (Boulevard'o ten nerasi)
- Galėtų replace'inti AI calls'ams paprastiems plants (Calathea, Hosta, Monstera)
- Cultivar'iams vis vien reikėtų AI + web_search

**Kada implementuoti:**

1. **Layer 2.5 (Wikipedia + AI structurer)** įdiegti pirma (žiūr. atskirą thread'ą
   apie search architektūrą) — tai free + native source. Pažiūrim, kiek
   užtenka species level užklausoms.
2. JEI Wikipedia'os accuracy nepakanka → tikrinti Perenual kaip Layer 2.5
   alternatyvą. ~$9/mo už tikslesnį structured care info.
3. RHS gold standard. Jei rasim būdą integruoti (scraping, kontakta su jais)
   — to būtų big win cultivars'ams. Bet rizika legal + technical (fragile).

**Sprendimas dabar:** Layer 2.5 įdiegti su Wikipedia kaip primary. Perenual'as
— tik kai realiai matom limit'us.

---

## [DONE] Priežiūros santrauka — apjungimas + snooze refaktoras

**Užbaigta** (buvo `todo.md`, perkelta čia 2026-05-28). Snooze gyvena kaip
`inspection` event'as timeline'e (single source of truth, Firestore sync,
auto-expiry). CareOverview apjungtas, mažas ✓ mygtukas pašalintas, „Patikrinau"
mygtukas PlantCareCard'e. Build + dev verifikuota. Pilnas įrašas + pamokos —
git istorijoje (todo.md prieš 2026-05-28 master plan rewrite).
