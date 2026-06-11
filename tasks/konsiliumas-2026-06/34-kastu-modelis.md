# Išlaikymo kaštų modelis (preliminarus, 2026-06-11)
_Įverčiai; tikslūs skaičiai iš Anthropic + Firebase dashboard'ų. Eilės tvarka teisinga._

## Varikliai (pagal svorį)
1. AI (Claude) — dominuojantis, kintamas; magnetas IR didžiausias kaštas
2. Firebase — auga su useriais (catalog onSnapshot → /api/catalog proxy svarbus)
3. Vercel/Storage/domenas — maži

## Vieneto kaštai (sonnet-4-6 ~$3/M in, ~$15/M out, apytiksliai)
- AI paieška (NE catalog hit): $0,05–0,15; catalog hit = $0 (F1 gelbsti)
- Pokalbis: ~$0,05–0,15
- Hero (Gemini): $0,20–0,50 VIENKARTINIS katalogo kaštas (ne per-user), bręstant → ~0

## Trys mastai (€/mėn)
| | Hobis <500 | Augantis ~5k | Didesnis ~20k |
| AI | €30–100 | €200–600 | €800–2500 |
| Firebase | €0–5 | €20–80 | €100–300 |
| Vercel/Storage/domenas | €1–5 | €20–40 | €40–80 |
| **VISO** | **€30–150** | **€250–700** | **€1000–3000** |

## Svarbiausia įžvalga
Kaštai auga KARTU su naudojimu; nemokamas AI magnetas = brangioji dalis.
- Hobis (<500): €30–150/mėn — prieinama asmeninė išlaida; dovana tvari iš kišenės
- NEsiskaluoja nemokamai: augant privalai monetizuoti
- Kasos NETO < bruto: ~5k+ maste išlaikymas €250–700/mėn → €1–3k bruto = €0,5–2k neto

## Svertai (laiko dovaną pigią)
- Catalog-first (yra) · Chat per HAIKU ne Sonnet (5–10× pigiau — didelis svertas jei dabar Sonnet)
- Rate limits (5/5/2 yra) · /api/catalog proxy (nukerta Firebase + data-protection)

## Dev (Claude Code) tokenai — atskira
NE išlaikymas, o development; lumpy, tavo kontrolėje; per metus keli šimtai–pora tūkst $ pagal intensyvumą; mažėja stabilizuojantis.

## Sprendimui
Hobis-nemokama PIGI ir tvari (€30–150/mėn). Skalė reikalauja pajamų. Stebėti: AI kaštas/aktyvų userį.

## Kiti žingsniai (pilnam biudžetui)
1. Realūs skaičiai iš Anthropic + Firebase dashboard'ų
2. Per-action kaštų logging → tikras €/paiešką ir €/userį
