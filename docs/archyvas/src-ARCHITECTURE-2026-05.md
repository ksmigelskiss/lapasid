# Gėlių DB — Architektūros vadovas

> Skirtas kūrėjui ir Claude'ui. Čia — ne kas app'as daro, o **kaip kodas veikia** ir **kodėl taip**.

---

## Duomenų srautas (top-down)

```
App.jsx
└── usePlants(collectionId)   ← VIENAS hook'as, valdo VISĄ state
    ├── localStorage           ← pirminis šaltinis (instant load)
    └── Firestore              ← sinchronizacija (async)
```

Nėra React Context (intentional). Viskas per prop drilling nuo App žemyn.  
Navigacija — manual `useState('dashboard')`, ne React Router.

---

## Kritiniai failai ir jų atsakomybės

| Failas | Atsakomybė | Pastaba |
|--------|-----------|---------|
| `src/utils/firebase.js` | Firebase init, auth, `DATA_DOC` export | **Surgery point** — čia keičiamas Firestore kelias |
| `src/hooks/usePlants.js` | Visas plant state + CRUD + Firestore sync | Gauna `collectionId` kaip parametrą (po refaktoriaus) |
| `src/App.jsx` | Root orchestratorius, modalų state, tab routing | ~1338 eilučių |
| `src/pages/Dashboard.jsx` | Pagrindinis ekranas, careMode, alerts | ~1015 eilučių |

---

## DATA_DOC pattern (SVARBU)

`firebase.js` eksportuoja vieną doc reference:
```js
export const DATA_DOC = doc(db, 'users', UID)
```

`usePlants.js` naudoja jį TIKTAI dviejose vietose:
```js
getDoc(DATA_DOC)   // ← syncFromRemote()
setDoc(DATA_DOC, data)  // ← saveRemote()
```

**Pakeisti Firestore kelią = pakeisti DATA_DOC.** Visa kita logika nesikeičia.  
Po multi-user refaktoriaus: `doc(db, 'collections', collectionId)`.

---

## authReady pattern

`firebase.js` eksportuoja Promise:
```js
export const authReady = new Promise(resolve => {
  onAuthStateChanged(auth, user => {
    if (user) resolve(user)
    else signInWithEmailAndPassword(...).then(c => resolve(c.user))
  })
})
```

`usePlants.js` await'ina prieš kiekvieną Firestore operaciją:
```js
authReady.then(() => getDoc(DATA_DOC))
```

**Po Google Sign-In refaktoriaus:** `authReady` pakeičiamas `useAuth()` hook'u.  
`usePlants(collectionId)` gaus `collectionId` iš `AppContext`.

---

## Vieno dokumento Firestore pattern

Visas vartotojo duomenys — VIENAME Firestore dokumente:
```
collections/{collectionId} → { plants: [], zinynas: [], zones: [], settings: {} }
```

`setDoc` perašo visą dokumentą kaskart (ne patch).  
**Riba:** 1MB. Su didelėmis kolekcijomis (200+ augalų, tankus timeline) galima pasiekti.  
V1 — ok. Ateityje: `plants` → subcollection.

---

## Anthropic API call points

Tik **2 failai** tiesiogiai naudoja SDK:

```
useChatStream.js     → client.messages.stream()   (streaming)
SearchModal.jsx      → client.messages.create()   (non-streaming, x2: Phase 1 + Phase 2)
```

Naudoja `useChatStream`: PlantChat, CollectionChat, ZinynasChat.  
Prompt builders (`plantChatContext.js`, `collectionChatContext.js`) — tik tekstas, ne API calls.

**Po proxy refaktoriaus:**
- `useChatStream` → `fetch('/api/claude/stream')` + SSE skaitymas
- `SearchModal` → `fetch('/api/claude')` (non-streaming)

---

## Multi-user refaktoriaus planas (santrauka)

```
Phase 1  → api/claude.js proxy (Anthropic raktas iš browser → serveris)
Phase 2  → Google Sign-In + collection-centric Firestore model + invite system
Phase 2.5→ Free tier limitai + paywall UI (be Stripe)
Phase 3  → Stripe subscriptions (tik kai matoma paklausa)
Phase 4  → Shared plant catalog (AI cache)
Phase 5  → Parduoti/padovanoti su lifecycle tracking
```

Detalus planas: `/Users/kestutissmigelskis/.claude/plans/gleaming-dazzling-scroll.md`

---

## Naujas duomenų modelis (Phase 2+)

```
collections/{collectionId}/
  plants: [...]        ← tas pats kaip dabar
  zinynas: [...]
  zones: [...]
  settings: {}
  members: [uid1, uid2]
  ownerId: uid1

users/{uid}/
  primaryCollection: "col_xxx"
  beta: false          ← true = skip visi AI limitai (testuotojams)
  aiUsage: { searches: 0, chats: 0, fbPosts: 0 }
  subscription: { plan: "free", validUntil: null }
```

---

## Vercel API routes

```
api/claude.js         → non-streaming proxy (SearchModal Phase 1 & 2)
api/claude/stream.js  → SSE streaming proxy (useChatStream)
api/stripe-webhook.js → Stripe events → Firestore subscription update
api/create-checkout.js → Sukuria Stripe Checkout session
```

---

## Branch strategija

```
main                → stabili versija (augalai.crazyeuropean.eu)
feature/multi-user  → visas multi-user refaktorius
```

Tag: `v1-single-user` — stabili versija prieš refaktorių.  
Vercel preview URL: automatiškai iš `feature/multi-user` branch'o.
