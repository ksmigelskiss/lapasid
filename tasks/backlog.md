# Backlog — vėliau, kai bus realus poreikis

Idėjos / future enhancement'ai, kuriuos sąmoningai atidedam. Šis failas
egzistuoja, kad neuzmirštume — bet **neimplementuojam**, kol nebus konkretus
pain'as ar request'as. (Žiūr. lessons.md simplify default principą.)

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
