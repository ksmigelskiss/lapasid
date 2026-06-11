# VIZIJA V2 — juodraštis founder'io peržiūrai (2026-06-11)
_Trijų segmentų modelio (43) vertimas į puslapio struktūrą ir tekstus. NIEKO neliečiam HTML/kode,
kol founder'is nepatvirtino krypties ir tekstų tono._

---

## A. NAUJA PUSLAPIO ARCHITEKTŪRA (siūloma)

```
lapasid.lt (pradinis, VIEŠAS, be login)
├── HERO: paieška + saugumo žinutė
├── BIBLIOTEKA: augalų kortelės (akvarelė + toksiškumo ženklas) — naršoma viešai
├── [augalo puslapis] /augalai/{slug} — vieša kortelė + „Įterpti" + „Spausdinti kortelę"
├── MISIJA (viešas puslapis) — kodėl tai darome, akademijos kvietimas
├── PROGRAMĖLĖ (tab) — „Tavo kolekcija": login + app'as (esamas produktas)
└── VIZIJA (atskiras puslapis, gated kaip dabar) — verslo/investorinis V2
```

Esminis pokytis: **biblioteka ir paieška tampa VIEŠU veidu** (1 segmentas priekyje),
app'as — tab'as norintiems daugiau (2 segmentas), verslo vizija — atskirai (3 + planai).

### Pradinio HERO tekstas (draft)
> **Ar šis augalas saugus tavo namams?**
> Atvira lietuviška kambarinių augalų biblioteka — su aiškiai parodytu toksiškumu
> vaikams ir augintiniams. Nemokama. Visada.
> [ 🔍 Ieškoti augalo... ]
> Populiariausi: [Monstera ⚠] [Sansevieria ⚠] [Chlorophytum ✓] ...

### KRITINIAI pre-requisites prieš darant viešą biblioteką (iš konsiliumo)
1. 🔴 **firestore.rules:86 catalog write fix** (URGENT iš STATE — viešinant katalogą atviras
   write tampa dar pavojingesnis)
2. **Viešas paviršius = TIK saugumo-švarūs laukai**: vardas (LT+lot) + akvarelė + toksiškumas/
   savybes (deriveToxicity = mūsų) + HN 75 žyma. Aprašymai/care VIEŠAI tik po licencijų valymo
   (PFAF NC! knygos!). App'o viduje kaip dabar — ten ne „viešas publikavimas".
3. Paieška vieša = be AI (tik catalog/fuzzy search) — kitaip kaštai ir abuse. AI paieška lieka app'e.

---

## B. MISIJOS APRAŠAS (viešas puslapis; tekstų draft'ai)

### 1. Kodėl (problema)
> Europos apsinuodijimų centrai 2008–2022 m. užregistravo 17 636 vaikų kontaktus su kambariniais
> augalais. Lietuvos higienos norma HN 75 draudžia nuodingus augalus darželiuose — bet perkant
> augalą parduotuvėje niekas neparodo, ar jis pavojingas tavo vaikui ar katei. ES skaitmenina
> kone visų produktų pasus — gyvi augalai į juos neįtraukti. Šitą spragą pildome savanoriškai.
[SĄŽININGUMO RIBA išlaikyta: jokio „mandato", tik spraga + HN 75 faktas]

### 2. Ką darome
> Kuriame atvirą, nemokamą, lietuvišką kambarinių augalų enciklopediją, kurioje saugumo
> informacija — toksiškumas žmonėms ir gyvūnams — visada matoma ir visada nemokama.
> Duomenys kuruojami iš autoritetingų šaltinių (ASPCA, botaniniai šaltiniai) ir nuolat atnaujinami.

### 3. Kaip naudotis (embed + print CTA)
> Esi tinklaraštininkas, parduotuvė, mokykla ar botanikos sodas? Įsidėk augalo saugumo kortelę
> į savo svetainę vienu kodu — ji visada rodys naujausią patikrintą informaciją. Arba atsispausdink
> kortelę su toksiškumo skale — etiketei, lentynai ar klasės sienai. Nemokamai, be registracijos.

### 4. Kvietimas akademijai/institucijoms
> Siekiame, kad kiekvieną saugumo įrašą patikrintų ekspertai — toksikologai ir botanikai.
> Jei atstovaujate botanikos sodą, universitetą ar visuomenės sveikatos įstaigą ir norite
> prisidėti prie atvirų lietuviškų augalų saugumo duomenų — parašykite.
[Badge „Patikrinta ekspertų" atsiranda TIK po realios partnerystės]

### 5. Disclaimer (ant kiekvienos kortelės + misijos apačioje)
> Informacija — pažintinio pobūdžio, ji nepakeičia gydytojo ar veterinaro konsultacijos.
> Apsinuodijimo atveju: +370 5 236 20 52 (Apsinuodijimų kontrolės ir informacijos biuras).
[Biuro numeris ant kortelių = ir naudinga, ir tylus partnerystės tiltas]

---

## C. VISION DOC V2 (verslo/investorinis; lieka gated)

### IŠIMTI iš V1 (falsifikuota/mirę — su konsiliumo įrodymais):
- ❌ „already in discussion at parliamentary level" (H-R5 FALSIFIKUOTA — UK peticija 125 parašai)
- ❌ „The tag is the foundation" seka → pamatas yra biblioteka/pasas, tag = print failas
- ❌ Toxicity Dial kaip produktas (ekonomika mirus <10K vnt; lieka print kortelės ratas)
- ❌ B2B L1–L5 pakopos kaip Y1–Y3 planas (lieka tik kaip „durys" 3 segmente)
- ❌ €15K→€100K→€280K trajektorija ir „80 sellers + 4 000 users" (aritmetiškai neįmanoma LT)
- ❌ „Lithuania only Y1–Y3" kaip dogma (LT = startas; PL = anksčiau jei kada)
- ❌ „data nobody else has" formuluotė (faktai kopijuojami; moat = gyvas kuruojamas šaltinis + santykiai)

### NAUJA ŠERDIS — trys segmentai (iš 43):
> **Atvira biblioteka — pamatas. Programėlė — indas. Komercija — durys.**
1. Misija (atvira DB + akademija) — varoma besąlygiškai; sauga 100% atvira amžinai
2. App Pro freemium — gyvas pigiai; eksperimentas be lūkesčių
3. Komercija (partnerystės/agregatai) — 0 valandų; atsidaro tik nuo išorinio signalo

### PALIEKAMA iš V1 (gyva/sustiprinta):
- ✅ Emociniai kabliukai app sekcijai: „Augalas prisimena", „Pasas augalui — ramybė namuose"
- ✅ Akvarelės identitetas
- ✅ „EU gap" sekcija (jau perrašyta sąžiningai) + HN 75 PRIDĖTI (naujas, stipresnis LT kabliukas)
- ✅ Sauga = wedge (perrėminta: acquisition, ne pajamos)
- ✅ Honest status lentelė (atnaujinti pagal realybę)
- ✅ S3 provenance niša (kolekciniai) — kaip app/premium kryptis, ne pamatas

---

## D. SEKA (siūloma)
1. Founder peržiūri šitą draft'ą → koreguojam tekstus/toną
2. Lygiagrečiai: research dokumentacija (jau fone) + 🔴 catalog write fix
3. Pradinio puslapio perdarymas (plan mode; saugumo-švarūs laukai)
4. Misijos puslapis + embed/print mygtukai
5. Vision doc HTML V2 redagavimas
6. Screenshots (founder) → embed screenshot → vision doc finalizavimas

## E. KLAUSIMAI FOUNDER'IUI
1. Ar pradinio HERO tonas geras („Ar šis augalas saugus tavo namams?") — ar nori švelnesnio/kitokio?
2. Vision doc lieka gated kaip dabar, ar darom viešą be skaičių?
3. Ar viešoje bibliotekoje rodom ir „nori/auginu" funkcijas (CTA į app), ar laikom švariai informacinę?
