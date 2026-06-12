# Toksiškumo klasių integracija — interface spec (2026-06-12)

> Kaip duomenų sluoksnis (`data/toxin-classes.json` + `data/genus-toxin-map.json`) prijungiamas
> prie augalo ir kortelių. **Tai SPEC, ne kodas** — resolverio dar nerašom. Apibrėžia kontraktą,
> kad vėliau wiring'as būtų aiškus ir nieko nesulaužytume.

## Duomenų srautas

```
augalas.lotyniskas → gentis (1-as žodis, UPPER)
   → genus-toxin-map[gentis]  → { klases:[{id,dalis}], saugus, tier }
      → toxin-classes[id]      → { mechanizmas, sunkumo_lubos, rusies_jautrumas, antidotas,
                                    simptomai_lt, medikui_lt, aprasymai{vaikai,suauge,gyvunai} }
   + household profilis ({ vaikai:bool, gyvunai:[kate|suo|paukstis|grauzikas] })
   → resolveToxinProfile() → kortelei paruošta struktūra
```

## Kontraktas: `resolveToxinProfile(plant, household)`

**Įvestis:**
- `plant` — turi `lotyniskas` (ar `latinName`). Genties ekstrakcija: pirmas žodis, didžiosiomis.
- `household` — `{ vaikai: bool, gyvunai: string[] }` (iš namų profilio; gali būti tuščias).

**Išvestis:**
```
{
  status: 'toksiska' | 'saugu' | 'nezinoma',   // nezinoma = genties nėra žemėlapyje / klasė TBD
  tier: 1|2|3,                                  // duomenų patikimumas
  klases: [{
    id, vardas_lt, mechanizmo_tipas, sunkumo_lubos, antidotas, dalis,
    // sunkumas KONKREČIAI šitam household (max iš relevant rūšių/auditorijų):
    sunkumas_man: 'nera'|'silpnas'|'vidutinis'|'sunkus'|'mirtinas'|null,
    aprasymas: '<audience-parinktas>',          // vaikai jei household.vaikai; gyvunai jei gyvūnai; default suauge
    medikui_lt                                   // medikų kortelei
  }],
  kritine_veliava: bool,                         // bent viena klasė 'mirtinas' relevant rūšiai → „skambink DABAR"
  specialios: ['liūtis_katei_kritinė', ...]      // iš specialios_veliavos (jei pridėsim)
}
```

## Sunkumo išvedimas (NE laisvas priskyrimas)
`sunkumas_man` = MAX per relevant auditorijas:
- jei `household.vaikai` → įtraukti `rusies_jautrumas.zmogus` (vaikai ~ žmogaus dirgiklis, bet
  mažesnė dozė; v1 naudoti zmogus reikšmę).
- už kiekvieną `household.gyvunai` rūšį → `rusies_jautrumas[rūšis]`.
- jei household tuščias → rodyti klasės `sunkumo_lubos` (bendras).
- `null` reikšmės (nepakanka duomenų) NEskaičiuojamos kaip „saugu" — rodyti „nėra duomenų".

## Audience parinkimas aprašymui
- `household.vaikai` → `aprasymai.vaikai`
- `household.gyvunai.length` → `aprasymai.gyvunai`
- kitaip → `aprasymai.suauge_zmones`
- (kortelė gali rodyti kelis, jei household turi ir vaikų, ir gyvūnų)

## Kur prijungiama (būsimi vartotojai — NE dabar)
1. **Vieša kortelė** (`PublicPlantCard`) — bendras saugumo blokas (household tuščias → `sunkumo_lubos`).
2. **Kolekcijos saugumo ataskaita** (Pro) — per visus user augalus × household → rizikų sąrašas.
3. **Medikų kortelė** — `klases[].medikui_lt` + antidotas + dalis + šaltiniai.
4. **Zonų konfliktas** — `kritine_veliava` × zonos „vaiko/pasiekiama" tipas.

## Ryšys su esama `deriveToxicity`
Naujas sluoksnis NEpakeičia `savybes.pavojai[]` (lieka). `resolveToxinProfile` — atskira, NAUJESNĖ
tiesa; kortelėse pirmenybė jam, `pavojai[]` — fallback kol žemėlapis nepilnas. Migracija vėliau.

## Ribos
- Genties lygis (v1). Rūšies/dalies tikslinimas — per `dalis` lauką + ateities per-rūšį override.
- `null`/tier-3 → kortelė rodo „informacija ruošiama / tikrinama", ne „saugu".
- Jokio medicininio patarimo — tik `medikui_lt` (faktai profesionalui) + „kreipkis".
