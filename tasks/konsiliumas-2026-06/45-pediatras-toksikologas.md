# Saugumo feature konsiliumas — Pediatras / apsinuodijimų toksikologas (2026-06-12)

_Lęšis: kas REALIAI nutinka, kai vaikas kontaktuoja su kambariniu augalu, ir kokia info tėvui
GENUINELY naudinga (ne baimę kelianti). Mandatas: skirti naudinga nuo pritempta negailestingai;
jokio medicininio patarimo — tik INFO + kontaktai._

---

## 0. Klinikinė tikrovė (pamatas, ant kurio statau verdiktus)

Tai svarbiausia, ką šis lęšis duoda konsiliumui — **kalibracija**, ne feature'ų sąrašas:

**Didžioji dauguma vaikų ekspozicijų su kambariniais augalais yra LENGVOS arba besimptomės.**
Tai ne nuomonė — tai poison-control duomenys:

- Augalai = ~5% visų apsinuodijimų skambučių; **dauguma pacientų besimptomiai, <20% turi
  lengvus–vidutinius simptomus, labai retas reikalauja rimtos intervencijos.**
- 6 metų pediatrinis retrospektyvas (0–18 m., 71 atvejis): **28% besimptomiai, 52% lengvi,
  20% vidutiniai, 0% sunkių ar mirtinų.** Asimptomiai+lengvi = **80,3%**. Mirčių — nulis.
- Vaikų amžius: **71% atvejų ≤5 m.** (vidurkis 4,66 m.) — tai burnoje-tyrinėtojai, ne valgytojai.
- Philodendron/Dieffenbachia (188 prarytų atvejų retrospektyvas): **tik 2,1% (4/188) išvystė
  BET KOKĮ simptomą.** Kai simptomai būna — per 5 min ir trumpalaikiai.
- Poinsetija (mitas, kuris nemiršta): 22 000+ vaikų skambučių, **0 mirčių, 92%+ jokių simptomų,
  96%+ nereikėjo gydymo.** 22 kg vaikas turėtų suvalgyti 500–600 lapų, kad pasiektų pavojų.

**Kodėl tai kritiška LapasID'ui:** oxalate augalai (philodendron, dieffenbachia, monstera,
pothos, colocasia, spathiphyllum, alocasia) — **dažniausi „toksiški" kambariniai** ir
**dažniausi vaikų ekspozicijos kaltininkai** — yra **lokalūs deginantys dirgikliai, NE sisteminiai
nuodai.** Raphidai (kalcio oksalato adatėlės) sukelia momentinį burnos deginimą → vaikas
pats nustoja kramtyti → **didelis kiekis praktiškai negalimas.** Skausmas = apsauginis mechanizmas.

**Iš to plaukia GRIEŽTAS rėmas šiam konsiliumui:**
> Jei feature elgiasi su „toksiška = mirtina", jis **dezinformuoja ir kelia paniką.** 95%+ atvejų
> teisingas atsakymas tėvui yra „nuraminkite, nuplaukite burną, stebėkite, paskambinkite jei
> abejojate" — NE „skubėkite į ligoninę". Tikras feature turi **deeskaluoti, ne eskaluoti.**
> Vienintelis vietas, kur eskalacija pateisinta — **maža saujelė tikrai sisteminių augalų**
> (žemiau). LapasID privalumas atsiranda TIK jei jis šitą skirtumą daro tiksliau nei „toxic ✕".

---

## 1. Feature lentelė

| # | Funkcija | Kokią REALIĄ problemą sprendžia | Naud↔pritempta (1–5) | Build kaina | VERDIKTAS + kodėl |
|---|---|---|---|---|---|
| A | **Sunkumo-tiered toksiškumas (lokalus-dirgiklis vs sisteminis)** vietoj binarinio „toxic ✕" | 95% „toksiškų" kambarinių = lokalūs dirgikliai; binarinis ženklas meluoja ir kelia paniką | **5** | Pigu (deriveToxicity JAU turi severity+tipas; reikia UI kalbos) | **STATYTI** — vienintelė feature, kuri tiesiogiai kovoja su dezinformacija; pamatas visam kitam |
| B | **„Vaikas paėmė lapą — kas dabar?" avarinis flow** (foto/rūšis → sunkumo tipas → ką stebėti → kada+kam skambinti) | Tėvas 2 nakties, vaikas su lapu burnoj, reikia per 30 s sužinoti ar 112 ar ne | **5** | Vidut (skenas yra; flow+turinys+kontaktai naujas) | **STATYTI** — tikras momentas, kurio niekas neoptimizuoja; BET tik info+triage+kontaktai, jokios diagnozės |
| C | **Vietinis poison-control kontaktas viename tap'e** (LT: Apsinuodijimų biuras +370 5 236 2052 / +370 687 53378, 24/7; arba 112) | Tėvas panikoj neranda numerio; Google duoda US 1-800-222-1222 (neveikia LT) | **5** | Pigu (statiškas, geo-aware) | **STATYTI** — pigiausia tikra vertė app'e; gelbsti realiai, nuasmenina „diagnozę" |
| D | **„Over-feared" demistifikacija** (poinsetija/dažni oxalate — „dažnai bijoma, realiai lengva") | Kovoja su panika; build'ina pasitikėjimą, kad app sako TIESĄ ne fear-marketingą | **4** | Pigu (turinys ant severity-tier) | **STATYTI** — diferenciatorius: app, kuris nuramina, o ne gąsdina, įgyja pasitikėjimą |
| E | **Namų profilis: vaikų amžius** (≤5 m. = aukšta rizika, ≥6 m. = žema) | 71% ekspozicijų ≤5 m.; rizika labai amžiaus-jautri; personalizuoja be panikos | **4** | Pigu (3 klausimai onboardinge) | **STATYTI** — amžius tikras rizikos modifikatorius; leidžia po 6 m. NUTILDYTI įspėjimus (anti-panika) |
| F | **Zonų saugumo semantika** (toksiškas augalas „vaiko kambary"/žemoj zonoj = konfliktas) | Praktiškas išdėstymo signalas; ≤5 m. siekia tik tai, kas pasiekiama | **4** | Pigu (zonos JAU yra; + tipo laukas) | **STATYTI** — vienintelė reali prevencija = pasiekiamumas; pigu, unikalu, ne-baimę-kelia |
| G | **Auklės/svečio saugumo kortelė** (plant-sitter sharing + „kas dirgina vaiką šiuose namuose") | Auklė nežino tavo augalų; vaikui pas svečius didžiausia rizika | **3** | Pigu (sharing JAU veikia) | **GAL** — tikras use-case, bet siauras; vertinga TIK jei A/B/C jau yra |
| H | **Išdėstymo rekomendacijos per augalą** (aukštis, nuokritų rizika) | Nuokritę uogos/lapai pasiekiami net jei augalas aukštai | **3** | Vidut | **GAL** — naudinga oxalate-aukštos rūšims, bet greitai virsta noise jei kiekvienam augalui |
| I | **Sezoniniai push įspėjimai** (Kalėdos+poinsetija) | — | **1** (vaikams) | Vidut | **ŽUDYTI** (vaikų kontekste) — poinsetija vaikams NEpavojinga; tai būtų fear-marketingo paradigma. (Katėms+lelijos — kitas lęšis.) |
| J | **„Saugumo balas" (skaičius 0–100 kolekcijai)** | — | **2** | Vidut | **ŽUDYTI** — gamifikuoja paniką; „72/100" nieko nereiškia ir kelia nerimą be veiksmo. Vietoj balo → konkretūs 1–3 veiksmai |
| K | **Bet koks simptomų „tikrintuvas"/„ar rimta?" sprendimų medis, duodantis verdiktą** | — | — | — | **ŽUDYTI** — medicininė diagnozė = liability. Riba: app rodo INFO ką stebėti + kontaktą, NIEKADA nesako „nesijaudink"/„važiuok į ligoninę" |

---

## 2. Ko NIEKAS nedaro, bet realiai naudinga (iš mano lęšio)

**2.1. Toksiškumo DEESKALACIJA — „dažnai bijoma, realiai lengva."**
Visi konkurentai (PictureThis, ASPCA, blogai) duoda binarinį „toxic" ženklą, kuris **per-gąsdina**:
poinsetija, philodendron, pothos visi pažymėti vienodai raudonai su, sakykim, oleandru. Tėvas to
nemato skirtumo. **Įrodymas:** poinsetijos mitas atsekamas iki 1919 m. klaidingai priskirtos vaiko
mirties ir gyvas 100+ metų DĖL šito vienodinimo. App, kuris pasako *„tai dažnas dirgiklis —
burnos deginimas, praeina; ne sisteminis nuodas; nuplaukite burną, stebėkite"* daro tai, ko
poison-control linijos daro telefonu 80% laiko. **Tai unikalu rinkoj ir mažina, ne kelia, nerimą.**

**2.2. Lokalus-dirgiklis vs sisteminis SKIRTUMAS pirmame ekrane.**
Klinikinis skirtumas, kuris keičia VISKĄ:
- **Lokalus dirgiklis** (kalcio oksalatas — philodendron, dieffenbachia, monstera, pothos,
  spathiphyllum, alocasia, colocasia): burnos/lūpų deginimas, seilėtekis, edema. Savaribojantis
  (skausmas stabdo valgymą). **Praktiškai niekada sisteminis. Namų priežiūra + stebėjimas.**
- **Sisteminis nuodas** (reta, bet TIKRA): oleandras (širdies glikozidai — 1 lapas mirtinas
  suaugusiam), ricinas/Ricinus (ricinas — vienintelis pediatriniame studijoje davęs visus
  „vidutinio" sunkumo atvejus), angelo trimitas/Brugmansia/Datura (atropinas, skopolaminas),
  vario/Convallaria, oleandro grupė. **ŠITIE pateisina eskalaciją.**

Niekas namų app'e šito skirtumo nedaro. LapasID deriveToxicity JAU turi `severity` ir `tipas`
laukus — **duomenys yra, reikia tik KALBOS.** Tai pigiausias tikras diferenciatorius briefinge.

**2.3. Geolokalus poison-control kontaktas.**
Kiekvienas US šaltinis duoda 1-800-222-1222 — **LT neveikia.** Tėvas panikoj negaudo
+370 5 236 2052. App, kuris žino, kad esi Lietuvoj, ir rodo teisingą 24/7 numerį + 112 vienu
tap'u — **trivialus build'as, tikra vertė tame 5% atvejų, kur svarbu.** Tai nuasmenina „diagnozę":
app nesako ką daryti, tik nukreipia į žmogų, kuris turi teisę sakyti.

---

## 3. Ką EKSPLICITIŠKAI NEdaryti (pritemptos / liability / fear-marketing)

1. **Sezoniniai poinsetijos/„šventinių nuodų" push'ai vaikų kontekste.** Poinsetija vaikams
   NEpavojinga (22k skambučių, 0 mirčių). Push „Kalėdos — saugok vaiką nuo poinsetijos" yra
   tiksliai fear-marketingas, kurio founder'is atsisako. (Katė+lelija — kito lęšio, NE šito.)

2. **„Saugumo balas" kaip skaičius.** „Jūsų namų sauga 68/100" gamifikuoja nerimą be veiksmo.
   Skaičiaus negali interpretuoti, bet gali jaudintis. Pakeisti: **0–3 konkretūs veiksmai**
   („Šį dieffenbachia į aukštesnę lentyną, jei vaikas <3 m.") arba „Jokių veiksmų — viskas gerai."

3. **Bet koks simptomų sprendimų-medis, duodantis verdiktą** („Patikrink simptomus → tu OK").
   Tai medicininė triage = liability ir gali nuraminti, kai nereikia (arba atvirkščiai). **Riba:**
   app rodo *„Galimi požymiai: burnos deginimas, seilėtekis. Jei atsiranda kvėpavimo ar rijimo
   sunkumų — 112. Dėl bet kokios abejonės — Apsinuodijimų biuras [numeris]."* Faktas + kontaktas.
   NIEKADA „nesijaudink" ar „važiuok į ligoninę."

4. **„Induce vomiting" / pirmosios pagalbos instrukcijos.** Klasikinis pavojus: oxalate ar
   kardiotoksiniams augalams vėmimo sukėlimas **kontraindikuotas** (gali paveikti širdies ritmą,
   pakartotina mukozos trauma). App, kuris duotų pirmos pagalbos žingsnius, gali pakenkti. **Riba:**
   tik bendra „nešalink savarankiškai, skambink [kontaktas]." Jokių procedūrų.

5. **Per-žymėjimas „pavojinga" visiems oxalate augalams.** Jei monstera/pothos/philodendron
   (90% kolekcijų) visi gauna raudoną „pavojų vaikui" — user'is nustoja tikėti app'u ARBA gyvena
   nereikalingoj baimėj. **Kalibracija = naudoti realų sunkumą, ne ASPCA binarinį flag'ą.**

---

## 4. Vienas konkretus scenarijus (kaip turi atrodyti „auksas")

> Tėvas, 2 nakties. 18 mėn. vaikas čiulpė monsteros lapą, dabar verkia, seilėjasi. Tėvas atidaro
> LapasID → „Kas dabar?" → pasirenka monsterą (arba skenuoja). Ekranas:
> **„Monstera — lokalus dirgiklis (kalcio oksalatas), NE sisteminis nuodas.** Burnos deginimas ir
> seilėtekis dažni ir praeina savaime. **Ką stebėti:** kvėpavimo/rijimo sunkumas, didelė liežuvio
> edema → 112. **Dėl bet kokios abejonės 24/7:** Apsinuodijimų biuras +370 5 236 2052 [SKAMBINTI].
> Nešalink medžiagos savarankiškai." — Vienas ekranas, 10 sekundžių, deeskaluoja teisingai, jokios
> diagnozės, nukreipia į teisėtą instituciją. **Tai feature, dėl kurios tėvas atsisiųstų app.**

---

## 5. Šaltiniai (web research)

- Pediatrinis 0–18 m. retrospektyvas (severity %, augalai, amžius): https://pmc.ncbi.nlm.nih.gov/articles/PMC10969538/
- Philodendron/Dieffenbachia (2,1% simptominių) Poison Control: https://www.poison.org/articles/dieffenbachia-and-philodendron-202
- Philodendron/dieffenbachia ingestions — are they a problem? (PubMed): https://pubmed.ncbi.nlm.nih.gov/1749055/
- Kalcio oksalatas / raphidai burnoje (J Pediatrics): https://www.jpeds.com/article/S0022-3476(20)31378-0/fulltext
- Poinsetijos toksiškumo mitas (22k skambučių, 0 mirčių): https://www.poison.org/articles/poinsettias ; McGill OSS: https://www.mcgill.ca/oss/article/did-you-know-health-and-nutrition/what-you-need-know-about-poinsettias-and-poison
- Tėvo veiksmai / NEsukelti vėmimo (CHOP): https://www.chop.edu/centers-programs/poison-control-center/poisonous-plants ; Calla lily atvejis: https://www.poison.org/articles/my-child-ate-a-piece-of-a-calla-lily-222
- Sisteminiai augalai (oleandras, ricinas, Brugmansia): https://raisingchildren.net.au/toddlers/safety/poisons/dangerous-plants
- LT Apsinuodijimų kontrolės ir informacijos biuras (24/7 +370 5 236 2052 / +370 687 53378): https://sam.lrv.lt/lt/veiklos-sritys/visuomenes-sveikatos-prieziura/informacija-apie-apsinuodijimus-ir-ju-prevencija/
