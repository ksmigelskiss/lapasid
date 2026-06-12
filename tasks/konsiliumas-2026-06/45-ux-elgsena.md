# 45 — Saugumo feature konsiliumas: UX / elgsenos lęšis

_Specialistas: UX / behavioral product. Klausimas: kurias saugumo funkcijas žmonės REALIAI naudotų vs ignoruotų, ir kur saugumas = vertė vs nerimas/fatigue. Vertinta per esamus assets (zonos, savybes/deriveToxicity, plant-sitter sharing, katalogas). Data 2026-06-12._

---

## TL;DR (elgsenos verdiktas prieš lentelę)

Trys negailestingos elgsenos tiesos, kurios rūšiuoja founder'io 10 idėjų:

1. **„Law of attrition" — vienkartinė setup f-ja naudojama vieną kartą, recurring f-ja DŪLA.** Safety-app tyrimai (Make Safe Happen RCT, parenting apps): engagement pikas pirmom savaitėm, paskui kritimas iki ~0. Vadinasi vertę reikia paimti **per pirmą sesiją** (setup momentu), ne tikėtis grįžimo.
2. **Avariniu momentu žmogus NEatidaro tavo augalų app'o — jis google'ina arba skambina.** „My cat ate a lily" — Pet Poison Helpline gauna dešimtis tokių skambučių kasdien. Tavo emergency flow konkuruoja su Google paieška ir telefono skambučiu, NE su PictureThis. Tai keičia, ką tas flow turi būti.
3. **Per daug įspėjimų = alert fatigue → ignoruojami IR kritiniai.** Yuka pamoka: moralizuojantis „bad/good" tonas atstūmė dalį userių (autonomijos praradimas). Saugumas, paverstas nuolatiniu push'u, desensitizuoja ir augina nerimą, ne pasitikėjimą.

**Auksinė gysla, kurią visi praleidžia:** ne emergency (perpildyta, liability), o **tylus, vienkartinis, ne-judinantis „ar mano namai OK?" patikrinimas setup momentu + delegacijos momentas (auklė/plant-sitter), kai info perduodama žmogui, kuris namų NEpažįsta.** Štai kur saugumas = grynas palengvėjimas be nerimo.

---

## 1. Feature lentelė (UX/elgsenos vertinimas)

Skalė: naudinga↔pritempta 1–5 (5 = giliai naudinga, 1 = pritempta). „Naud." = realaus naudojimo tikimybė iš elgsenos.

| # | Funkcija | Kokią REALIĄ problemą sprendžia (elgsenos scenarijus) | Naud. (1-5) | Build | VERDIKTAS |
|---|---|---|---|---|---|
| 1 | **Namų profilis** (3 klausimai: vaikai/amžius, katė/šuo/paukštis) | Vienkartinis. Atrakina visą personalizaciją. KRITIŠKA: ≤3 klausimai, NE 5+ (FICO: 1/5 userių mestų ties 5 klausimais). Turi būti SKIP'inamas ir grįžtamas. | 5 | Pigu (3 toggle) | **STATYTI** — pamatas viskam, bet tik jei friction ≤3 ir skip'inamas |
| 2 | **Kolekcijos saugumo balas + 3 rizikos** | Setup payoff: „Tavo 14 augalų, su kate — 2 pavojingi: X, Y." Vienkartinis „aha", retą peržiūrimas. Vertė per PIRMĄ sesiją (attrition). | 4 | Pigu (derive iš savybes × profilis) | **STATYTI** — bet pozicionuok kaip vienkartinį insight, ne dashboard'ą, kurį tikiesi atidaryt kas savaitę |
| 3 | **Zonų saugumo semantika** (zona = „vaiko kambarys" → konfliktas) | „Šitas augalas vaiko kambary, o jis toksiškas." Konkreti, veiksminga rizika su VIETA. Zonos jau yra. Vienkartinis priskyrimo momentas. | 4 | Pigu (tipo laukas + check) | **STATYTI** — unikalu (niekas household+vieta nedaro), bet tik kaip pasyvus ženkliukas priskiriant, ne push |
| 6 | **Auklės / plant-sitter saugumo kortelė** | DELEGACIJOS momentas: žmogus, kuris namų NEpažįsta, lieka su vaiku/šunim. „Šitie 3 augalai — neleisk vaikui kramtyt." Sharing JAU veikia. Aiškus trigeris, reali vertė, NULIS nerimo (praktiška). | 5 | Pigu (sluoksnis ant esamo share) | **STATYTI** — geriausias value/build santykis; čia saugumas = palengvėjimas, ne baimė |
| 4 | **Pirkimo guard'as** (paieška/skenas → „nesuderinama su tave kate" + saugios alternatyvos) | Sprendimo momentas PRIEŠ pirkimą. Aukštos intencijos, bet RETAS (perki augalą kelis k./metus). Alternatyvos = pozityvus tonas (ne „ne", o „štai panašus saugus"). | 3 | Vidut. (katalogo similarity) | **GAL** — vertinga TIK kaip pozityvus „štai saugi alternatyva", ne blokatorius; reta naudojimo dažnis |
| 9 | **Priežiūra × sauga** („Euphorbia genėjimas → pirštinės") | Įkomponuojama į EGZISTUOJANTĮ care flow (ne nauja vieta, kurią pamiršti). Recurring, bet ride'ina ant care, kurį user jau daro. Maža, bet niekas nedaro. | 3 | Pigu (laukas care intervals) | **GAL** — pigu, įsilieja į esamą srautą be naujo dėmesio; nice-to-have ne core |
| 5 | **Avarinis flow** („katė apgraužė — kas dabar?") | Tikras panikos momentas. BET: žmogus google'ina/skambina, neatidaro tavo app'o. Liability didžiausias. Poison Control: net jų app'as „ne emergencijoms — pirma skambink 911". | 2 | Brangu (foto→rūšis→logika→disclaimer) | **ŽUDYTI kaip „flow"; PALIK kaip statinė kortelė** — žr. žemiau, perdarom į ne-interaktyvią |
| 7 | **Gyvenimo įvykio auditas** („atsirado kūdikis → perskanuok") | Re-engagement kabliukas. BET reikalauja, kad user grįžtų ir praneštų apie įvykį — attrition sako neateis. Marketingo gysla tikra (besilaukiančių grupės), bet f-ja pati pasyvi. | 2 | Vidut. | **ŽUDYTI kaip in-app f-ja; laikyk kaip marketingo/akvizicijos kanalą** (ne produkto feature) |
| 8 | **Sezoniniai įspėjimai** (Velykos+lelijos, Kalėdos+puansetija) | Push pagal namų derinį. Reali rizika (lelijos katėms mirtinos). BET: čia gimsta alert fatigue ir fear-marketing. 2 push/metus = OK; daugiau = desensitizacija. | 2 | Vidut. (cron + segment) | **GAL, bet GRIEŽTAI ribotai** — max 2-3/metus, tik MIRTINI deriniai, opt-in; kitaip = baimės spamas |
| 10 | **Paukščiai/graužikai niša** | Neaptarnauta (visi daro cat/dog). Paukščiams kritiškiau (Teflon/avokadas). Maža auditorija LT. | 3 | Pigu (dar vienas profilio toggle) | **GAL** — pigu pridėti į profilį (#1), bet nedaryk atskiro feature; tik dar viena profilio parinktis |

---

## 2. Ko NIEKAS nedaro, bet realiai naudinga (mano lęšis)

### A. „Setup-momento saugumo insight", NE dashboard'as
Visi safety app'ai miršta nuo attrition (Make Safe Happen RCT, parenting apps: engagement → ~0 po pirmų savaičių). **Išvada:** nedaryk „saugumo dashboard'o", kurį tikiesi, kad atidarys kas savaitę — neatidarys. Vietoj to **paimk visą vertę per pirmą sesiją:** namų profilis (3 klausimai) → IŠKART „tavo kolekcija + kate: 2 pavojingi, štai jie." Vienas momentas, vienas „aha", uždaryta. Tai pozityvi attrition'o pasekmė: nereikia kovoti dėl grįžimo, jei vertė atiduota iškart.

### B. Delegacijos kortelė = nedotuotas use-case
Plant-sitter/auklės momentas yra **vienintelis, kur saugumo info turi natūralų, pasikartojantį, NE-nerimą-keliantį trigerį:** kažkas svetimas lieka tavo namuose. PictureThis/Planta to NEDARO — jie individualaus user'io app'ai. Tu JAU turi sharing infrastruktūrą. Tai realiausias diferenciatorius su mažiausiu build'u. Scenarijus: „Išvažiuoju 3 dienom, auklė su 2-mečiu. Spaudžiu share → auklė mato kortelę: 'Šitie 3 augalai — vaikui nekramtyt, jei kažkas — Apsinuodijimų centras 8 5 236 2052.'" Nulis nerimo, grynas praktiškumas.

### C. Statinė „apsinuodijimų kontaktų" kortelė vietoj interaktyvaus emergency flow
Avariniu momentu žmogus NEnaršys tavo decision-tree (foto→rūšis→simptomai). Jis google'ina arba skambina. webPOISONCONTROL pati sako: „ne emergencijoms — pirma 911." **Ką realiai naudinga:** kiekvieno toksiško augalo kortelėje, RAMIU momentu, matomas blokas: „Jei suvalgyta: [LT Apsinuodijimų centras] [ASPCA pet line]" + 1 eilutė „ką daryti pirma" (pašalink likučius, neskink vėmimo). Nulis interaktyvumo = nulis liability iš „algoritmas pasakė lauk". Tai info+kontaktai, kaip mandatas reikalauja — ne flow, ne diagnozė.

### D. Pozityvus framing'as visur (anti-Yuka pamoka)
Yuka prarado userius dėl moralizuojančio „bad/good" ir „autonomijos praradimo" jausmo. **Saugumo info turi būti pateikta kaip galios suteikimas, ne kaip kaltinimas/baimė.** Ne „PAVOJUS! Toksiška!", o „Su kate verta žinoti: laikyk aukščiau / štai panašus saugus augalas." Pirkimo guard'as ypač — VISADA su saugia alternatyva (pozityvi išeitis), niekada vien „ne".

---

## 3. Ką EKSPLICITIŠKAI NEdaryti (pritemptos / liability / fear-marketing)

1. **NE interaktyvus simptomų/sunkumo „flow"** (#5 kaip aprašyta). „Įvesk simptomus → pasakysim ar pavojinga" = veterinarinė diagnozė = liability + mandato pažeidimas. Žmogus vis tiek skambins. Pakeisk statine kontaktų kortele (žr. 2C).
2. **NE pasikartojantis saugumo push** (daugiau nei 2-3/metus). Alert fatigue tyrimai: per daug įspėjimų → ignoruojami IR kritiniai → desensitizacija + nerimas. Sezoniniai (#8) tik mirtiniems deriniams, opt-in.
3. **NE „saugumo balas", paverstas baimės metrika.** „Tavo namai 34/100 — PAVOJINGI!" = fear-marketing, Yuka klaida. Balas OK tik kaip neutralus „2 dalykai verti dėmesio", su iškart veiksmu. Jokio raudono „pavojingi namai" antdėklo.
4. **NE onboarding su 5+ saugumo klausimais.** FICO: ~1/5 userių mestų ties 5 klausimais; 38% krenta po pirmo ekrano. Namų profilis (#1) MAX 3 klausimai, skip'inamas, grįžtamas iš nustatymų. Niekada neblokuok pirmo augalo pridėjimo už profilio.
5. **NE gyvenimo-įvykio auditas kaip in-app feature** (#7). User negrįš pranešti „gimė vaikas". Tai marketingo/akvizicijos kanalas (turinys besilaukiančių grupėms), ne produkto funkcija — nemaišyk.
6. **NE „nuokritų rizikos" mikro-skaičiavimai** (uogų/lapų kritimas, idėja #3 gilumoje). Skamba kruopščiai, bet niekas realiai nenaudos „statinio aukščio koregavimo dėl krentančių uogų" — over-engineering be naudojimo įrodymo.

---

## 4. Šaltiniai

- Onboarding drop-off (FICO: 5+ klausimų → ~20% meta; 10+ → >50%; 38% krenta po 1 ekrano): https://www.jumio.com/how-to-reduce-customer-abandonment/ ; https://thefinancialbrand.com/news/bank-onboarding/more-than-half-of-customers-abandon-account-opening-how-to-take-back-control-of-the-process-191691
- Safety-app attrition (Make Safe Happen RCT; parenting apps engagement → ~0; push padeda): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6715056/ ; https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8485517/
- Alert fatigue / desensitizacija (per daug įspėjimų → ignoruojami kritiniai; nerimas): https://signoz.io/blog/alert-fatigue/ ; https://psnet.ahrq.gov/primer/alert-fatigue
- Yuka elgsena (autonomijos praradimas, moralizuojantis tonas atstumia; bet 94% grąžina „bad" produktą): https://consumed.substack.com/p/why-i-dont-use-the-yuka-app-when ; https://abbylangernutrition.com/yuka-app-review-scan-or-scam/
- Poison Control app vs skambutis (app „ne emergencijoms"; mediana 2:16; 2M+ vis tiek skambina): https://www.poison.org/articles/webpc ; https://www.advanceer.com/resources/blog/2020/march/should-i-call-poison-control-or-go-to-the-er-/
- Pet panikos paieška („my cat ate a lily" — dešimtys skambučių/dieną; lelijos latentinės 12-24h): https://www.petpoisonhelpline.com/pet-owners/basics/top-10-plants-poisonous-to-pets/ ; https://www.gallant.com/blog/first-2-hours-my-cat-ate-something-poisonous/
