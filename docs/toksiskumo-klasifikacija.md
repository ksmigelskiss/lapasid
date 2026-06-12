# Augalų toksiškumo klasifikacija — struktūruotas pamatas (2026-06-12)

> **PATIKIMUMAS (skaityk pirmiausia):** Tai research-grade JUODRAŠTIS, susintetintas iš
> autoritetingų šaltinių — ASPCA / ASPCApro, Pet Poison Helpline, Merck Vet Manual, StatPearls/NCBI,
> California/Utah Poison Control, peer-reviewed (JAVMA, ScienceDirect, Springer). **NE toksikologo
> verifikuotas** — tai sekantis žingsnis (akademijos partnerystė, žr. `tasks/konsiliumas-2026-06/33`).
> Bendras solidumas ~85-90%; kiekvienos klasės/genties patikimumas pažymėtas (AUKŠTAS/VID/ŽEMAS).
> Tikslus pagrindas padarytas; spragos eksplicitiškai įvardytos, tikslumas NEišgalvotas (jokių mg/kg
> kur literatūra jų neturi). Šaltiniai — kiekvienam tvirtinimui (žr. tyrimo agentų raportus sesijoje).

---

## 1. MODELIS — kodėl KLASĖ + RŪŠIS, ne „kiekis"

Founder'io intuicija („baigtinis pasikartojančių junginių rinkinys") **teisinga**. Bet ašis yra
**junginio cheminė KLASĖ**, ne „mažas/vidutinis/didelis kiekis". Priežastis:

- **Sunkumą beveik visada lemia KLASĖ (+ rūšis + augalo dalis), ne dozė.** Mikrogramai ricino/abrino
  mirtini; pilna burna oksalato rafidžių — skausminga, bet nemirtina. Klasė nustato „lubas" (ceiling).
- **mg/kg dozių literatūroje dažniausiai NĖRA** — priskirti „kiekius" reikštų išgalvoti tikslumą.
- **Toksinai paveldimi taksonomiškai** — biosintezės keliai konservuojami gentyje/šeimoje → klasę
  galima priskirti **per gentį** (dažnai per visą šeimą), ne per augalą atskirai. Tai ir yra tas
  lengvas redagavimas/priskyrimas, kurio siekiam.

**Dvi ašys:**
1. **Junginio klasė** (~15 baigtinių) → priskiriama (dropdown). Atsineša mechanizmą, sunkumo lubas,
   simptomus, „ką medikui", antidotą — AUTOMATIŠKAI.
2. **Sunkumas** → IŠVEDAMAS iš `klasė × tikslinė rūšis × augalo dalis`, ne laisvai priskiriamas.

**Rūšis keičia viską** (katė ≠ šuo ≠ paukštis): tas pats augalas gali būti 🔴 vienai rūšiai, ⚪ kitai.

---

## 2. DUOMENŲ STRUKTŪRA (siūloma schema)

Dvi tabelės — universali klasių referencija + per-augalą priskyrimas.

### 2A. `TOXIN_CLASSES` — globali referencija (~15 įrašų, verifikuojama eksperto vienąkart)
```
{
  id: 'ca_oxalate_insoluble',          // stabilus raktas
  vardas_lt: 'Netirpūs kalcio oksalatai (rafidės)',
  vardas_en: 'Insoluble calcium oxalate raphides',
  mechanizmo_tipas: 'lokalus_dirgiklis', // | sisteminis | fototoksinis
  organas: null,                        // 'širdis' | 'kepenys' | 'inkstai' | 'nervai' | null
  sunkumo_lubos: 'vidutinis',           // ceiling: silpnas|vidutinis|sunkus|mirtinas
  doze_priklausomas: true,              // beveik visada true
  antidotas: null,                      // 'DigiFab' | 'Hidroksokobalaminas' | null
  rūšies_jautrumas: {                   // numatytasis; override per-augalą jei reikia
    žmogus: 'silpnas', katė: 'silpnas', šuo: 'silpnas',
    paukštis: 'vidutinis', graužikas: null  // null = nepakanka duomenų
  },
  simptomai_lt: 'Burnos deginimas, seilėtekis, gleivinės patinimas...',
  medikui_lt: 'Simptominis; antidoto nėra; 112 jei ryklės patinimas/dusulys.',
  patikimumas: 'AUKŠTAS',
  saltiniai: ['url', ...]
}
```

### 2B. Per-augalą (catalog entry) — priskyrimas
```
toksinai: [
  { klasė: 'ca_oxalate_insoluble', dalis: 'visos', patikimumas: 'AUKŠTAS' },
  // augalas gali turėti KELIAS klases (pvz. Amaryllis: lycorine + oksalatai)
],
specialios_veliavos: ['liūtis_katei_kritinė'],  // retos rūšies-specifinės išimtys (žr. §5)
```
`dalis` ∈ {visos, lapai, sultys/latex, svogūnėlis, gumbas, sėklos, uogos, žiedai, šaknys}
— **kritiška**: Amaryllidaceae/Gloriosa/Begonia toksinas koncentruotas NE lape.

### 2C. Ryšys su esama `deriveToxicity`
Esamas `pavojai[{tipas, severity, target, detales}]` LIEKA. Naujas `toksinai[]` sluoksnis yra
ABOVE — paaiškina KODĖL (junginys) ir maitina medikų kortelę. `IRRITANT_ONLY_GENERA` (oksalatai/
saponinai) jau yra primityvus klasės atpažinimas → migruoja į struktūruotą `toksinai[]`.

---

## 3. KLASIŲ REFERENCIJA (15 klasių — master lentelė)

| # | Klasė | Mechanizmas | Sunkumo lubos | Antidotas | Pavyzdys | Patikim. |
|---|---|---|---|---|---|---|
| 1 | Netirpūs Ca-oksalatai (rafidės) | Lokalus dirgiklis | vidutinis | — | Dieffenbachia, Pothos, Monstera | AUKŠTAS |
| 2 | Tirpūs oksalatai | Sisteminis (Ca→hipokalcemija, inkstai) | sunkus (dozėje) | Ca palaik. | Oxalis, Begonia (gumbai), Rheum | VID-AUKŠTAS |
| 3 | Saponinai | Lokalus/GI (+hemolizė teor.) | silpnas | — | Hedera, Yucca, Dracaena/Sansevieria | VIDUTINIS* |
| 4 | Kardiakiniai glikozidai | Sisteminis — ŠIRDIS | **mirtinas** | **DigiFab** | Oleandras, pakalnutė, Kalanchoe, Digitalis | AUKŠTAS |
| 5 | Tropano alkaloidai | Sisteminis — antikolinerginis | sunkus | Fizostigminas | Datura, Brugmansia | AUKŠTAS |
| 6 | Glikoalkaloidai (solaninas) | Membranos + AChE | vidutinis | — | Solanum (dekor.) | AUKŠTAS |
| 7 | Amarilio alkaloidai (lycorine) | Centrinis emetinis | silpnas | — | Narcizai, Amaryllis, Clivia | VID-AUKŠTAS** |
| 8 | Kolchicinas | Mitozės blokas, daugiaorganinis | **mirtinas** | — (klinikai) | Gloriosa, Colchicum | AUKŠTAS |
| 9 | Akonitinas (diterpeno alkaloidai) | Na-kanalai (širdis/nervai) | **mirtinas** | — | Aconitum, Delphinium | AUKŠTAS |
| 10 | Pirolizidino alkaloidai | Kepenys (LĖTINIS, ne ūmus) | sunkus (lėtinis) | — | Senecio, Symphytum | AUKŠTAS*** |
| 11 | Diterpeno esteriai/forboliai (latex) | Lokalus (PKC); akys sunkiau | vidutinis | — | Euphorbia, krotonas, poinsetija | AUKŠTAS |
| 12 | Grayanotoksinai | Na-kanalai (širdis/vagus) | vidutinis | (Atropinas) | Rododendrai, azalijos | AUKŠTAS |
| 13 | Cianogeniniai glikozidai | Citochromo oksidazė (HCN) | **mirtinas** | **Hidroksokobalaminas** | Prunus kauliukai, Hydrangea | AUKŠTAS |
| 14 | Toksalbuminai/lektinai | Ribosomų inaktyvacija | **mirtinas** (prarijus ~98% išgyvena) | — | Ricinus, Abrus | AUKŠTAS |
| 15 | Furokumarinai (fototoksinai) | Fototoksinis (DNR + UVA) | vidutinis (oda) | — | Barštis, Ruta, Ficus sula, Citrus | AUKŠTAS |
| (+) | Cikazinas | Kepenų nekrozė | **mirtinas** | — | Cycas/Zamia (sago „palmė") | AUKŠTAS |
| (+) | Antrachinonai (aloinas) | GI laisvinantis (latex) | silpnas | — | Aloe (geltonas latex) | AUKŠTAS |

\* Saponinų **realus klinikinis sunkumas dažnai PERVERTINAMAS** — per os mažai absorbuojasi, daugiausia GI.
\** Lycorine **tikslus mechanizmas dalinai žinomas** — šaltiniai tai sako tiesiai.
\*** Pirolizidino alkaloidai kambariniams MAŽAI aktualūs (lėtinis, vaistažolių/arbatų rizika).

---

## 4. GENTIS → KLASĖ priskyrimas (tier'ai pagal patikimumą)

**1 tier — botaniškai TVIRTA (priskirk drąsiai per gentį/šeimą):**
- **Araceae** (Monstera, Philodendron, Dieffenbachia, Epipremnum/Pothos, Spathiphyllum, Anthurium,
  Alocasia, Aglaonema, Caladium, Syngonium, Zantedeschia, Colocasia) → **netirpūs Ca-oksalatai**.
  Dieffenbachia + Alocasia stipriausi (+ proteolitiniai fermentai).
- **Amaryllidaceae** (Amaryllis/Hippeastrum, Narcissus, Clivia) → **lycorine + rafidės**; **SVOGŪNĖLIS** kritinis.
- **Euphorbia** (visa gentis + krotonas/Codiaeum) → **diterpeno esteriai (latex)**.
- **Kalanchoe** (visos rūšys) → **kardiakiniai glikozidai (bufadienolidai)**; žiedai stipriausi.
- **Oleandras / pakalnutė / Digitalis** → **kardiakiniai glikozidai (MIRTINA)**.
- **Dracaena (įsk. Sansevieria) + Yucca** → **saponinai**.
- **Gloriosa** → **kolchicinas (gumbai, MIRTINA)**.
- **Cycas/Zamia** (sago „palmė") → **cikazinas (kepenys, MIRTINA)**.
- **Aloe** → **antrachinonai** (geltonas latex; skaidrus gelis saugus).

**2 tier — TIKRINTI dalį ar rūšį:**
- **Begonia / Oxalis** → **TIRPŪS** oksalatai (≠ Araceae netirpūs!); **gumbai >> lapai**; rūšių chemija svyruoja.
- Amaryllidaceae — visada akcentuoti **svogūnėlis ≠ lapas**.

**3 tier — ABEJOTINA (NEpriskirk aklai):**
- **Crassula** (nefritas/pinigų medis) → **klasė NENUSTATYTA** (ASPCA toksiška, „toxic principle
  unknown"; NE bufadienolidai — tai Kalanchoe painiava). Žymėti „toksiška, junginys nepatvirtintas".
- **Ficus** → ficinas + psoralenai; ASPCA toksiška, bet **klinikai ŠVELNI** (kontaktinis dermatitas,
  ne sisteminis). NEpervertinti.
- **Poinsetija** → forboliai, bet rizika **PERVERTINTA mitu**; žymėti „švelnus dirgiklis", NE mirtina.

---

## 5. RŪŠIES JAUTRUMO ŽEMĖLAPIS + specialios vėliavos

🔴 mirtina/kritiška · 🟠 reikšminga · 🟡 lengva (lokalu) · ⚪ menka · ❔ duomenų spraga

| Klasė | Katė | Šuo | Paukštis | Graužikas |
|---|---|---|---|---|
| Lelijų nefrotoksinas (Lilium/Hemerocallis) | 🔴 **unikaliai** | 🟡 | ❔ | ⚪ (atsparūs) |
| Kardiakiniai glikozidai | 🔴 | 🔴 | 🟠❔ | 🟠❔ |
| Toksalbuminai | 🔴 | 🔴 | ❔ | 🔴 |
| Cikazinas (sago) | 🟠–🔴 | 🔴 (kepenys) | ❔ | ❔ |
| Persinas (avokadas) | ⚪–🟡 | ⚪–🟡 | 🔴 **mirtina** | ❔ |
| Grayanotoksinai | 🟠 | 🟠 | 🟠❔ | ❔ |
| Amarilio alkaloidai | 🟠 | 🟠 | 🟠❔ | ❔ |
| Netirpūs Ca-oksalatai | 🟡 (jautriau) | 🟡 | 🟠 (ryklės edema) | ⚪❔ |
| Saponinai | 🟡 | 🟡 | 🟡❔ | ⚪❔ |

**SPECIALIOS VĖLIAVOS (retos rūšies-specifinės išimtys, override numatytąjį):**
- **`liūtis_katei_kritinė`** — `Lilium`/`Hemerocallis` katėms: net vanduo/žiedadulkės → inkstų nekrozė;
  **18 val. langas** gydymui. (Tikslus toksinas NEŽINOMAS — neteigti, kad žinomas.) Šuniui = 🟡.
- **`avokadas_paukščiui_kritinis`** — `Persea` paukščiams mirtina; šunims/katėms ⚪.
- **Klaidingos „lelijos"** — buitinė „lelija" ≠ `Lilium`: Spathiphyllum/Zantedeschia = oksalatai;
  Convallaria = kardiakiniai glikozidai. Genties identitetas tikrinamas TIKSLIAI, ne pagal pavadinimą.

**„LETHAL" gentų whitelist („skambink DABAR", rūšiai-sąlyginis):** Lilium, Hemerocallis (katei),
Nerium, Digitalis, Convallaria, Kalanchoe, Cycas/Zamia, Ricinus, Abrus, Rhododendron/Azalea, Taxus*,
Persea (paukščiui), Aconitum*, Colchicum*, Gloriosa.
\* Taxus/Aconitum/Colchicum/Brunfelsia/Cestrum — bendrai pripažintos itin toksiškomis, bet šioje
sesijoje NE individualiai per ASPCA verifikuotos → patikrinti prieš produkciją (patikim. VIDUTINIS).

---

## 6. SAUGIOS gentys (ASPCA patvirtinta — „saugu" irgi vertinga)
Calathea (Goeppertia), Maranta, Peperomia, Pilea (+P. peperomioides), Hoya, Echeveria,
Chamaedorea + tikros palmės (Areca/Dypsis, Howea), TIKRI paparčiai (Nephrolepis, Pteris, Adiantum,
Asplenium, Phlebodium), dauguma kaktusų (rizika tik mechaninė — spygliai), Chlorophytum (voratinklinis).

**Du pavadinimų spąstai:**
1. **„Sago palmė" (Cycas)** = NE palmė → cikazinas, MIRTINA. Niekada nepriskirti palmių saugumo.
2. **„Asparaginis paparčiukas" (Asparagus)** = NE papartis → saponinai. Tikri paparčiai saugūs.

---

## 7. SĄŽININGUMO RIBOS / kas dar reikalinga
- **Eksperto (toksikologo) verifikacija** — pagrindinė. Ši lentelė = jam paruoštas juodraštis (33 planas).
- **Pervertinto pavojaus atvejai** (sistema privalo NEgąsdinti): poinsetija, ricinas-prarijus, Ficus,
  netirpūs oksalatai (dažni, bet retai rimti). AAPCC 2022: Ca-oksalatai — 0 mirčių.
- **Didžiausios duomenų spragos:** paukščiai (išsk. avokadą), graužikai-augintiniai (LD50 dažniausiai
  iš laboratorinių pelių/žiurkių, NE klinikinių augintinių). „Nepakanka duomenų" geriau nei klaidinga žyma.
- **LT realybė:** NĖRA 24/7 gyvūnų apsinuodijimų linijos (ASPCA/PPH = JAV, mokami, angliški). Realus
  gyvūnų CTA = artimiausia 24/7 vet klinika (LSMU SGK Kaunas; Lazdynų/24h Vilnius). Žmonėms = LT
  Apsinuodijimų kontrolės ir informacijos biuras (24/7) — bet jis ŽMONIŲ, ne gyvūnų.

---
_Visi tvirtinimai paremti tyrimo agentų raportų šaltiniais (ASPCA, StatPearls, Merck Vet, poison
control, peer-reviewed). Kur literatūra plona ar prieštarauja — pažymėta tiesiai._
