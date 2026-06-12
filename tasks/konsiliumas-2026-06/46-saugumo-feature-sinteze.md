# Saugumo-feature konsiliumo SINTEZĖ (2026-06-12)
_5 lęšiai (pediatras, veterinaras, UX, liability red-team, founder-build). Stiprus sutapimas._

## VIENA LINIJA, KURIĄ VISI 5 NUBRĖŽĖ
**Bet koks srautas, kuris paima SIMPTOMUS ir grąžina SPRENDIMĄ („skambink / palauk / važiuok") =
reguliuojamas medicinos prietaisas (ES MDR Rule 11 → IIb/III + AI Act high-risk). Solo bootstrap'ui
legaliai neįmanoma.** Visa vertė išgaunama BE tos linijos: faktas + kontaktai, niekada ne triage.

## STATYTI (pigu, naudinga, gintina — 3+ lęšiai sutaria)

| # | Funkcija | Kodėl | Kaina | Free/Pro |
|---|---|---|---|---|
| 1 | **Severity-tiered toksiškumas** (lokalus dirgiklis vs sisteminis) vietoj binarinio „toxic ✕" | Dažniausios ekspozicijos (dieffenbachia/pothos/oksalatai) — LENGVOS; binaras gąsdina be reikalo (cry-wolf). deriveToxicity JAU turi laukus — tik UI kalba | PIGU | Free |
| 2 | **Pet-specifinė rūšies diferenciacija** (katė≠šuo≠paukštis) + „lelija+katė" katastrofos vėliava | ASPCA datasetas JAU rūšies-skaidytas, nepanaudotas. Lelija katei = MIRTINA, šuniui = GI. ~10-15 genčių lethal whitelist | PIGU | Free |
| 3 | **Namų profilis** (≤3 klausimai, skip'inami: vaikas/katė/šuo) | Jungiklis VISAI personalizacijai. ~70% padaryta (1 doc laukas + onboarding). FICO: 5+ klausimų → ~20% meta | PIGU | Free/jungiklis |
| 4 | **Kolekcijos saugumo ataskaita** (derive iš savybes × profilis) | Didžiausia vertė / mažiausias darbas (~80%). Rodyk SĄRAŠĄ rizikų, NE balą | PIGU | **PRO** (intelektas) |
| 5 | **Zonų saugumo semantika** (zonos tipas + konflikto check: toksiškas augalas „vaiko zonoje") | Faktas × user-pažymėta zona = jokios diagnozės. Niekas nedaro. Zonos JAU yra | PIGU→VID | Free/Pro |
| 6 | **Plant-sitter/auklės saugumo kortelė** | UX 5/5: delegacija = VIENINTELIS ne-nerimą-keliantis recurring trigeris. Sharing JAU veikia | PIGU | Free/Pro |
| 7 | **Statiškas „kas dabar" kontaktų lapas** (BE simptomų) + lokalus poison-control vienu tap'u | Info+kontaktai (112, LT Apsinuodijimų biuras 24/7). NE flow | PIGU | Free |
| 8 | **„NĖRA DUOMENŲ ≠ SAUGU"** kaip sąžininga feature | Teisiškai gina, niekas nedaro | PIGU | Free |

## ŽUDYTI (pritempta / liability / fear-marketing — visi sutaria)

- **Simptomų→sprendimo srautas** („ar/kada skambinti vet/112") — medicinos prietaisas; oksalatų atveju
  vėmimo sukėlimas KONTRAINDIKUOTAS, katė+lelija „stebėk namie" = mirtis. Visada „skambink DABAR".
- **„Saugumo balas 92/100"** — false reassurance = negligent-misrepresentation liability, pavojingiau nei
  nieko; gamifikuoja nerimą be veiksmo. Rodyk sąrašą, ne skaičių.
- **Dozės/„kiek gramų mirtina" skaičiuoklė** — melagingas tikslumas (kai kurių toksinų net neidentifikuota).
- **Sezoniniai poinsetijos push'ai / fear aplink kūdikį** — poinsetija vaikams NEpavojinga = fear-marketing.
- **Pasikartojantys saugumo push / alert fatigue** (Yuka pamoka).
- **Tikslus vaiko amžius/vardas profily** — GDPR vaikų duomenys, baudos iki 4% apyvartos. (Tik „yra vaikas".)
- **Paukščių niša DABAR** — duomenų skurdas = brangus pipeline mažai auditorijai (vėliau).
- **Gyvenimo-įvykio auditas / sezoniniai kaip in-app feature** — tai MARKETINGO kanalas, ne feature
  (user negrįš pranešti; push infra nepilna).

## ⭐ MEDIKŲ TOKSIŠKUMO KORTELĖ (founder'io live idėja — įvertinta per lęšius)

Konsiliumas jos tiesiogiai neturėjo briefinge, BET ji TIKSLIAI perveria tą liniją, kurią visi nubrėžė:
- **Liability: GINTINA.** Kortelė pateikia FAKTUS (rūšis + toksikantai + šaltiniai) PROFESIONALUI, kuris
  sprendžia gydymą. App NEDIAGNOZUOJA, NEsprendžia → NĖRA medicinos prietaiso. Tai SAUGI pusė tos pačios
  linijos, kurią triage srautas peržengia. Štai kodėl ji stipriausia: pagauna avarinę vertę LEGALIAI.
- **Pediatras/vet: identifikacija = #1 ER/poison-control problema** → genuinely naudinga.
- **UX objekcija atremta:** kortelė egzistuoja IŠ ANKSTO (augalas jau kolekcijoj/pase) — avariniu momentu
  TIK parodai, ne navigauji srautą.
- **Build spraga = svertas:** dabartiniai savybes neturi compound-level pavadinimų (oksalatai/alkaloidai).
  Reikia papildomo duomenų sluoksnio, accuracy-critical → BŪTENT čia toksikologo/akademijos verifikacija
  nepakeičiama → sustiprina 33-akademijos-partnerystės case. Kortelė gauna „Patvirtinta [toksikologas]".
- **VERDIKTAS: STATYTI, bet PO compound-duomenų + eksperto patikros.** Tai missijos viršūnė ir
  diferenciatorius (niekas nedaro augalo→medikui), bet tik su patikrintais duomenimis (kitaip liability).

## 90-DIENŲ SEKA (founder-build, su konsiliumo korekcijomis)
1. **Severity-tiered display** (#1) — pamatas viskam, pigu, free. Demistifikuoja, ne gąsdina.
2. **Namų profilis** (#3, ≤3 skip'inami) — personalizacijos jungiklis.
3. **Kolekcijos saugumo ataskaita** (#4) — biggest value/least work; PRO sluoksnis (faktas free / intelektas pro).
→ Toliau: pet rūšies diferenciacija (#2), zonų semantika (#5), plant-sitter kortelė (#6).
→ Vėliau (po akademijos): medikų kortelė su verifikuotais compound duomenimis.

## LT-SPECIFINĖ REALYBĖ (vet lęšis — svarbu)
Lietuvoje NĖRA pet poison hotline'o (ASPCA/Pet Poison Helpline = JAV, mokami, anglų). Realus CTA
gyvūnams = lokali 24/7 vet klinika (LSMU SGK / DR.VET). Žmonėms = LT Apsinuodijimų kontrolės ir
informacijos biuras (24/7). Patikrinti tikslius numerius prieš statant #7.

## ESMINIS ARBITRAŽAS
PictureThis turi FLAT „toxic" faktą, bet NE household-aware sluoksnio (zona × profilis). Mes tą
sluoksnį turim beveik nemokamai iš esamų assets — tai realus, gintinas, niekieno nedaromas diferenciatorius.
