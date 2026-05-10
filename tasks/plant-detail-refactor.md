# PlantDetail.jsx refaktoras (planuotas, dar ne padarytas)

**Statusas:** ⏸ atidėtas. Bus daromas po to, kai įsitikinsim, kad praeitas refactor (Dashboard.jsx + extracted CareWateringSheet) produkcijoje veikia gerai (`5394dda` commit, 2026-05).

**Kontekstas:** PlantDetail.jsx yra 1455 eilučių — net didesnis nei Dashboard.jsx buvo prieš refaktorą. Junk kodo (nenaudojamo) NĖRA, bet architektūriškai netvarka — daug skirtingų konceptų sumaišyti vienam faile (3 modaliniai sheet'ai, 2 tab content komponentai, 1 export'inta sub-komponenta, daug helper'ių).

---

## Dabartinė vidaus struktūra

| Linijos | Komponentas | Dydis | Kas tai |
|---------|-------------|-------|---------|
| 20-29 | `DotScore` | 10 | Mažas vizualinis (palikti) |
| 30-39 | `Stars` | 10 | Mažas (palikti) |
| 40-45 | `fmtDate` | 6 | Util |
| 46-217 | `PhotoSheet` | **170** | **Atskiras modal'as** nuotraukų valdymui |
| 218-226 | `Section` | 10 | Wrapper (palikti) |
| 227-241 | `InfoRow` | 15 | Wrapper (palikti) |
| 242-322 | `PassportSection` | 80 | NFC pass valdymas |
| 323-574 | `ProfileContent` | **250** | **JAU exportinta** — naudojama SearchModal.jsx |
| 575-628 | `NoteCard` | 55 | Užrašo card |
| 629-640 | `mkNoteId`, `noteToday`, `loadNotes` | 15 | Utils |
| 641-742 | `NotesContent` | 100 | **Atskiras tab content** |
| 743-780 | `TabBar` | 40 | Tab navigation (palikti) |
| 781-799 | `sheetDaysBetween`, `computeRecoverySummary` | 20 | Utils |
| 800-831 | `BottomSheet` | 30 | Wrapper |
| 832-975 | `StatusTransitionSheet` | **145** | **Atskiras modal'as** sick/quarantine perėjimams |
| 976-end | `PlantDetail` (main) | **480** | Layout + state + navigation |

**Patikrinta:** `ProfileContent` eksportintas iš PlantDetail ir naudojamas `src/components/SearchModal.jsx:8` (paieškos rezultatų rendering'ui). Tai stiprus argumentas išskirti į top-level failą.

---

## Refaktoro planas (priority order)

### Etapas 1 — didžiausias ROI (3 commit'ai)

| Komponentas | Naujas failas | Eilutės sumažės iš PlantDetail |
|-------------|---------------|-------------------------------|
| PhotoSheet | `src/components/PlantDetail/PhotoSheet.jsx` | −170 |
| StatusTransitionSheet | `src/components/PlantDetail/StatusTransitionSheet.jsx` | −145 |
| ProfileContent | `src/components/ProfileContent.jsx` (top-level — naudojama dviejose vietose) | −250 |

**Po Etapo 1:** PlantDetail.jsx 1455 → ~890 eilučių (−565 / 39%).

### Etapas 2 — vidutinis ROI

| Komponentas | Naujas failas | Eilutės |
|-------------|---------------|---------|
| NotesContent + NoteCard | `src/components/PlantDetail/NotesContent.jsx` | −155 |
| PassportSection | `src/components/PlantDetail/PassportSection.jsx` | −80 |

**Po Etapo 2:** PlantDetail.jsx ~890 → ~655 eilučių (−235).

### Etapas 3 — smulkmenos (gali ir nedaryti)

| Helper | Vieta |
|--------|-------|
| `fmtDate`, `sheetDaysBetween` | `src/utils/dateHelpers.js` (jei tokio nėra — sukurti) |
| `computeRecoverySummary` | `src/utils/plantRecovery.js` (specifinis domenui) |
| `mkNoteId`, `noteToday`, `loadNotes` | Greičiausiai liks NotesContent failo viršuje |

---

## Ką NEDARYTI

- ❌ `TabBar`, `Section`, `InfoRow`, `Stars`, `DotScore` — naudojami tik PlantDetail viduje, smulkūs (10–40 eilučių). Extract'as nepadarys aiškumo, tik daugiau failų.
- ❌ `BottomSheet` — naudojamas tik StatusTransitionSheet'e. Jei extract'inam StatusTransitionSheet, BottomSheet'as keliauja kartu.
- ❌ Pagrindinis `PlantDetail` komponentas (~480 eilučių po Etapo 1) — vientisas concern (state + tabs + navigation + main render). Skaldyti tik dėl skaldymo blogai.

---

## Sprendimo principas (priminimas iš ankstesnio refaktoro)

> „Svarus pagrindas" reiškia ne minimalūs failai, o **aiškios atskirtys**. Komponentai, kurie yra vienos koncepcijos vienetai (modal'as, tab content, savarankiški UI blokai) — į savus failus. Maži wrappers (`Section`, `InfoRow`) ir glaudžiai susijusi tab navigation — palikti šalia.

---

## Kai grįši prie šito

1. Pirma įsitikinti, kad Dashboard refactor (`5394dda`) produkcijoje veikia be issue'ų
2. Pradėti nuo Etapo 1, vienas extract per commit
3. Po kiekvieno commit'o `npm run build` patikrinimas
4. Po Etapo 1 — pažiūrėti realybėje ar geriau, ar tęsti su Etapu 2

**Failo mood:** PlantDetail.jsx yra didžiausia frontendo „karbonkė", bet ji dirba. Refaktoras = aiškumo investicija, ne bug fix. Galima daryti per kelias sesijas.
