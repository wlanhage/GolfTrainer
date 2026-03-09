# Nästa steg: frontend + backend enligt definierad arkitektur

Det här dokumentet översätter arkitekturen i `README.md` och övriga docs till en konkret genomförandeplan.

## 1) Rekommenderat nästa steg (direkt)

**Starta med en tunn vertikal slice:**
1. Auth (register/login/refresh/logout) i backend + tokenhantering i frontend.
2. Profil (`GET/PATCH /users/me`) i backend + enkel profilskärm i frontend.
3. En skyddad app-shell i frontend (navigering + auth-guard).

Varför detta först:
- Ger en fungerande end-to-end grund att bygga alla andra features på.
- Verifierar arkitekturen tidigt: route → controller → service → repository + validering + auth middleware.
- Minskar risk att bygga UI utan verkligt API-kontrakt.

---

## 2) Leveransordning (backend först, sedan frontend per feature)

## Fas A – Plattform & kontrakt

### Backend
- Säkerställ att dessa moduler är stabila och dokumenterade:
  - `auth`
  - `users`
  - `clubs`
  - `practice-sessions`
  - `drills`
  - `drill-attempts`
  - `shots`
  - `stats`
- Lägg till/validera:
  - konsekventa felkoder (`400/401/403/404/409/422`)
  - paginering/filter på list-endpoints
  - request-id i loggar
  - uppdaterad OpenAPI/endpoint-spec (minst markdown-kontrakt per endpoint)

### Frontend
- Skapa `mobile/` med Expo + TypeScript.
- Skapa basstruktur enligt arkitektur:
  - `src/app/navigation`
  - `src/app/providers`
  - `src/shared/api`
  - `src/shared/store`
  - `src/features/auth`
  - `src/features/profile`
- Implementera:
  - API-klient (baseURL, JSON, timeout)
  - auth token storage + refresh-flöde
  - global `AuthProvider` med states: `loading | authenticated | guest`

**Definition of done (Fas A):**
- Inloggning fungerar i mobilappen.
- Access token används automatiskt.
- 401 triggar refresh och retry en gång.
- Utloggning rensar tokens och state.

---

## Fas B – Träningsflöde (kärnnytta)

### Backend
- Slutför och verifiera CRUD + ownership för:
  - clubs
  - practice sessions
  - shots
  - drill attempts
- Lägg till enkla domänregler i service-lagret:
  - ingen shot utan giltig `userClubId`
  - attempts: `successCount <= attemptCount`
  - session kan markeras avslutad en gång

### Frontend
- Features:
  - `clubs`: lista + skapa + redigera
  - `training`: starta/avsluta pass
  - `shots`: snabb registrering av slag
  - `drills`: registrera drill-försök
- UI-princip:
  - tunn skärmkomponent
  - feature-hook för state/data
  - API-anrop i feature/api-lager

**Definition of done (Fas B):**
- Användare kan genomföra ett helt träningspass i appen.
- Data sparas korrekt och syns efter app-omstart.

---

## Fas C – Statistik & feedback-loop

### Backend
- Stabiliserade stats-endpoints:
  - overview
  - club trend
  - drill performance
- Versionerade metric keys i snapshots (ex. `carry_avg_v1`).
- Grundläggande beräkningstester för statistiklogik.

### Frontend
- `stats`-feature:
  - översiktsskärm (30d)
  - klubba trend (graf/lista)
  - drill performance
- Visa datakälla och tidsintervall tydligt i UI.

**Definition of done (Fas C):**
- Användare ser mätbara förbättringar över tid.
- KPI:er i app matchar backend-beräkning.

---

## 3) Teamupplägg för parallellt arbete

För att bygga frontend och backend samtidigt utan arkitekturdrift:

- **Kontrakt först:** definiera request/response-exempel innan UI-kod startar.
- **Feature branch per domän:** `feature/auth`, `feature/shots`, `feature/stats`.
- **Gemensam checklista per endpoint:**
  - schema klart
  - controller/service/repository klart
  - frontend query/mutation klart
  - UI-state för loading/error/empty klart
- **Veckovis kontraktsreview:** 30 min där FE+BE validerar ändringar.

---

## 4) Kvalitetsgrindar per PR

- Backend:
  - typkontroll + lint
  - minst happy-path + ownership-test för ändrad endpoint
  - inga Prisma-anrop i controller
- Frontend:
  - typkontroll + lint
  - minst ett test på kritiskt hook-beteende (auth/session)
  - alla API-fel mappas till användbar UI-feedback

---

## 5) Konkreta uppgifter för nästa sprint (rekommenderat)

1. **Initiera `mobile/` med Expo + TS och basstruktur.**
2. **Implementera auth-klient i frontend** (login, refresh, logout).
3. **Bygg Login + Profile-skärm** mot befintliga backend-endpoints.
4. **Lägg till kontraktsdokumentation** för auth/profile (request/response + felkoder).
5. **Verifiera end-to-end manuellt:**
   - login
   - hämta profil
   - uppdatera profil
   - logout

Om ni vill maximera fart och minska risk är detta den bästa ordningen innan ni lägger mer UI på clubs/shots/stats.
