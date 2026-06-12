# 45 — Liability + sąžiningumo RED TEAM (saugumo feature)

_Lęšis: žudyti pritemptas/pavojingas funkcijas. Klausimas kiekvienai idėjai: ar pritempta? ar
liability? ar fear-marketing? Founder'is: „ne pritemptas — kas verta ir kas ne." Aš einu prieš
optimizmą._

---

## 0. Pamatinis teisinis kadras (taikau visoms idėjoms)

**Trys raudonosios linijos, kurias radau research'e:**

1. **„Informacija" vs „patarimas" yra teisiškai realus skirtumas, bet disclaimer'is NEišgelbsti
   nuo neatsargumo.** Medicininis disclaimer'is „neatstoja gydytojo" negali atmesti atsakomybės už
   neatsargumą, sukėlusį žalą (usercentrics). Webpoisoncontrol — geriausias precedentas: jie atvirai
   sako „nėra prižiūrima gydytojo", „nesukuriamas paciento–gydytojo ryšys", „jokios diagnozės ar
   paciento-specifinės krypties", liability lubos $1000, IR PRIVERSTINAI nukreipia „jei žmogus
   prarado sąmonę, traukuliai, sunku kvėpuoti — skambink 911". Jie gali sau leisti triage TIK todėl,
   kad už jų stovi licencijuoti toksikologijos specialistai realiu laiku. **Mes neturim šito. Tad
   negalim daryt to, ką daro jie.**

2. **Simptomų → „ar/kada pas vet" srautas = potencialus MEDICINOS PRIETAISAS pagal ES MDR Rule 11.**
   „Software, kuris teikia informaciją sprendimui su diagnostiniu ar terapiniu tikslu" = Class IIa;
   o jei klaidingas sprendimas gali sukelti **rimtą ar negrįžtamą sveikatos pablogėjimą — Class IIb/III**.
   Apsinuodijęs vaikas/gyvūnas, kuriam pavėluota dėl mūsų „palauk, stebėk" = būtent negrįžtamos žalos
   scenarijus. Plius AI-pagrįsti medicinos prietaisai = **high-risk pagal ES AI Act** (įsigaliojo 2024).
   CE žymėjimas, IEC 62304, PSUR kas 2 m. — solo bootstrap'ui tai mirties bausmė. **Bet kuris srautas,
   kuris paima simptomus ir grąžina rekomendaciją „skambinti / nesijaudinti / palaukti" — peržengia
   linija.** Tai NE feature klausimas, tai NE-DARYK klausimas.

3. **False reassurance (klaidingas „viskas gerai") yra PAVOJINGESNIS nei nieko nesakyti — ir tai
   atskiras liability pagrindas** (negligent misrepresentation / failure-to-warn: kai produktas
   sukuria „false sense of security"). „Namų saugumo balas 92/100" arba „ši zona saugi" yra tiksliai
   tokia klaidinanti garantija: duomenys nepilni (turim ~99 katalogo įrašų su hero, ASPCA 1023, daug
   rūšių BE toksiškumo duomenų → „nėra duomenų" vizualiai virsta „saugu"). Tėvas pamato žalią balą ir
   nustoja budėti. **Skaičius, kuris gali pasakyt „saugu", kai nėra — tai didžiausia mūsų liability.**

---

## 1. Feature lentelė (red-team verdiktai)

| # | Funkcija | Reali problema | Naud↔pritempta | Liability | VERDIKTAS + kodėl |
|---|---|---|---|---|---|
| 5 | **Avarinis srautas: foto→rūšis→sunkumas→simptomai→kada vet** | „Vaikas įsidėjo lapą, ar skambint" | idėja 5, vykdymas tox | **EKSTREMALI** — MDR Rule 11 prietaisas + AI Act high-risk; simptomų triage be licencijuotų specialistų | **ŽUDYTI srauto „simptomai→sprendimas" dalį.** STATYTI tik „static fact + kontaktai" versiją (žr. žemiau). Simptomų rinkimas + verdiktas = neperžengiama linija. |
| 1 | **Namų saugumo BALAS (92/100)** | „Kiek mano namai saugūs" | 2 (skamba gerai, klaidina) | **AUKŠTA** — false reassurance; nepilni duomenys virsta „saugu" | **ŽUDYTI balą.** GAL: rodyti rizikų SĄRAŠĄ be agreguoto skaičiaus. Sąrašas negali meluoti „saugu"; balas gali. |
| 1b | Namų profilis (vaikas/katė/šuo) → personalizacija | Reikšminga rizikos filtravimui | 4 | **VIDUTINĖ-AUKŠTA (GDPR)** — vaiko amžius + namų sudėtis = jautrūs/vaikų duomenys | **GAL, su sąlyga:** laikyti lokaliai/min., NEklausti tikslaus amžiaus (tik „mažas vaikas" boolean), jokio vaiko vardo. Žr. GDPR sk. |
| 2 | **Zonų saugumo semantika** (toks. augalas „vaiko kambary" → konfliktas) | Tikra, veiksminga, pigu | 4 | ŽEMA — tai user'io paties pažymėta būsena, ne mūsų diagnozė | **STATYTI.** Saugiausias iš visų: parodo FAKTĄ („šis toksiškas") × user'io FAKTĄ („čia vaiko zona"). Nedaro medicininės prognozės. |
| 3 | Išdėstymo rekom. (aukštis, nuokritos) | Praktiška | 3 | ŽEMA, jei formuluojama kaip bendras info | **STATYTI atsargiai.** Formuluot „augalas toksiškas — daug žmonių laiko nepasiekiamoj vietoj", NE „pastatyk čia ir būsi saugus" (antra = garantija). |
| 4 | **Pirkimo guard'as + saugios alternatyvos** | „Prieš pirkdamas sužinok" | 4 | ŽEMA — faktinė info pirkimo momentu, ne sprendimas dėl žalos | **STATYTI.** Stipriausias verslo kabliukas su mažiausia liability: faktas+alternatyva, ne diagnozė. „Nesuderinama" → „toksiška katėms, štai panašios netoksiškos". |
| 6 | Svečio/auklės saugumo kortelė | Realus scenarijus (plant-sitter yra) | 4 | ŽEMA-VIDUT. — rodom faktus + kontaktus, ne nurodymus | **STATYTI**, BET kortelė = faktų lapas + 112/Apsinuodijimų centras, NE „ką daryti jei". |
| 7 | Gyvenimo įvykio auditas („atsirado kūdikis → perskanuok") | Re-engagement | 2-3 | **VIDUT.-AUKŠTA — fear-marketing rizika** + nėštumo/kūdikio duomenys (jautru) | **GAL.** Linija: pasyvi priminimas-funkcija OK; push „tavo namai pavojingi kūdikiui!" = baimės pardavimas → NE. |
| 8 | Sezoniniai įspėjimai (Velykos+lelijos katėms) | Tikras, vertingas (lelijos katėms mirtinos — faktas) | 4 | ŽEMA, jei faktas+kontaktas; AUKŠTA, jei „skubėk pirkti Pro" | **STATYTI faktą.** „Lelijos mirtinos katėms" = tvirtas faktas. ŽUDYTI bet kokį „pavojus! atsinaujink dabar" rištą prie sezono baimės. |
| 9 | Priežiūra × darbų sauga (Euphorbia genėjimas → pirštinės) | Niša, niekas nedaro | 3 | ŽEMA — bendro pobūdžio sauga, ne medicina | **GAL/STATYTI.** Žemos rizikos; bet „pirštinės genint" yra arti pritemptos „nice-to-have". |
| 10 | Paukščiai/graužikai niša | Neaptarnauta, paukščiams kritiška | 3 | **VIDUT. — duomenų rizika.** Mūsų tox duomenys (ASPCA) = cat/dog/horse; paukščiams duomenų BEVEIK nėra | **GAL, atsargiai.** Negalim teigt „saugu paukščiams" be duomenų — tik „nėra duomenų" sąžiningai. Kitaip false reassurance ant labiausiai pažeidžiamo gyvūno. |

---

## 2. Ko NIEKAS nedaro, bet realiai naudinga (iš liability lęšio)

**A. „Sąžiningas nežinojimas" kaip feature — `NĖRA DUOMENŲ ≠ SAUGU`.**
Visi simptomų checker'iai ir PictureThis tylom traktuoja „nerasta" kaip „nieko baisaus". Tai būtent
false-reassurance spąstai. Mūsų konkurencinis IR liability-mažinantis ėjimas: **eksplicitiškai rodyti
„toksiškumo duomenų šiai rūšiai NETURIM — elkis atsargiai"** vietoj žalio „saugu". Tai vienu metu (a)
sąžininga, (b) teisiškai gina (nėra klaidinančios garantijos), (c) niekas to nedaro, nes visi nori
rodyt žalią. Mūsų duomenų realybė (daug rūšių be tox duomenų) šito REIKALAUJA bet kokiam balui — tad
paverskim dorybe.

**B. Statiškas „kas dabar" lapas BE simptomų rinkimo.**
Webpoisoncontrol gali daryt triage, nes turi gyvus toksikologus. Mes — ne. Bet teisėtai galim parodyti
**iš anksto paruoštą, ne paciento-specifinį** info lapą rūšiai: „Šis augalas toksiškas. NESIRINK
sprendimo pats. Apsinuodijimų kontrolės biuras (Lietuva: +370 5 236 2052, 24/7), veterinarijos
skubi pagalba, vaikams — 112. Pasiimk augalo nuotrauką." Tai informacija + kontaktai (sąžiningumo riba
iš briefingo), NE simptomų vertinimas, NE „palauk/skambink" sprendimas → ne MDR prietaisas. **Tai TIKRASIS
#5 idėjos saugus branduolys** — vertė išlieka (30 sek tėvui), liability dingsta.

**C. Pasidalinimo audit log saugumo kortelei.**
Auklės kortelė tampa liability-gynyba, jei loginam „kortelė sugeneruota X, peržiūrėta Y" — ne dėl
analitikos, o dėl „mes parodėm info, kontaktai buvo matomi". Niekas to nedaro produkto pusėje.

---

## 3. Ką EKSPLICITIŠKAI NEDARYTI (vardiniai draudimai)

1. **NEDARYTI simptomų rinkimo + verdikto srauto.** Jokio „pažymėk simptomus → mes pasakom skambint ar
   palaukt". Tai ES MDR Rule 11 medicinos prietaisas (Class IIb/III, nes klaida = negrįžtama žala) +
   AI Act high-risk. Solo bootstrap'ui = neįmanoma legaliai. **Tai #1 mirties feature.**

2. **NEDARYTI agreguoto „namų saugumo balo" su žaliu/„saugu" reikšme.** False reassurance =
   negligent-misrepresentation liability + etiškai pavojingiau nei nieko. Rodyk rizikų sąrašą, ne balą.

3. **NETEIGTI „saugu" / „suderinama" niekur, kur neturim duomenų.** „Nerasta toksiškumo" ≠ „saugu".
   Visada „nėra duomenų — atsargiai". Ypač paukščiai/graužikai (idėja #10) — ten duomenų beveik nulis,
   o klaidingas „saugu" ant labiausiai pažeidžiamo gyvūno = blogiausias scenarijus.

4. **JOKIO veterinarinio/medicininio PATARIMO ar diagnozės** — net „tikriausiai nepavojinga, stebėk".
   „Stebėk namuose" YRA terapinis sprendimas. Tik faktas + kontaktai + „kreipkis į specialistą".

5. **NEDARYTI fear-marketing'o aplink gyvenimo įvykius/sezonus.** „Tavo namai PAVOJINGI kūdikiui —
   atsinaujink dabar" = baimės pardavimas, kurį founder'is atmetė. Push'as gali nešt FAKTĄ („Velykų
   lelijos mirtinos katėms"), niekada baimę-pirkti. Saugumo žinia neužrakinama už paywall (sutampa su
   strategine išvada 40-doc).

6. **NEKLAUSTI tikslaus vaiko amžiaus/vardo/gimimo datos.** GDPR: vaikų duomenys = padidinta apsauga,
   ES default sutikimo amžius 16 (LT — tikrint), baudos iki 4% apyvartos. Namų profilis tegul būna
   minimalūs boolean'ai („yra mažas vaikas", „yra katė") lokaliai, ne identifikuojantys vaiką duomenys.
   Namų sudėtis + nėštumas (idėja #7) = jautru → neperduot trečioms šalims, nesusiet su reklama.

7. **NEPAVERSTI toksiškumo dial'o/balo marketingo „wow" elementu.** Toxicity Dial (assets: koncepcija)
   kaip vizualus rizikos matuoklis tempia toksiškumą į dramatišką UI, kur tikslumas svarbesnis nei
   efektingumas. Jei rodom skaičių/ciferblatą — jis privalo niekada neteigti „saugu" be pilnų duomenų.

---

## 4. Šaltiniai

- Medical disclaimers / negali atmesti neatsargumo: https://usercentrics.com/guides/website-disclaimers/medical-disclaimers/
- webPOISONCONTROL Terms (info-not-advice, $1000 lubos, priverstinis 911): https://www.poison.org/terms-of-use-triage
- Healthcare app liability / safety-net warnings: https://www.lexology.com/library/detail.aspx?g=57ea57b3-86be-474a-9220-81623c7ff3dc
- ES MDR Rule 11 SaMD klasifikacija (IIa/IIb/III): https://trustedtracemed.com/resources/eu-mdr-rule-11-samd-classification.html
- Symptom checker = medical device + AI Act high-risk: https://www.visibagroup.co.uk/guide/ai-triage-devices
- Triage software MDR sertifikacija (Class IIa precedentas): https://platform24.com/blog/blog24/platform24s-triaging-software-achieves-eu-mdr-certification/
- Failure-to-warn / false sense of security (negligent misrepresentation): https://www.justia.com/products-liability/types-of-products-liability-claims/failure-to-warn/
- GDPR vaikų duomenys / sutikimas / Art. 8: https://gdpr-info.eu/art-8-gdpr/
- ES Product Liability Directive (atnaujinta vartotojų apsauga): https://www.ecclesia.com/en/newsroom/detail/verbesserter-verbraucherschutz-die-eu-produkthaftungsrichtlinie
