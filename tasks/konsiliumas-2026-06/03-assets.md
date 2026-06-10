# LapasID — Sąžininga turto inventorizacija (strateginei tarybai)

_Visi skaičiai iš kodo/duomenų (2026-06-10), ne iš vizijos. Repo: ~/lapasid._

## 1. Duomenų turtas

| Turtas | Kiekis | Kilmė/licencija | VERDIKTAS |
|---|---|---|---|
| pfaf.json | 9895 įrašų, bet TIK **2481 turiningi** (likę 7413 — tušti karkasai po cleanup); knownHazards+LT vertimas tik tuose 2481 | **PFAF = CC BY-NC-SA. NC = NEKOMERCINĖ. SA = derivatyvai paveldi licenciją** | **scraped-with-licensing-risk (DIDŽIAUSIA)** — NC tiesiogiai prieštarauja mokamam produktui |
| pre-db.json | 1652 gentys, 8178 rūšys; iš AHS Encyclopedia (2011), Beckett (1995), Cheng (2019) | **3 autorinės knygos, parafrazuotas turinys**; EPUB/PDF guli data/ | **scraped-with-licensing-risk (DIDŽIAUSIA #2)** |
| aspca-toxicity.json | 1023 augalai (472 toksiški) | Skreipinta iš aspca.org; faktiniai duomenys, TOS rizika švelni | scraped (švelni rizika), atributuoti |
| aspca-genus-map | 60 genčių, 65 RANKINIAI mapinimai | Mūsų kuracija ant ASPCA | derived-but-transformed |
| lt-names.json | 1673 genčių LT vardai (high conf tik 371) | Skreipinta: plants-genus portalai, wiki, Derlingas, Gaspadorius | scraped-with-licensing-risk |
| plants.json / species-lt-names | 5786 įrašai / 4448 species LT vardai | Skreipinta iš LT portalų (žinomos OCR korupcijos, taisytos) | scraped → derived |
| latin-synonyms | 1131 sinonimas + rankinis extend | Mūsų kuracija | original-and-defensible |
| **GLOBAL catalog (Firestore)** | **~99 įrašų su watercolor hero**; seed kuracija curated-300 = 274 kandidatai | Mūsų sukurta (AI enrich + admin), BET užpildyta iš licencijuotų šaltinių | original kaip kompiliacija; turinio kilmė rizikinga |
| deriveToxicity heuristikos | severity parsing + 26 genčių IRRITANT whitelist; TESTUOTA | Mūsų algoritmas | **original-and-defensible** |
| Care INTERVALS lentelės | 6+4 kategorijos, rankinė konservatyvi kuracija | Mūsų | **original-and-defensible** |
| Watercolor heroes | ~99 PNG su watermark (vizualus+forensic LSB); pre-watermark originalai saugomi privačiai | **Gemini-generated** — AI vaizdų komercinės teisės neaiškios | derived; teisės pilkos |
| PFAF LT vertimai | 2481 įrašų knownHazardsLt | AI vertimas iš NC šaltinio → **paveldi NC** | rizikinga |

**KRITINĖ IŠVADA: trijų stipriausių DB (pfaf, pre-db, lt-names) komercinis pamatas teisiškai trapus. Be to, 30MB šių duomenų šiandien bundle'inami į klientą atvirai.**

## 2. Produkto paviršius (kas REALIAI veikia)

VEIKIA: kolekcija+statusai+foto; multi-user rolės (owner/member/viewer) + invite QR; care prognozės (testuotos); care seansai + rewards; AI paieška 2-fazė; foto identifikavimas; AI pokalbiai streaming (augalas/kolekcija/žinynas); katalogas + admin editor (LibraryEditorV2 live preview); **viešas pasas /p/{id}**; zonos; timeline (7 event tipai); memorial (death reason+lesson!); desktop split-panel; PWA offline; hero generavimas.

DALINAI: **Paywall — TIK UI.** `subscription.plan` tikrinamas, limitai veikia (free: 5 searches/5 chats), bet **mokėjimo integracijos (Stripe ir pan.) KODE NĖRA.**

Serveris (api/): claude proxy+streaming, save-plant (auth-verified), generate-hero, plant-image+rehost (Brave proxy), passport/water+care POST, viewer, vision-unlock. Visi su JWT (P0-1 fix).

## 3. Data points

**RENKAMA šiandien:** care eventai su timestamp (watering/fertilizing/repotting/treatment/note/photo); **diedDate + deathReason + lesson (UNIKALUS signalas — niekas pasaulyje šito nerenka!)**; statusai+perėjimai; užrašai; foto; aiUsage skaitliukai (limitams, ne analitikai); passport care eventai su source:'nfc'.

**COLLECTABLE trivialu, bet NErenkama:** search queries (jokio logging!), passport scan/view analitika (jokio counter!).

**CLAIMED vizijoje, bet nerenkama:** sellers/apskaitos duomenys; rūšies lygio care sėkmės agregacija (per-augalą yra, pipeline'o nėra).

## 4. NFC/fizinis sluoksnis — TIESA

YRA: viešas web-pasas /p/{id} (veikia); copy/share URL; passport care POST endpoint'ai.
NĖRA: **jokio NDEFReader/Web NFC kodo; QR kodas pasui NEgeneruojamas in-app** (qrcode.react naudojamas tik invite'ams); 'nfc' source — tik etiketė ant POST. „NFC integracija" realiai = NFC-friendly URL, kurį user'is gali įrašyti svetima programėle. Toxicity Dial — koncepcija. RFID — niekur.

## 5. Vykdymo pajėgumas

Solo + AI agentai; neįprastai aukštas velocity (3 sav.: scrape pipeline su versionavimu, 3 knygų parseriai, 2-fazė paieška, F1 catalog, watermark pipeline, multi-user rules, 59 testai+CI+Sentry). Lessons.md kilpa, root-cause kultūra. Ribojimai: solo bandwidth; be integracinių testų serveriui; CI=aliarmas ne užtvaras; OAuth-tik-prod blokuoja preview verifikaciją. **Velocity — reali konkurencinė stiprybė; riba — bandwidth, ne įgūdžiai.**

## 6. Užrakintos spynos

- **Firebase free tier:** catalog per client SDK (limit 2000, onSnapshot visiems) — read'ai auga tiesiškai su users.
- **AI kaštai:** claude-sonnet-4-6 (ne Haiku); paieška = keli call'ai (preview+enrich+vision); free limitas 5/5/2.
- **Data protection NEįgyvendinta:** catalog WRITE atviras bet kuriam authed user (firestore.rules:86 — žinoma vulnerabilitė!); 30MB JSON klientui; watercolor URL public.
- **Mokėjimų NĖRA** — monetizacija neprijungta.
- **AI vaizdų teisės** pilkos (Gemini ToS).
