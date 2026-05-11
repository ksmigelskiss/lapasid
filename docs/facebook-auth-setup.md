# Facebook Auth Setup

Kodas paruoštas (`src/utils/firebase.js`, `src/hooks/useAuth.js`), bet Firebase Auth Facebook provider'is **dar nesukonfigūruotas**. Be šių žingsnių „Tęsti su Facebook" mygtukas mes Firebase klaidą `auth/operation-not-allowed`.

## 1 · Facebook Developer App

1. https://developers.facebook.com/apps → **Create App**
2. App type: **Consumer**
3. App name: `LapasID` (arba pasirinktinai)
4. Pridėti produktą: **Facebook Login** → Web platforma
5. Settings → Basic:
   - App Domains: `geliu-db.firebaseapp.com`, `lapasid.lt`
   - Privacy Policy URL: privatumo politikos puslapis (jei neturi — sukurti stub'ą)
6. Settings → Advanced → **App Secret** ← reikės kitam žingsniui
7. Facebook Login → Settings:
   - Valid OAuth Redirect URIs: `https://geliu-db.firebaseapp.com/__/auth/handler`
8. App Review → **Make App Public** (kitaip tik test'eriai gali jungtis)

## 2 · Firebase Console

1. https://console.firebase.google.com/project/geliu-db/authentication/providers
2. Sign-in method → **Facebook** → Enable
3. App ID + App Secret iš FB Developer Portal (žiūrėk 1 žingsnį)
4. Patikrink kad **OAuth redirect URI** rodomas iš Firebase = tas pats, kurį įdėjai į FB (`https://geliu-db.firebaseapp.com/__/auth/handler`)
5. Save

## 3 · Testavimas

- Vietoje: `npm run dev` → atsijungti (jei mock mode aktyvus, išjungti `.env.local`) → LoginScreen → „Tęsti su Facebook"
- Production: lapasid.lt po deploy'o

## 4 · Privacy / GDPR

- FB OAuth grąžina: email, displayName, photoURL (jei vartotojas suteikia leidimą)
- LapasID nesaugo FB-specifinių token'ų — tik Firebase Auth UID + email/name (kaip ir su Google)
- Privatumo politikoje paminėti, kad palaikomas Facebook Login

## Troubleshooting

| Klaida | Sprendimas |
|--------|------------|
| `auth/operation-not-allowed` | FB provider'is neįjungtas Firebase Console |
| `auth/account-exists-with-different-credential` | Tas pats email jau egzistuoja su Google — siūlyti vartotojui jungtis per Google |
| FB redirect'as į „App not Active" | App Review → Make App Public |
| OAuth redirect mismatch | Patikrinti URI tikslų sutapimą tarp FB ir Firebase (jokio trailing slash skirtumo) |
