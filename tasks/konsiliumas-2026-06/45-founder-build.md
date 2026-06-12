# Saugumo feature — Founder-build / pragmatiko lęšis (2026-06-12)

_Lęšis: kas PIGU statyti ant esamų assets vs brangu, ir kokia seka. Klausimas ne „ar gražu",
o „kiek realaus solo-darbo vienetų (su AI agentais) tai kainuoja, ir ar verta tos kainos."
Build kainos kalibruotos prieš 03-assets.md tikrąją kodo būseną (ne viziją)._

---

## 0. Build-kainos legenda (ką realiai reiškia)

- **PIGU** = nėra naujo pipeline. UI + jau egzistuojantis duomuo (zonos, savybes/deriveToxicity,
  katalogas, sharing). 0,5–2 dienos solo+agentai.
- **VIDUT** = naujas UI flow + minimaliai naujo turinio/duomenų (pvz. LT veterinarijos kontaktai,
  naujas zonos laukas su migracija). 3–6 dienos.
- **BRANGU** = naujas pipeline / duomenų rinkimas / agregacija per visus users / external dependency.
  >1 sav., dažnai liečia Firebase read'us arba AI kaštus (užrakintos spynos iš 03-assets §6).

**Kritinis founder-realybės faktas (iš 03-assets):** mokėjimų KODE NĖRA (paywall tik UI). Tai
reiškia: bet kuris „Pro monetizacija" verdiktas yra POTENCIALAS, ne pajamos, kol Stripe neprijungtas.
Saugumo feature NEturi laukti mokėjimų — bet neplanuok jo kaip pajamų ramsčio iki paywall'as gyvas.

---

## 1. Feature lentelė (build-cost akcentas)

| # | Funkcija | Reali problema | Naud↔Pritempt (1-5; 5=naud) | Build kaina | Kas JAU yra (% padaryta) | VERDIKTAS |
|---|---|---|---|---|---|---|
| 1 | **Namų profilis** (3 klaus.: vaikai+amžius / katė-šuo-paukštis / lauko vs vidaus) | Be konteksto „toxic" = triukšmas. Profilis = visos personalizacijos jungiklis | 5 | **PIGU** | ~70% (settings UI, user doc, free-tier infra yra; reik 1 doc laukas + onboarding korta) | **STATYTI #1** — pamatas, be jo niekas kita neturi konteksto |
| 2 | **Kolekcijos saugumo ataskaita** (derive iš savybes × profilis: balas + 3 rizikos) | „Kas mano namuose pavojinga MANO katei" — vienu ekranu | 5 | **PIGU** | ~80% (deriveToxicity testuotas+defensible; profilis=#1; tik agregacijos render) | **STATYTI #2** — didžiausia vertė / mažiausias darbas, grynas derive |
| 3 | **Zonų saugumo semantika** (zona += tipas „vaiko kambarys/aukšta lentyna"; konflikto check priskiriant) | „Toksiškas augalas vaiko zonoje" = automatinis flag, ne rankinis budrumas | 5 | **PIGU→VIDUT** (1 enum laukas + check; migracija esamoms zonoms = VIDUT) | ~75% (zonos+priskyrimas veikia; trūksta tipo lauko+check'o) | **STATYTI #3** — unikalu, niekas nedaro; pigu nes zonos jau yra |
| 4 | **Plant-sitter saugumo kortelė** (sharing += „kas pavojinga vaikui/šuniui čia" lapas) | Auklė/svečias nežino tavo namų rizikų; momentas kur info gelbsti | 4 | **PIGU** | ~85% (sharing JAU veikia; viešas pasas /p/{id} yra; tik papildomas read-only blokas) | **STATYTI** (po quick wins) — beveik nemokamas priedas prie veikiančio sharing |
| 5 | **Avarinis flow** („katė apgraužė → kas dabar": rūšis→sunkumas→simptomų checklist→kontaktai) | Lily-cat: 12–18h gydymo langas, minutės skiria gyvybę nuo negrįžtamo inkstų nepak. | 5 | **VIDUT** | ~40% (foto-ID+deriveToxicity severity yra; NAUJA: LT vet kontaktų DB + flow UI) | **GAL→STATYTI** — vertė tikra, BET kaina realesnė nei atrodo (žr. §3 liability) |
| 6 | **Pirkimo guard'as / saugios alternatyvos** (skenas/paieška → „nesuderinama su tavo kate" + panaši-bet-safe rūšis) | Sustabdo riziką PRIEŠ įnešant į namus; alternatyva > draudimas | 4 | **VIDUT** | ~55% (katalogas+paieška+deriveToxicity yra; NAUJA: „panaši išvaizda safe" query — reik vizualaus/kategorinio panašumo, kurio dar nėra) | **GAL** — „nesuderinama" pigu; „saugi alternatyva" reikalauja panašumo grafo (brangiau) |
| 7 | **Gyvenimo įvykio auditas** („kūdikis/šuniukas → perskanuok") | Re-engagement + tikras momentas keisti namus | 3 | **PIGU** (jei #1+#2 yra: tik push trigger) | ~30% iki push infra | **GAL** — pigu TIK ant #1/#2; pati savaime marketingo gysla, ne core vertė |
| 8 | **Sezoniniai įspėjimai** (Velykos+lelijos katėms; Kalėdos+puansetija) | Kasmetinis žinomas rizikos pikas; PR turinys | 3 | **VIDUT** (push infra + turinio kalendorius + namų derinio filtras) | ~20% | **GAL** — geras PR, bet priklauso nuo push infra; ne pirmų 90 d. |
| 9 | **Priežiūra × sauga** („Euphorbia genėjimas → pirštinės") | Darbų sauga, kurią care apps ignoruoja | 3 | **PIGU** (deriveToxicity irritant whitelist JAU yra → care kortelės flag) | ~65% | **GAL** — pigus nice-to-have; įsegti į esamą PlantCareCard, ne atskiras feature |
| 10 | **Niša: paukščiai/graužikai** | Paukščiams kritiškiau (aerozoliai/PTFE), neaptarnauta | 3 | **VIDUT→BRANGU** (atskiras toksiškumo target'as; ASPCA duomenys avian-skurdūs) | ~25% (deriveToxicity target yra žmogus/gyvūnas, ne per-rūšį-gyvūno) | **GAL→vėliau** — niša reali, bet duomenų skurdas daro brangiu; ne dabar |

---

## 2. Ko niekas nedaro, bet realiai naudinga (mano lęšiu — build-pigu kampu)

**A. Household-aware sluoksnis ANT flat toksiškumo.** Verifikuota: PictureThis turi „Toxic Plant
Warning" katėms/šunims/vaikams — bet tai FLAT faktas („this is toxic"), ne „TAU su tavo katė ir
aukšta lentyna". Niekas nedaro konflikto sprendimo (zona × profilis). Tai tiksliai #1+#2+#3 — ir
visi trys yra PIGŪS, nes assets jau yra. **Tai didžiausia arbitražo zona: aukšta vertė × žemas
darbas, nes konkurentas turi faktą bet ne intelektą, o mes turim deriveToxicity+zonas+profilį.**

**B. „Saugi alternatyva" kaip POZITYVUS framing (ne baimė).** Vietoj „pavojinga!" → „štai panaši
į calathea, bet safe katėms." Tai NE fear-marketing (briefing'o riba), o sprendimas. Build-kampu:
PIGI versija = filtruok katalogą pagal kategoriją/išvaizdos tag'us, kuriuos jau turim; BRANGI versija
= tikras vizualus panašumo grafas. Rekomendacija: statyk PIGIĄ (rankiniai „lookalike-safe" mapinimai
populiariausioms 20–30 rūšių, kaip aspca-genus-map kuracija), ne brangų grafą.

**C. Viešo paso saugumo briaunelė.** Viešas pasas /p/{id} JAU veikia. Pridėti vieną „šis augalas:
saugus/nesaugus naminiams" eilutę pase = beveik nemokama, bet tai vienintelė vieta kur NEnaudotojas
(svečias nuskanavęs etiketę) gauna saugumo info. Tai #4 plant-sitter logikos viešas variantas.

---

## 3. Ką EKSPLICITIŠKAI NEdaryti (founder-build perspektyva)

**ŽUDYTI / vengti:**

- **Avarinio flow „severity diagnozė" arba „ar reikia vet" sprendimas.** Briefing'o liability riba
  absoliuti: jokio medicininio/veterinarinio PATARIMO. Flow gali rodyti TIK: (a) ką augalas turi
  (deriveToxicity faktas), (b) simptomų checklist'ą kaip INFO, (c) kontaktus. NEGALI sakyti „palauk"
  ar „skambink dabar" — tai diagnozė. **Build-kampu tai svarbu:** „rodyk faktą+kontaktą" yra VIDUT;
  „sprendimų medis ar skambinti 112" yra brangus IR liability-bomba. Statyk pigią+saugią versiją.

- **LT veterinarijos „kontaktai" be realaus šaltinio.** Research: JAV turi ASPCA (888) 426-4435 ir
  Pet Poison Helpline 855-764-7661 — 24/7. **Lietuvoje 24/7 nacionalinės gyvūnų apsinuodijimo
  linijos NĖRA.** Reiškia: avarinis flow #5 negali tiesiog embed'inti US numerio (beverčiai LT
  user'iui) — reikia kuruoti LT vet klinikų budinčių kontaktų sąrašą. **Tai paslėpta build kaina,
  kuri #5 paverčia iš „VIDUT" arčiau „brangu" jei daroma rimtai.** Pigus MVP: „skambink savo vet
  klinikai" + bendras 112, be netikro „poison line" pažado.

- **#10 paukščių niša DABAR.** ASPCA duomenys avian-skurdūs (03-assets: target=žmogus/gyvūnas, ne
  per-rūšį). Statyti reikštų naują duomenų pipeline → brangu prieš mažą auditoriją. Atidėti.

- **Bet koks saugumo balas, kuris skamba kaip „garantija".** „Namų saugumo balas 92/100" gali būti
  suprastas kaip „mano namai saugūs" → false comfort → liability. Rodyk balą tik su aiškiu „remiasi
  ŽINOMAIS duomenimis; nepilna" disclaimer'iu. Pigu pridėti, brangu praleisti.

- **Sezoninius push'us / gyvenimo įvykio audit'us pirmuose 90 d.** Priklauso nuo push infra (kurios
  pilnai nėra) — ne quick win. Marketingo vertė reali, bet ne pirmo etapo darbas.

---

## 4. 90-dienų seka (3 quick wins pirma — founder rekomendacija)

**Free vs Pro skirtis (etikos mazgas iš 44/40):** FAKTAS nemokamas, PERSONALIZACIJA Pro.

- **Sp
rintas 1 (quick win #1) — Namų profilis [PIGU, FREE].** 3 klausimai settings/onboarding. Vienas doc
  laukas. Be jo nieko kito neįmanoma personalizuoti. Tai jungiklis, ne feature pats savaime.

- **Sprintas 2 (quick win #2) — Kolekcijos saugumo ataskaita [PIGU, dalinai PRO].** Derive iš
  savybes × profilis. Faktinė dalis („šie 3 augalai toksiški katėms") = FREE. Personalizuotas balas
  + prioritetinės rizikos + „ką daryti su tavo namais" = PRO. Tai tiksliai monetizacijos linija:
  faktas atviras, intelektas mokamas. 80% jau padaryta (deriveToxicity).

- **Sprintas 3 (quick win #3) — Zonų saugumo semantika [PIGU→VIDUT, PRO].** Zonos tipo laukas +
  konflikto check. „Toksiškas augalas vaiko zonoje" auto-flag. Unikalu (niekas nedaro), pigu (zonos
  yra). Migracija esamoms zonoms = vienintelė VIDUT dalis.

→ **Po šių trijų:** plant-sitter saugumo kortelė #4 (PIGU, ant veikiančio sharing — beveik nemokamas
  priedas) + viešo paso saugumo eilutė. Tada, jei vertė pasitvirtina, avarinis flow #5 su RIMTAI
  kuruotais LT kontaktais (čia investuok, nes tai liability-jautru). Pirkimo guard #6 pigiąja versija
  (rankiniai lookalike-safe mapinimai 20-30 top rūšių), ne brangus panašumo grafas.

**Founder-disciplina:** pirmi 3 sprintai NELiečia push infra, mokėjimų ar naujų duomenų pipeline —
visi remiasi assets, kurie 03-assets pažymėti kaip `original-and-defensible` (deriveToxicity, care
intervals) arba veikiantys (zonos, sharing, katalogas). Tai reiškia: 3 quick wins = ~1–1.5 sav.
realaus darbo, ne mėnesiai, IR jie nepriklauso nuo užrakintų spynų (§6 assets).

---

## 5. Šaltiniai

- PictureThis toxic plant warning (flat, ne household-aware): https://www.picturethisai.com/ ;
  https://www.techradar.com/computing/websites-apps/picturethis
- Lily-cat 12–18h gydymo langas (avarinio flow vertės pamatas): https://www.fda.gov/animal-veterinary/animal-health-literacy/lovely-lilies-and-curious-cats-dangerous-combination ;
  https://www.petmd.com/cat/poisoning/lily-poisoning-cats
- US poison kontaktai (LT atitikmens NĖRA — build kaina #5): ASPCA https://www.aspca.org/pet-care/aspca-poison-control ;
  Pet Poison Helpline https://www.petpoisonhelpline.com/
