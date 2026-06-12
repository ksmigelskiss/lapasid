# 45 — Veterinaro / gyvūnų toksikologo lęšis

_Konsiliumas „Namų saugumo intelektas", 2026-06-12. Lęšis: pet plant poisoning realybė
ir kas REALIAI naudinga augintinio savininkui. Mandatas: skirti naudinga nuo pritempto
negailestingai; jokio veterinarinio patarimo (tik info + kontaktai)._

---

## TL;DR (vienu sakiniu)

**Vienintelis dalykas, kurį privalai padaryti gerai — pet-specifinis toksiškumo rodymas su
RŪŠIES diferenciacija (katė ≠ šuo ≠ paukštis), nes čia esamas ASPCA datasetas yra stiprus
ir niekas to nedaro household-aware būdu.** Visa kita — antraeiliai sluoksniai ant šito.
Avarinis flow — verta, BET tik kaip „rodyklė į telefoną", ne kaip diagnostikos vedlys
(liability + LT realybė: pet poison hotline'o Lietuvoje NĖRA).

---

## 0. Realybės kalibracija (kodėl rūšies diferenciacija = ašis, ne gimmick)

Toksiškumas tarp rūšių skiriasi ne laipsniu — **kategorija keičiasi**. Trys faktai, kurie
vieni pateisina visą feature:

- **Lelijos (Lilium / Hemerocallis): KATĖMS mirtinos, ŠUNIMS — beveik nekenksmingos.**
  Katei mirtinas net žiedadulkių laižymas nuo kailio ar vandens iš vazos gurkšnis;
  ūminis inkstų nepakankamumas per 36–72 val., dažnai negrįžtamas jei gydymas vėluoja
  >18 val. Šuniui ta pati lelija — daugiausia GI sutrikimas. **Tas pats augalas, du
  radikaliai skirtingi verdiktai.** (ASPCA, FDA, UC Davis VetMed.)
- **Avokadas (persinas): PAUKŠČIAMS gali būti mirtinas, ŠUNIUI — kąsnis guacamole be
  pasekmių.** Cockatiel'ą tas pats kiekis nužudo. (VCA, U. of Illinois VetMed.)
- **Dieffenbachia / Philodendron / Pothos (netirpūs Ca-oksalatai): pati DAŽNIAUSIA
  kambarinė ekspozicija — ir beveik NIEKADA mirtina.** Deginimas burnoje, seilėtekis,
  praeina savaime. Reta kvėpavimo takų edema. **Čia svarbiausia NEpanikuoti** —
  app, kuris šitą rodo „raudonai PAVOJINGA", yra fear-marketing ir blogesnis už nieką.

Išvada: be rūšies diferenciacijos toksiškumo signalas yra arba bevertis, arba žalingas.
Su ja — tai genuinai naudingas, mažai kur egzistuojantis sluoksnis.

---

## 1. Feature lentelė (veterinaro lęšis)

| Funkcija | Reali problema, kurią sprendžia | Naudinga↔Pritempta (1–5; 5=naudinga) | Build kaina (ant esamų assets) | VERDIKTAS + kodėl |
|---|---|---|---|---|
| **Pet-specifinis toksiškumo rodymas (katė/šuo/paukštis tabai ar ikona)** | „Mano lelija — ar pavojinga? Priklauso nuo to ar turiu katę ar šunį." Lelijos/avokado tipo katastrofiškas rūšies skirtumas | **5** | **Pigu–vidut** — `savebes`/deriveToxicity jau turi `target` (žmogus/gyvūnas); reikia išskaidyti target į cat/dog ir žemėlapio | **STATYTI.** Ašinis. ASPCA datasetas tam tik ir tinka (jis pats rūšies-skaidytas: cat/dog/horse). Esama vienoda „toksiška gyvūnams" eilutė MORALIAI klaidina. |
| **Namų pet profilis (katė/šuo/paukštis/graužikas)** | Pfiltruoja toksiškumo rodymą į MANO gyvūnus; kolekcijos saugumo balas | **5** | **Pigu** — 1 onboardingo klausimas + boolean'ai profily | **STATYTI.** Be jo pet-toksiškumas — bendras triukšmas. Su juo — personalu. |
| **„Lelija + katė" katastrofos vėliava (highest-severity flag)** | Tas 5% atvejų, kur klysti = negyvas augintinis. Lelija, sago palmė, oleandras katėms/šunims | **5** | **Pigu** — whitelist'as ~10–15 genčių su „lethal" žyme datasete | **STATYTI.** Pati didžiausia reali nauda visame feature. Aiškiai atskirti „mirtina" nuo „nemalonu". |
| **Avarinis flow „gyvūnas apgraužė — kas dabar?"** | Panikos momentas 2 nakvį; reikia per 30 sek: ar į vet'ą lekiam ar stebim | **4** | **Vidut** — naujas screen'as; jungia rūšį × pet tipą × esamus kontaktus | **STATYTI (apribota).** Verta, BET tik info + „štai kur skambinti", JOKIO triage „palaukit namie". LT specifika žemiau (P3). |
| **Niša: paukščiai / graužikai** | Visi daro cat/dog; paukščiams persinas/Teflonas/avokadas kritiškesni, niekas neaptarnauja | **4** | **Vidut** — ASPCA paukščių duomenys plonesni; reikia papildyti VCA/avian šaltiniais | **GAL → STATYTI v2.** Reali neaptarnauta niša, bet duomenų bazė plonesnė nei cat/dog — nedaryk pažadų, kurių datasetas nepadengia. |
| **Pirkimo guard'as „nesuderinama su tave kate" + safe alternatyva** | Prevencija prieš įsigijimą; katalogas turi alternatyvų paiešką | **4** | **Vidut** — jungia paiešką/skeną × pet profilį × katalogą | **GAL.** Genuinai naudinga (prevencija > avarija), bet vertė priklauso nuo to ar žmogus skenuoja PRIEŠ pirkdamas (elgsenos prielaida). |
| **Plant-sitter / auklės saugumo kortelė (pet vaizdas)** | Prižiūrėtojas nežino, kad jūsų lelija mirtina jūsų katei | **4** | **Pigu** — sharing JAU veikia; pridėti pet-pavojų lapą | **STATYTI.** Mažas build, tikras momentas (svetimas žmogus + jūsų gyvūnai + jūsų augalai). |
| **Sezoninis push (Velykos+lelijos katėms, Kalėdos)** | Velykų lelijų apsinuodijimo pikas katėms realus ir kasmetinis | **3** | **Pigu** — sąlyga: namuose katė + sezonas | **GAL.** Naudinga JEI namuose katė + lelijinis. Be tikslaus targeting'o — virsta spamu/fear-push'u. Tik conditional. |
| **Toksiškumo „dozės/kiekio" skaičiuoklė (kiek g mirtina X kg katei)** | Atrodo moksliška | **1** | Brangu | **ŽUDYTI.** Tai veterinarinė diagnozė = liability bomba. Daugumai augalų LD50 nežinomas (lelijų toksinas net NEIDENTIFIKUOTAS). Melagingas tikslumas. |
| **Simptomų vedlys „pažymėk ką matai → ar pavojinga"** | Skamba kaip pagalba panikoje | **2** | Vidut | **ŽUDYTI.** Tai triage = veterinarinis sprendimas. „Stebėk namie" patarimas, kuris pavėluoja katę su lelija = teisinė ir etinė katastrofa. Vietoj to: „skambink dabar". |

---

## 2. Ko NIEKAS nedaro, bet realiai naudinga (veterinaro lęšis)

1. **Rūšies diferencijuotas verdiktas viename ekrane.** PictureThis/PlantNet sako „toxic to
   pets" — viena pilka eilutė. Realybė: lelija = katei mirtina / šuniui GI; avokadas = paukščiui
   mirtinas / šuniui niekis. **Niekas nerodo „TAVO katei: MIRTINA / TAVO šuniui: lengvas
   sutrikimas" greta.** ASPCA datasetas pats yra rūšies-skaidytas — assetas TAM IR sukurtas,
   tik nepanaudotas. Tai didžiausia neišnaudota nauda.

2. „Dažniausia ≠ pavojingiausia" kalibracija. Dažniausios ekspozicijos (Araceae —
   dieffenbachia/philodendron/pothos) yra **lengvos** (Ca-oksalatai, praeina savaime).
   Mirtinos (lelijos katėms, sago palmė, oleandras) yra retesnės. Naudingas app
   **mažina paniką dažniems atvejams ir kelia vėliavą retiems mirtiniems** — priešingai
   nei fear-marketing, kuris viską daro raudona. Tai pasitikėjimą kuriantis elgesys.

3. **Avariniame momente — viena teisinga rodyklė į LT realybę.** Lietuvoje NĖRA pet poison
   hotline'o (ASPCA 888-426-4435 / Pet Poison Helpline 855-764-7661 yra JAV, mokami, anglų k.).
   Apsinuodijimų kontrolės ir informacijos biuras (nuo 2002) — ŽMONIŲ. Realus atsakymas
   augintinio savininkui = artimiausia 24/7 vet klinika (LSMU dr. L. Kriaučeliūno smulkiųjų
   gyvūnų klinika; DR.VET skubi pagalba). **Niekas augalų app'e nerodo lokalaus 24/7 vet
   kontakto.** Tai konkreti, sąžininga, nemedicininė vertė.

4. Nepanikinanti „NEsukelk vėmimo pats" žinutė. Universalus vet konsensusas: neinduokuok
   vėmimo namie be nurodymo (kai kuriems toksinams kenkia). Tai INFO, ne patarimas —
   saugiai rodoma ir realiai apsaugo augintinį.

---

## 3. Ką EKSPLICITIŠKAI NEdaryti (liability / fear / pritempta)

- **P1 — Jokio triage / „stebėk namie ar važiuok" sprendimo.** Tai veterinarinis sprendimas.
  Katė + lelija atveju „stebėk" = mirtis per inkstų nepakankamumą. App, kuris pasako laukti,
  prisiima atsakomybę už negyvą augintinį. Rodyklė visada viena kryptimi: „skambink vet /
  važiuok DABAR jei abejoji."
- **P2 — Jokios dozės/kiekio/„kiek gramų mirtina" skaičiuoklės.** Melagingas tikslumas;
  daugeliui toksinų LD50 nežinomas; lelijų toksinas net neidentifikuotas. Liability + netiesa.
- **P3 — Jokio simptomų-diagnostikos vedlio.** „Pažymėk simptomus → diagnozė" = veterinarinė
  praktika be licencijos. Maks. leistina: „simptomai, kuriuos GALI matyti" kaip statinė INFO
  + „jei matai bet kurį — skambink."
- **P4 — Jokio „raudona viskam" fear-rodymo.** Dieffenbachia ≠ lelija. Jei dažniausios
  lengvos ekspozicijos rodomos kaip „PAVOJUS", prarandi pasitikėjimą ir tampi spam'u.
  Severity gradacija privaloma, kitaip feature kenkia.
- **P5 — Jokių JAV hotline'ų kaip pagrindinio CTA Lietuvos vartotojui.** ASPCA/PPH yra JAV,
  mokami, anglų k. Rodyti kaip „papildoma", bet pirmas kontaktas = lokali 24/7 vet klinika.
  Kitaip siūlai pagalbą, kuri panikos momentu neveikia.

---

## 4. Konkretus scenarijus (kad būtų aišku, kas „auksas")

> 23:40, savininkas randa kelias nugraužtas lelijos žiedadulkes ant katino snukio.
> Atidaro LapasID → augalas „Lelija" → namų profily yra **katė** → ekranas iškart raudona
> vėliava: **„MIRTINA katėms — net žiedadulkės. Veikti per valandas, ne dienas."**
> Po juo: **„NElauk simptomų. NEsukelk vėmimo pats. Skambink 24/7 vet klinikai DABAR:"**
> [LSMU SGK / DR.VET kontaktas su mygtuku skambinti]. JOKIO „palaukit", JOKIO „pažymėk
> simptomus", JOKIO „suskaičiuok gramus". 30 sek → teisinga kryptis. Tai viskas, ko reikia.

Tas pats scenarijus su **šunimi** (ne kate) → kita žinutė: „Šunims lelijos — daugiausia
skrandžio sutrikimas; stebėk, skambink vet jei vemia/atsisako ėdalo." **Tas pats augalas,
profilis nulemia teisingą atsaką.** Štai kodėl rūšies diferenciacija = visa esmė.

---

## 5. Šaltiniai (web research)

- ASPCA — Top 10 Toxic Plants for Pets / Top 10 Toxins 2025:
  https://www.aspca.org/news/top-10-toxic-plants-pets-what-look-out ;
  https://www.aspca.org/news/top-10-toxins-2025
- ASPCA — Dangers of Easter Lilies (katėms): https://www.aspca.org/news/getting-bottom-dangers-easter-lilies
- FDA — Lovely Lilies and Curious Cats: https://www.fda.gov/animal-veterinary/animal-health-literacy/lovely-lilies-and-curious-cats-dangerous-combination
- UC Davis VetMed — Lily Toxicity in Cats (36–72 val. langas): https://healthtopics.vetmed.ucdavis.edu/health-topics/feline/lily-toxicity-cats
- VCA — Plants Toxic to Birds; U. of Illinois VetMed — avokado/persino toksiškumas paukščiams:
  https://vcahospitals.com/know-your-pet/plants---toxic-for-birds ;
  https://vetmed.illinois.edu/pet-health-columns/bird-toxins-teflon-avocado-lead-zinc/
- Pet Poison Helpline — Sago Palm (šunims, kepenų nepakankamumas): https://www.petpoisonhelpline.com/poison/sago-palm/
- Pet Poison Helpline / ASPCA — netirpūs oksalatai (dieffenbachia/pothos — lengvi):
  https://www.petpoisonhelpline.com/poison/insoluble-oxalates/ ;
  https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/dieffenbachia
- Merck Veterinary Manual — Houseplants and Ornamentals Toxic to Animals:
  https://www.merckvetmanual.com/toxicology/poisonous-plants/houseplants-and-ornamentals-toxic-to-animals
- „NEsukelk vėmimo pats" konsensusas (PetMD/AKC): https://www.petmd.com/dog/poisons/plants-poisonous-to-dogs
- LT kontekstas (NĖRA pet hotline'o; 24/7 vet realybė): https://sgk.lsmuni.lt/ ; https://drvet.lt/paslaugos/skubi-veterinarine-pagalba/ ;
  https://www.vetcentras.lt/sunu-ir-kaciu-apsinuodijimai/apsinuodijimas-augalais
