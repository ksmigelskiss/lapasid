# Savybes follow-ups (post Faza 1)

_Žemiau įrašyti follow-up'ai po pirmojo savybes redesign'o. Bus implementuojama, kai vartotojas pradeda dirbti local'iam dev server'yje su realiu (TEST) augalų dataset'u._

---

## ✦ Wifi-style severity indicator

**Kontekstas:** dabar pavojaus pill'as koduoja severity per:
- Bg spalvą (terracotta-50 / 100 / solid)
- Ikoną (none / AlertTriangle / Skull)
- + pasak vartotojo: „nematau wifi ženkliuko"

**Vartotojo idėja:** vietoj AlertTriangle/Skull naudoti **augančių barų** ikona — kaip AccuracyButton/Priežiūra widget'e (3 barai augantys, panašu į wifi signal indicator). Severity koduojama per matomų barų skaičių:

- **silpnas**  → 1 baras matomas (kiti gray)
- **vidutinis** → 2 barai matomi
- **stiprus**  → 3 barai matomi (visi pilni)

Vientisas su mūsų brand'ais (AccuracySprite naudoja tą patį pattern'ą).

**Implementacijos užduotys:**

- [ ] Sukurti `src/components/brand/SeverityBars.jsx` — 3-bar SVG komponentas, props: `severity` ('silpnas' | 'vidutinis' | 'stiprus') ir `size`. Naudoja forest/terracotta paletę.
- [ ] Galvoti — gal pasidalinti logiką su `AccuracySprite` (jei dydis sutampa) per shared SVG.
- [ ] `PlantSavybesPills.jsx` — pakeisti `pavojusStyle()` ikona iš AlertTriangle/Skull į SeverityBars
- [ ] `PlantCard.jsx` — tas pats fix `hazardPillStyle()` ikona
- [ ] Atsisakyti `Skull` ikonos PlantSafetyCallout? Galimai paliekam Skull tik aukšto severity callout'e dėl emocinio svorio. Pill'uose — vienodi barai.

**Atskira mintis:** ikona vs spalva kombo:
- Stiprus: 3 barai TERRACOTTA solid + bone bg
- Vidutinis: 2 barai terracotta-600 + 1 muted + terracotta-100 bg
- Silpnas: 1 baras terracotta-500 + 2 muted + terracotta-50 bg

Gradient'iškai aiškiau nei stalc switch ikonų.

---

## Kiti follow-up'ai

### Wikipedia RAG NAUJOMS paieškoms

Šiuo metu Wikipedia RAG įjungtas tik per „Atnaujinti per AI" mygtuką (mes turim plant.lotyniskas). Naujoms paieškoms (text/photo) — Wikipedia nepasiekiamas, nes latinName žinomas tik po Phase 1.

Sprendimo idėjos:
- Two-pass Claude: pirmas trumpas call'as latinName identifikacijai, tada Wikipedia fetch + pilnas Phase 1 su RAG. +1 latency, +1 token cost.
- Wikipedia opensearch su user input'u (rasti EN article title iš Lt query'os per redirect chain'us)
- Skip Wikipedia naujoms paieškoms — refresh button'as duoda RAG vėliau

### Batch refresh per Settings

- [ ] Settings ekrane „Atnaujinti visą kolekciją per AI" mygtukas
- [ ] Rate-limited (1 plant per ~3s, kad neperviršyti Claude limit'o)
- [ ] Progress bar + cancel
- [ ] Skip plants without `lotyniskas`

### Lauko augalams — papildomos savybes kategorijos

Pridėti į schema kai vesime outdoor plants:
- `invazyvumas: 'none' | 'lokalus' | 'agresyvus' | 'invazinis'` (Lt teritorijai)
- `atsparumas_salciui: 'tropikinis' | 'sušyla' | 'atsparus' | 'labai_atsparus'` (USDA zone equivalent)
- `linija: 'puošininis' | 'maistinis' | 'medicininis' | 'invazinis'`

### Severity barų vizualinis test'as

Kai bus implementuotas SeverityBars — patikrinti kontrastą:
- Ant terracotta-50 bg (silpnas pill)
- Ant terracotta-100 bg (vidutinis pill)
- Ant terracotta solid bg (stiprus pill — bone tone)
- Ant glass card (sick/quarantine period wrapper)

Niekur netilpti < 11px (kad būtų matomi 3 atskiri barai).
