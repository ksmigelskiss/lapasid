# AccuracyButton (Priežiūra · Tikslumas)

Toolbar mygtukas (desktop'e — `CareOverview` greeting eilutėje), rodantis priežiūros tikslumo procentą su vizualinėm 4 stadijom. Veikia kaip **gamification** elementas — kuo geresnis priežiūros reguliarumas, tuo „tobulesnis" sprite'as ir spalva.

## Failai

- `src/components/AccuracyButton.jsx` — pill button (acc-cta + acc-meta sekcijos)
- `src/components/AccuracySprite.jsx` — augantis augaliukas (designer'io exact SVG)
- `src/utils/careBuckets.js` — `aggregateConfidence(forecasts)` skaičiavimas
- Naudojama: `CareOverview` (desktop bigGreeting mode), Dashboard `priežiūra` button (mobile)

## 4 stadijos pagal `careConfidence × 100`

| Stage | Range | Sprite spalva | Sprite leaf'ai | Tikslumas pill bg | Label |
|-------|-------|---------------|----------------|-------------------|-------|
| 0 | 0–24% | `#94a3a0` (gray) | 1 leaf, no bloom | `bg-gray-100` text-gray-700 | „Mokomės" |
| 1 | 25–49% | `#f59e0b` (amber) | 2 leaf, no bloom | `bg-amber-100` text-amber-800 | „Tikslumas" |
| 2 | 50–74% | `#2e7d52` (sage) | 3 leaf, no bloom | `bg-sage-50` text-sage-700 | „Tikslu" |
| 3 | 75–100% | `#1f5f3d` (dark sage) | 3 leaf + bloom (white center) | `bg-sage-100` text-sage-800 | „Tobula" |

**Stage threshold'ai** apskaičiuojami `pct < 25 ? 0 : pct < 50 ? 1 : pct < 75 ? 2 : 3`.

## Vizualinis pavyzdys

**OFF (inactive, default):**
- Kairė `acc-cta`: visada `bg-sage-700` (dark green) + white text + sprite (kintančios spalvos pagal stage)
- Dešinė `acc-meta`: stage spalva (žr. lentelę aukščiau)

**ON (active, careMode):**
- Visas pill `bg-sage-700` + shadow (žalia stati su drop shadow)
- Abi sekcijos transparent + white text
- Stage spalva paslepiama (visa pill žalia)

## Kodėl skirtingos spalvos tarp deployment'ų?

Jei matai amber 42% (stage 1) lokalei (mock data) ir sage 62% (stage 2) Vercel'yje (real data) — tai **NĖRA bug**, tai veikia kaip suplanuota.

Mock data turi mažesnę confidence (~42%, nes tik kelių augalų timeline įrašų), real data — didesnę (62%+, nes daug realių laistymo įrašų per ilgesnį laiką). Sistema „pažįsta" augalą geriau → confidence kyla → stage šokteli → spalva keičiasi.

## Konfigūracija

Threshold'ai ir tonai hardcoded `AccuracyButton.jsx` ir `AccuracySprite.jsx`. Jei nori pakeisti — abu failus reikia atnaujinti sinkroniškai (sprite spalvos `tones[]` ir pill `metaCls`).

## Designer source

- Spec: `/tmp/geliai-design/lapasid/project/components.jsx` (`AccuracySprite`, `AccuracyButton`)
- CSS: `/tmp/geliai-design/lapasid/project/styles.css` (`.accuracy-btn`, `.acc-cta`, `.acc-meta`, `.accuracy-sprite`)

Designer'io original CSS naudoja outer button `.stage-N` klasę spalvinti VISĄ pill pagal stage; mūsų implementacijoj `acc-cta` lieka pastovus sage (dark) ir tik `acc-meta` kinta — taip aiškesnis kontrastas tarp „mygtuko esmės" ir „tikslumo metrikos".
