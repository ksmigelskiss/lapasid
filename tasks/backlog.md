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
