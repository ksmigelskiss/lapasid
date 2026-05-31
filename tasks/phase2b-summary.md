# Phase 2b — Blind spots batch 1 (entries 0-209)

Method: Wikipedia LT API (`action=query&redirects=1`). For each Latin binomial we look up the article page on lt.wikipedia.org; if it exists we compare the canonical page title (after redirect resolution) to `currentLt`. Comparison is case- and diacritic-insensitive (NFC, lowercased) and ignores parenthetical disambiguation suffixes like `(augalas)`.

| Verdict | Count |
|---|---|
| wikiDisagrees (potential bugs) | 24 |
| confirmedOk | 22 |
| noArticle | 164 |
| **Total checked** | **210** |
| of which had a Wikipedia article | 46 |

## All wiki-disagrees

| Latin | currentLt (plants.json) | Wikipedia LT title | source |
|---|---|---|---|
| `Araucaria bidwillii` | Bidvilio araukarija | **Kvapioji araukarija** | indoor-whitelist |
| `Araucaria heterophylla` | įvairialapė araukarija | **Aukštoji araukarija** | indoor-whitelist |
| `Asparagus officinalis` | vaistinis šparagas | **Vaistinis smidras** | indoor-whitelist |
| `Asplenium trichomanes` | meilingoji kalnarūtė | **Šerinė kalnarūtė** | indoor-whitelist |
| `Cereus peruvianus` | peruvinis cereus | **Peruvinis stulpenis** | indoor-whitelist |
| `Citrus maxima` | pampelmusinis citrinmedis | **Didysis citrinmedis** | vendor |
| `Citrus nobilis` | saldžiavaisis citrinmedis | **Apelsininis citrinmedis** | vendor |
| `Coffea arabica` | arabinis kavmedis | **Arabinis kavamedis** | indoor-whitelist |
| `Coffea canephora` | kanefora kavmedis | **Didysis kavamedis** | indoor-whitelist |
| `Dionaea muscipula` | musėgaudė dionaja | **Jautrusis musėkautas** | indoor-whitelist |
| `Dioscorea batatas` | baltinė dioskorija | **Batatinė dioskorėja** | indoor-whitelist |
| `Drosera intermedia` | vidutinė saulutė | **Mažalapė saulašarė** | indoor-whitelist |
| `Drosera rotundifolia` | apskritalapė saulutė | **Apskritalapė saulašarė** | indoor-whitelist |
| `Eucalyptus viminalis` | vytinis eukaliptas | **Vytelinis eukaliptas** | vendor |
| `Euphorbia helioscopia` | saulėžiūrė karpažolė | **Dirvinė karpažolė** | indoor-whitelist |
| `Ficus pumila` | smulkiusis fikusas | **Smulkusis fikusas** | indoor-whitelist |
| `Fortunella margarita` | perlinis kinkinas | **Kiaušininis kinkanas** | indoor-whitelist |
| `Freesia refracta` | laužioji frezija | **Kvapioji frezija** | indoor-whitelist |
| `Geranium lucidum` | blizgantysis snaplėtis | **Blizgantysis snaputis** | vendor |
| `Geranium pusillum` | smulkusis snaplėtis | **Smulkusis snaputis** | vendor |
| `Geranium robertianum` | smirdusis snaplėtis | **Raudonstiebis snaputis** | vendor |
| `Geranium sylvaticum` | miškinis snaplėtis | **Miškinis snaputis** | vendor |
| `Helichrysum arenarium` | smėlyninis šlamutis | **Smiltyninis šlamutis** | indoor-whitelist |
| `Hibiscus rosa-sinensis` | kininis hibiskas | **Tikroji kinrožė** | indoor-whitelist |

### Notes on the disagrees

Likely clean wins (typos / variant spellings):

- `Coffea arabica`: `arabinis kavmedis` -> Wikipedia `Arabinis kavamedis` (missing `a` — typo)
- `Coffea canephora`: `kanefora kavmedis` -> `Didysis kavamedis` (epithet wrong AND `kavmedis` typo)
- `Ficus pumila`: `smulkiusis fikusas` -> `Smulkusis fikusas` (extra `i` — typo)
- `Helichrysum arenarium`: `smėlyninis šlamutis` -> `Smiltyninis šlamutis` (different epithet form)
- `Eucalyptus viminalis`: `vytinis eukaliptas` -> `Vytelinis eukaliptas`
- `Fortunella margarita`: `perlinis kinkinas` -> `Kiaušininis kinkanas` (also `kinkinas` vs `kinkanas` — check genus spelling)
- `Geranium lucidum`, `pusillum`, `sylvaticum`: `snaplėtis` -> Wikipedia `snaputis` (whole genus naming variant in plants.json)
- `Geranium robertianum`: `smirdusis snaplėtis` -> `Raudonstiebis snaputis` (different epithet AND `snaplėtis`/`snaputis`)
- `Drosera rotundifolia` / `intermedia`: `saulutė` -> Wikipedia `saulašarė` (whole genus naming variant)
- `Asparagus officinalis`: `vaistinis šparagas` -> `Vaistinis smidras` (different genus name)

Likely correct disagreements where Wikipedia uses a different epithet (need human review):

- `Araucaria bidwillii`: `Bidvilio araukarija` -> `Kvapioji araukarija`
- `Araucaria heterophylla`: `įvairialapė araukarija` -> `Aukštoji araukarija` (cf. `Araucaria excelsa` is also `aukštoji` in plants.json)
- `Asplenium trichomanes`: `meilingoji kalnarūtė` -> `Šerinė kalnarūtė` (cf. `A. septentrionale` is `šerinė kalnarūtė` in plants.json — possible swap)
- `Citrus maxima`: `pampelmusinis citrinmedis` -> `Didysis citrinmedis`
- `Citrus nobilis`: `saldžiavaisis citrinmedis` -> `Apelsininis citrinmedis`
- `Cereus peruvianus`: `peruvinis cereus` -> `Peruvinis stulpenis` (epithet OK; genus name wrong — `cereus` not translated)
- `Dionaea muscipula`: `musėgaudė dionaja` -> `Jautrusis musėkautas` (entirely different naming)
- `Dioscorea batatas`: `baltinė dioskorija` -> `Batatinė dioskorėja`
- `Euphorbia helioscopia`: `saulėžiūrė karpažolė` -> `Dirvinė karpažolė`
- `Freesia refracta`: `laužioji frezija` -> `Kvapioji frezija`
- `Hibiscus rosa-sinensis`: `kininis hibiskas` -> `Tikroji kinrožė` (whole genus rename)

## confirmedOk (full list — 22)

| Latin | LT name |
|---|---|
| `Acorus calamus` | balinis ajeras |
| `Agave americana` | amerikinė agava |
| `Agave sisalana` | sizalinė agava |
| `Aloe aristata` | akuotuotasis alavijas |
| `Ananas comosus` | valgomasis ananasas |
| `Araucaria araucana` | čilinė araukarija |
| `Aristolochia clematitis` | paprastoji kartuolė |
| `Asplenium ruta-muraria` | mūrinė kalnarūtė |
| `Citrus limon` | tikrasis citrinmedis |
| `Citrus paradisi` | greipfrutinis citrinmedis |
| `Citrus reticulata` | mandarininis citrinmedis |
| `Clivia miniata` | raudonoji klivija |
| `Colocasia esculenta` | valgomoji kolokazija |
| `Curcuma longa` | dažinė ciberžolė |
| `Cyperus fuscus` | rudoji viksvuolė |
| `Cyperus papyrus` | papirusinė viksvuolė |
| `Eucalyptus globulus` | rutulinis eukaliptas |
| `Euphorbia cyparissias` | siauralapė karpažolė |
| `Euphorbia milii` | dygliuotoji karpažolė |
| `Euphorbia pulcherrima` | puošniausioji karpažolė |
| `Ficus benghalensis` | bengalinis fikusas |
| `Ficus elastica` | stambialapis fikusas |

## noArticle

164 entries (~78%) have no Wikipedia LT page at `https://lt.wikipedia.org/wiki/<Latin>`. Triage was skipped for these per spec (no follow-up search).

See `phase2b-blindspots-batch1.json` for the full list.