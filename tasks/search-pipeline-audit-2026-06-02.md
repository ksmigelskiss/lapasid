# Search pipeline auditas — 2026-06-02 (po JWT/auth pakeitimų)

Finalinis search pipeline patikrinimas po sesijos auth pakeitimų (JWT verifyAuthToken
ant claude endpoint'ų, rehost-image SSRF+double-init, catalog subscription gate).
Fokusas — **foto paieška**. Verdiktas: **✅ SVEIKA.**

## Foto paieškos flow (end-to-end)

1. **Trigger** — 📷 mygtukas (`SearchModal.jsx:2459`) → file input (`capture="environment"`) → `searchByPhoto(file)` (`:2174`).
2. **Resize** — `resizeImage(file, 1200, 0.9)` → base64.
3. **Identifikacija** — `claudeCall()` (`:256`) → **POST `/api/claude`** su Claude vision message (`type:'image'` base64 + tekstas) + `web_search` tool + `TOOL_PREVIEW`. `maxTokens:1500, temp:0.3`.
4. **Enrichment** — pre-DB/catalog facts + foto: `fetchBraveImages` → **`/api/plant-image`** (Brave, public) hero + galerijai; iNat/Wiki fallback.
5. **Rezultatas** — kortelė su phase pipeline (Biblioteka/Pre-DB/AI/Nuotraukos/Patvirtinimas, `SEARCH_PHASES :1372`).

Tekstinė paieška — tas pats `claudeCall` + papildomai Phase 0 (client-side `searchCatalog` + `searchStage1` pre-DB, **be auth**).

## Auth — kaip elgiasi po pakeitimų

`claudeCall` (`SearchModal.jsx:256`):
```js
const idToken = await auth.currentUser?.getIdToken().catch(() => null)
if (idToken) headers['Authorization'] = `Bearer ${idToken}`
fetch('/api/claude', { ..., body: JSON.stringify({ ...body, limitType: 'searches' }) })
```
Server `/api/claude` (mūsų pakeitimas): `if (limitType) { if (!idToken) 401; uid = await verifyAuthToken(idToken); if (!uid) 401 }`.

**Veikia visiems, kas gali pasiekti search:**
- **Google user** → `auth.currentUser` yra → `getIdToken()` (auto-refresh, niekad expired) → `verifyIdToken` ✓. (Patvirtinta gyvai šią sesiją.)
- **Anonimas viewer** → `signInAnonymously` (firebase.js:49) → `auth.currentUser` (anonimas su GALIOJANČIU Firebase token'u) → `verifyIdToken` priima anonimus ✓.
- **Be sesijos** → App gate (`App.jsx`, `!user && !viewerToken` → LoginScreen) — search NEpasiekiamas. Tad „anonymous 401" scenarijus nerealizuojamas.

## Endpoint inventorius (search kelyje)

| Endpoint | Auth | limitType | Naudojimas | Statusas po pakeitimų |
|---|---|---|---|---|
| `/api/claude` | idToken (jei limitType) | `'searches'` | foto + tekstas ID | ✅ veikia (verifyIdToken priima Google+anonimus) |
| `/api/plant-image` | **public** | — | hero/galerija (Brave) | ✅ nepaliesta (deferred, public) |
| `/api/rehost-image` | **required** | — | TIK SAVE metu (ne search) | ✅ auth+SSRF+double-init fix; save reikalauja login (OK) |
| `searchCatalog` / pre-DB | client-side | — | Phase 0 | ✅ be auth, IndexedDB/local |
| `subscribeCatalog` | gated on auth | — | catalog overlay | ✅ fix'inta (auth-race) |

## Verdiktas

**Pipeline sveikas. Mūsų auth pakeitimai nieko nesulaužė foto/tekstinei paieškai.**
- verifyIdToken priima ir Google, ir anonimų token'us → visi legitimūs keliai veikia.
- plant-image public → foto enrichment nepaliestas.
- rehost-image auth reikalingas tik SAVE (ne paieškoj) — login-to-save priimtina.

## ⚠️ Latentinė pastaba (NE bug, guarded — optional robustness)

`claudeCall` siunčia `limitType:'searches'` **besąlygiškai**, o `Authorization` **tik jei idToken`.
Teoriškai: jei `getIdToken()` grąžintų null su limitType → 401. BET `getIdToken()` null tik kai
`auth.currentUser` null = atsijungta = LoginScreen → search nepasiekiamas. **App gate apsaugo.**

Robustness (jei kada norėsis): `claudeCall` galėtų (a) praleisti limitType jei nėra token'o, arba
(b) anksti grįžti su aiškiu „prisijunk" pranešimu vietoj 401. Žemo prioriteto — nerealizuojamas kelias.

## Susiję follow-up'ai (iš ankstesnio audito, ne search-specific)
- `/api/claude` limitType-bypass (be limitType — jokio auth = cost abuse) — atskira spraga, žr. Block 1 follow-up. Search VISADA siunčia limitType, tad search'ui neaktualu.
- plant-image edge rate-limit — `data-protection-sprint.md` A7.
