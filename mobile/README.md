# GolfTrainer Mobile (Expo + TypeScript)

Detta är en initial mobilgrund enligt `docs/frontend-backend-execution-plan.md` (Fas A).

## Vad som finns
- Basprojekt för Expo + TypeScript.
- Feature-baserad struktur i `src/`.
- AuthProvider med token-storage och refresh-stöd.
- Skyddad navigation (guest -> login, authenticated -> profile).
- API-klient med 401 -> refresh -> retry (en gång).
- Första vertikala slice:
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `POST /auth/logout`
  - `GET /users/me`

## Körning
1. Installera beroenden:
   - `npm install`
2. Starta app:
   - `npm run start`

> API base URL är satt till `http://localhost:3000/api/v1` i `src/shared/api/config.ts`.
